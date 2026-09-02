import {json} from '../../_lib.js';
import {applyPromotion,loadPromotion} from '../../_promotion.js';
import {ensureDatabase} from '../../_schema.js';
import {basketVisible,loadBasketVisibility} from '../../_basket_visibility.js';

const CACHE_SECONDS=60;
const cacheKey=request=>new Request(`${new URL(request.url).origin}/api/products`,{method:'GET'});

export async function onRequestGet(ctx){
  const key=cacheKey(ctx.request),cache=globalThis.caches?.default,cached=cache?await cache.match(key):null;if(cached)return cached;
  await ensureDatabase(ctx.env);
  const {results}=await ctx.env.DB.prepare(`WITH
    view_totals AS (SELECT product_id,SUM(views) views FROM analytics_daily WHERE product_id>0 GROUP BY product_id),
    legacy_views AS (SELECT product_id,COUNT(*) views FROM page_views WHERE aggregated_at IS NULL AND product_id IS NOT NULL GROUP BY product_id),
    bundle_totals AS (SELECT b.bundle_product_id product_id,SUM(source.pages) pages FROM product_bundle_items b JOIN products source ON source.id=b.source_product_id GROUP BY b.bundle_product_id)
    SELECT p.id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,p.preview_urls,p.category,p.file_type,p.pages,p.product_kind,c.name category_label,
      COALESCE(v.views,0)+COALESCE(l.views,0) view_count,COALESCE(b.pages,0) bundle_pages
    FROM products p
    LEFT JOIN categories c ON c.slug=p.category
    LEFT JOIN view_totals v ON v.product_id=p.id
    LEFT JOIN legacy_views l ON l.product_id=p.id
    LEFT JOIN bundle_totals b ON b.product_id=p.id
    WHERE p.status='published' AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product')='product'
      AND (p.category<>'resale-rights' OR p.slug='course-selling-rights')
    ORDER BY p.id DESC`).all();
  const [promotion,visibility]=await Promise.all([loadPromotion(ctx.env),loadBasketVisibility(ctx.env)]),visible=results.filter(item=>basketVisible(item.title,visibility)),response=json({items:applyPromotion(visible,promotion),promotion},200,{'cache-control':`public, max-age=30, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=30`});
  if(cache){const write=cache.put(key,response.clone());if(ctx.waitUntil)ctx.waitUntil(write);else await write}
  return response;
}
// Feature: CATALOG-STOREFRONT-001 — published storefront catalog boundary
