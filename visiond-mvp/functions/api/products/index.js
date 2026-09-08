import {json} from '../../_lib.js';
import {applyPromotion,loadPromotion} from '../../_promotion.js';
import {ensureDatabase,ensureStorefrontCatalogSchema} from '../../_schema.js';
import {loadBasketVisibility,loadDigitalStorefrontPaused} from '../../_basket_visibility.js';

const CACHE_SECONDS=60,MAX_PAGE=24,MAX_LOOKUP=30;
const escapeLike=value=>String(value||'').replace(/[\\%_]/g,'\\$&');
const groupExpression=`CASE
  WHEN lower(COALESCE(p.category,'')) LIKE '%tattoo%' OR lower(COALESCE(c.parent_slug,'')) LIKE '%tattoo%' OR p.title LIKE '%รอยสัก%' OR p.title LIKE '%แบบสัก%' THEN 'tattoo'
  WHEN lower(COALESCE(p.category,'')) LIKE '%coloring%' OR lower(COALESCE(c.parent_slug,'')) LIKE '%coloring%' OR p.title LIKE '%ระบายสี%' THEN 'coloring'
  WHEN lower(COALESCE(p.category,'')) LIKE '%development-game%' OR lower(COALESCE(c.parent_slug,'')) LIKE '%development-game%' OR p.title LIKE '%เกมเสริมพัฒนาการ%' OR lower(p.title) LIKE '%maze%' OR p.title LIKE '%เขาวงกต%' THEN 'development-game'
  WHEN lower(COALESCE(p.category,'')) LIKE '%paper-doll%' OR lower(COALESCE(c.parent_slug,'')) LIKE '%paper-doll%' OR p.title LIKE '%ตุ๊กตากระดาษ%' THEN 'paper-doll'
  WHEN p.category='resale-rights' OR p.slug='course-selling-rights' THEN 'resale-rights'
  ELSE 'worksheet' END`;
const cacheKey=(request,revision)=>{const url=new URL(request.url),sorted=new URLSearchParams();for(const key of [...new Set(url.searchParams.keys())].filter(key=>key!=='__catalog_revision').sort())for(const value of url.searchParams.getAll(key))sorted.append(key,value);sorted.set('__catalog_revision',String(revision||'0'));return new Request(`${url.origin}${url.pathname}?${sorted}`,{method:'GET'})};
const parseCursor=value=>{if(!value)return null;const match=String(value).match(/^([01]):([1-9]\d*)(?::(\d+))?$/);return match?{rank:Number(match[1]),id:Number(match[2]),seen:Number(match[3]||0)}:false};

