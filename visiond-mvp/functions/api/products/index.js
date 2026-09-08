import {json} from '../../_lib.js';
import {applyPromotion,loadPromotion} from '../../_promotion.js';
import {ensureDatabase,ensureStorefrontCatalogSchema} from '../../_schema.js';
import {loadBasketVisibility,loadDigitalStorefrontPaused} from '../../_basket_visibility.js';

const CACHE_SECONDS=60,MAX_PAGE=24,MAX_LOOKUP=30;
const countInflightByDatabase=new WeakMap();
const escapeLike=value=>String(value||'').replace(/[\\%_]/g,'\\$&');
const cacheKey=(request,revision)=>{const url=new URL(request.url),sorted=new URLSearchParams();for(const key of [...new Set(url.searchParams.keys())].filter(key=>key!=='__catalog_revision').sort())for(const value of url.searchParams.getAll(key))sorted.append(key,value);sorted.set('__catalog_revision',String(revision||'0'));return new Request(`${url.origin}${url.pathname}?${sorted}`,{method:'GET'})};
const countKey=(request,{revision,visibility,query,lookupSlugs})=>{const url=new URL(request.url),params=new URLSearchParams({__catalog_counts:'1',revision:String(revision||'0'),access:'public-storefront',visibility:JSON.stringify(visibility),q:query});if(lookupSlugs.length)params.set('slugs',[...lookupSlugs].sort().join(','));return new Request(`${url.origin}/api/products/__counts?${params}`,{method:'GET'})};
const parseCursor=value=>{if(!value)return null;const match=String(value).match(/^([01]):([1-9]\d*)(?::(\d+))?$/);return match?{rank:Number(match[1]),id:Number(match[2]),seen:Number(match[3]||0)}:false};
const emptyCounts=()=>({all:0,tattoo:0,coloring:0,worksheet:0,'development-game':0,'paper-doll':0,'resale-rights':0});
async function authoritativeCounts(ctx,{sql,bindings,key}){
  const cache=globalThis.caches?.default,cached=cache?await cache.match(key):null;if(cached)return cached.json();
  let inflight=countInflightByDatabase.get(ctx.env.DB);if(!inflight){inflight=new Map();countInflightByDatabase.set(ctx.env.DB,inflight)}
  let task=inflight.get(key.url);if(!task){task=(async()=>{
    const rows=(await ctx.env.DB.prepare(sql).bind(...bindings).all()).results||[],counts=emptyCounts();
    for(const row of rows){const count=Number(row.total)||0;counts.all+=count;if(Object.hasOwn(counts,row.storefront_group))counts[row.storefront_group]=count}
    if(cache){const response=json(counts,200,{'cache-control':`public, max-age=0, s-maxage=${CACHE_SECONDS}`});await cache.put(key,response).catch(()=>{})}
    return counts;
  })().finally(()=>inflight.delete(key.url));inflight.set(key.url,task)}
  return task;
}

export async function onRequestGet(ctx){
  const url=new URL(ctx.request.url),params=url.searchParams,lookupSlugs=[...new Set(String(params.get('slugs')||'').split(',').map(value=>value.trim()).filter(Boolean))].slice(0,MAX_LOOKUP),isLookup=lookupSlugs.length>0,limit=isLookup?MAX_LOOKUP:Math.min(MAX_PAGE,Math.max(1,Number(params.get('limit'))||MAX_PAGE)),cursor=parseCursor(params.get('cursor')),query=String(params.get('q')||'').trim().slice(0,100),group=String(params.get('group')||'').trim(),allowedGroups=new Set(['tattoo','coloring','worksheet','development-game','paper-doll','resale-rights']);
  if(cursor===false)return json({error:'cursor ไม่ถูกต้อง'},400);
  if(group&&!allowedGroups.has(group))return json({error:'หมวดสินค้าไม่ถูกต้อง'},400);
  if(params.has('slugs')&&!lookupSlugs.length)return json({items:[],pagination:{limit:MAX_LOOKUP,has_more:false,next_cursor:null}});
  await ensureDatabase(ctx.env);
  if(await loadDigitalStorefrontPaused(ctx.env))return json({items:[],storefront_closed:true,message:'หน้าร้านไฟล์ดิจิทัลปิดปรับปรุงชั่วคราว งานและสิทธิ์ดาวน์โหลดเดิมยังอยู่ครบ',category_counts:emptyCounts(),pagination:{limit,has_more:false,next_cursor:null,total:0,range_from:0,range_to:0}},200,{'cache-control':'private, no-store'});
  if(!await ensureStorefrontCatalogSchema(ctx.env))return json({error:'ข้อมูลหน้าร้านกำลังเตรียมดัชนี กรุณาลองใหม่อีกครั้ง',code:'STOREFRONT_METADATA_NOT_READY'},503,{'cache-control':'private, no-store'});
  const revision=String((await ctx.env.DB.prepare("SELECT value FROM settings WHERE key='storefront_catalog_revision'").first())?.value||'0'),key=cacheKey(ctx.request,revision),cache=globalThis.caches?.default,cached=cache?await cache.match(key):null;if(cached)return cached;
  const visibility=await loadBasketVisibility(ctx.env),clauses=["p.storefront_meta_version=1","p.status='published'","p.deleted_at IS NULL","COALESCE(p.product_kind,'product')='product'","(p.category<>'resale-rights' OR p.slug='course-selling-rights')"],baseBindings=[];
  if(visibility.mode==='all'&&visibility.action==='closed')clauses.push('0=1');
  if(visibility.mode==='specific'&&visibility.prefixes.length){const matches=visibility.prefixes.map(()=>"p.title LIKE ? ESCAPE '\\'");const expression=`(${matches.join(' OR ')})`;clauses.push(visibility.action==='open'?expression:`NOT ${expression}`);baseBindings.push(...visibility.prefixes.map(prefix=>escapeLike(prefix)+'%'))}
  if(isLookup){clauses.push(`p.slug IN (${lookupSlugs.map(()=>'?').join(',')})`);baseBindings.push(...lookupSlugs)}
  if(query){const pattern=`%${escapeLike(query)}%`;clauses.push(`(p.title LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\' OR COALESCE(p.short_description,'') LIKE ? ESCAPE '\\' OR COALESCE(p.description,'') LIKE ? ESCAPE '\\' OR COALESCE(p.category,'') LIKE ? ESCAPE '\\' OR COALESCE(c.name,'') LIKE ? ESCAPE '\\')`);baseBindings.push(pattern,pattern,pattern,pattern,pattern,pattern)}
  const from=`FROM products p LEFT JOIN categories c ON c.slug=p.category WHERE ${clauses.join(' AND ')}`;
  const categoryCounts=await authoritativeCounts(ctx,{sql:`SELECT p.storefront_group,COUNT(*) total ${from} GROUP BY p.storefront_group`,bindings:baseBindings,key:countKey(ctx.request,{revision,visibility,query,lookupSlugs})});
  const select=`SELECT p.id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.preview_urls,p.category,p.file_type,p.pages,p.product_kind,c.name category_label,p.storefront_group,p.storefront_sort_rank sort_rank,(SELECT COALESCE(SUM(views),0) FROM analytics_daily WHERE product_id=p.id)+(SELECT COUNT(*) FROM page_views WHERE aggregated_at IS NULL AND product_id=p.id) view_count,(SELECT COALESCE(SUM(source.pages),0) FROM product_bundle_items b JOIN products source ON source.id=b.source_product_id WHERE b.bundle_product_id=p.id) bundle_pages`;
  const fetchPage=async(extraClauses,extraBindings,pageLimit)=>{const suffix=extraClauses.length?` AND ${extraClauses.join(' AND ')}`:'';return (await ctx.env.DB.prepare(`${select} ${from}${suffix} ORDER BY p.storefront_sort_rank,p.id DESC LIMIT ?`).bind(...baseBindings,...extraBindings,pageLimit).all()).results||[]};
  let results;
  if(cursor&&!isLookup&&!group){
    results=await fetchPage(['p.storefront_sort_rank=?','p.id<?'],[cursor.rank,cursor.id],limit+1);
    if(results.length<limit+1&&cursor.rank<1)results.push(...await fetchPage(['p.storefront_sort_rank>?'],[cursor.rank],limit+1-results.length));
  }else{
    const pageClauses=[],bindings=[];if(group){pageClauses.push('p.storefront_group=?');bindings.push(group)}if(cursor&&!isLookup){pageClauses.push('p.storefront_sort_rank=?','p.id<?');bindings.push(cursor.rank,cursor.id)}
    results=await fetchPage(pageClauses,bindings,limit+1);
  }
  const hasMore=!isLookup&&results.length>limit,items=results.slice(0,limit),last=items.at(-1),seen=isLookup?0:Number(cursor?.seen)||0,nextSeen=seen+items.length,nextCursor=hasMore&&last?`${Number(last.sort_rank)||0}:${Number(last.id)}:${nextSeen}`:null,total=group?categoryCounts[group]||0:categoryCounts.all,rangeFrom=items.length?seen+1:0,rangeTo=seen+items.length,promotion=await loadPromotion(ctx.env),response=json({items:applyPromotion(items,promotion),promotion,category_counts:categoryCounts,pagination:{limit,has_more:hasMore,next_cursor:nextCursor,total,range_from:rangeFrom,range_to:rangeTo}},200,{'cache-control':`public, max-age=30, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`});
  if(cache){const write=cache.put(key,response.clone());if(ctx.waitUntil)ctx.waitUntil(write);else await write}return response;
}
// Feature: CATALOG-STOREFRONT-001 — bounded storefront catalog and batch cart lookup