export async function onRequestGet(ctx){
  const url=new URL(ctx.request.url),params=url.searchParams,lookupSlugs=[...new Set(String(params.get('slugs')||'').split(',').map(value=>value.trim()).filter(Boolean))].slice(0,MAX_LOOKUP),isLookup=lookupSlugs.length>0,limit=isLookup?MAX_LOOKUP:Math.min(MAX_PAGE,Math.max(1,Number(params.get('limit'))||MAX_PAGE)),cursor=parseCursor(params.get('cursor')),query=String(params.get('q')||'').trim().slice(0,100),group=String(params.get('group')||'').trim(),allowedGroups=new Set(['tattoo','coloring','worksheet','development-game','paper-doll','resale-rights']);
  if(cursor===false)return json({error:'cursor ไม่ถูกต้อง'},400);
  if(group&&!allowedGroups.has(group))return json({error:'หมวดสินค้าไม่ถูกต้อง'},400);
  if(params.has('slugs')&&!lookupSlugs.length)return json({items:[],pagination:{limit:MAX_LOOKUP,has_more:false,next_cursor:null}});
  await ensureDatabase(ctx.env);
  if(await loadDigitalStorefrontPaused(ctx.env))return json({items:[],storefront_closed:true,message:'หน้าร้านไฟล์ดิจิทัลปิดปรับปรุงชั่วคราว งานและสิทธิ์ดาวน์โหลดเดิมยังอยู่ครบ',category_counts:{all:0,tattoo:0,coloring:0,worksheet:0,'development-game':0,'paper-doll':0,'resale-rights':0},pagination:{limit,has_more:false,next_cursor:null,total:0,range_from:0,range_to:0}},200,{'cache-control':'private, no-store'});
  await ensureStorefrontCatalogSchema(ctx.env);
  const revision=String((await ctx.env.DB.prepare("SELECT value FROM settings WHERE key='storefront_catalog_revision'").first())?.value||'0'),key=cacheKey(ctx.request,revision),cache=globalThis.caches?.default,cached=cache?await cache.match(key):null;if(cached)return cached;
  const visibility=await loadBasketVisibility(ctx.env),clauses=["p.status='published'","p.deleted_at IS NULL","COALESCE(p.product_kind,'product')='product'","(p.category<>'resale-rights' OR p.slug='course-selling-rights')"],baseBindings=[];
  if(visibility.mode==='all'&&visibility.action==='closed')clauses.push('0=1');
  if(visibility.mode==='specific'&&visibility.prefixes.length){const matches=visibility.prefixes.map(()=>"p.title LIKE ? ESCAPE '\\'");const expression=`(${matches.join(' OR ')})`;clauses.push(visibility.action==='open'?expression:`NOT ${expression}`);baseBindings.push(...visibility.prefixes.map(prefix=>escapeLike(prefix)+'%'))}
  if(isLookup){clauses.push(`p.slug IN (${lookupSlugs.map(()=>'?').join(',')})`);baseBindings.push(...lookupSlugs)}
  if(query){const pattern=`%${escapeLike(query)}%`;clauses.push(`(p.title LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\' OR COALESCE(p.short_description,'') LIKE ? ESCAPE '\\' OR COALESCE(p.description,'') LIKE ? ESCAPE '\\' OR COALESCE(p.category,'') LIKE ? ESCAPE '\\' OR COALESCE(c.name,'') LIKE ? ESCAPE '\\')`);baseBindings.push(pattern,pattern,pattern,pattern,pattern,pattern)}
  const candidate=`WITH candidates AS (SELECT p.id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.preview_urls,p.category,p.file_type,p.pages,p.product_kind,c.name category_label,${groupExpression} storefront_group,CASE WHEN (${groupExpression})='tattoo' THEN 1 ELSE 0 END sort_rank FROM products p LEFT JOIN categories c ON c.slug=p.category WHERE ${clauses.join(' AND ')})`;
  const countRows=(await ctx.env.DB.prepare(`${candidate} SELECT storefront_group,COUNT(*) total FROM candidates GROUP BY storefront_group`).bind(...baseBindings).all()).results||[],categoryCounts={all:0,tattoo:0,coloring:0,worksheet:0,'development-game':0,'paper-doll':0,'resale-rights':0};
  for(const row of countRows){const count=Number(row.total)||0;categoryCounts.all+=count;if(Object.hasOwn(categoryCounts,row.storefront_group))categoryCounts[row.storefront_group]=count}
  const bindings=[...baseBindings],pageClauses=[];if(group){pageClauses.push('storefront_group=?');bindings.push(group)}if(cursor&&!isLookup){pageClauses.push('(sort_rank>? OR (sort_rank=? AND id<?))');bindings.push(cursor.rank,cursor.rank,cursor.id)}
  const sql=`${candidate}, page AS (SELECT * FROM candidates${pageClauses.length?' WHERE '+pageClauses.join(' AND '):''} ORDER BY sort_rank,id DESC LIMIT ?) SELECT page.*,(SELECT COALESCE(SUM(views),0) FROM analytics_daily WHERE product_id=page.id)+(SELECT COUNT(*) FROM page_views WHERE aggregated_at IS NULL AND product_id=page.id) view_count,(SELECT COALESCE(SUM(source.pages),0) FROM product_bundle_items b JOIN products source ON source.id=b.source_product_id WHERE b.bundle_product_id=page.id) bundle_pages FROM page ORDER BY sort_rank,id DESC`;
  const {results}=await ctx.env.DB.prepare(sql).bind(...bindings,limit+1).all(),hasMore=!isLookup&&results.length>limit,items=results.slice(0,limit),last=items.at(-1),seen=isLookup?0:Number(cursor?.seen)||0,nextSeen=seen+items.length,nextCursor=hasMore&&last?`${Number(last.sort_rank)||0}:${Number(last.id)}:${nextSeen}`:null,total=group?categoryCounts[group]||0:categoryCounts.all,rangeFrom=items.length?seen+1:0,rangeTo=seen+items.length,promotion=await loadPromotion(ctx.env),response=json({items:applyPromotion(items,promotion),promotion,category_counts:categoryCounts,pagination:{limit,has_more:hasMore,next_cursor:nextCursor,total,range_from:rangeFrom,range_to:rangeTo}},200,{'cache-control':`public, max-age=30, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`});
  if(cache){const write=cache.put(key,response.clone());if(ctx.waitUntil)ctx.waitUntil(write);else await write}return response;
}
// Feature: CATALOG-STOREFRONT-001 — bounded storefront catalog and batch cart lookup
