import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
const n=v=>Number(v)||0;
const familyFromTitle=title=>String(title||'').replace(/\s*(?:ชุด\s*ที่|ชุด|set)\s*[-:#]?\s*\d+\s*$/iu,'').trim()||String(title||'').trim();
const seriesFromTitle=title=>{const m=String(title||'').match(/(?:ชุด\s*ที่|ชุด|set)\s*[-:#]?\s*(\d+)\s*$/iu);return m?Number(m[1]):1};
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),days=Math.min(90,Math.max(1,Number(url.searchParams.get('days'))||30)),since=`-${days-1} days`;
  const events=(await ctx.env.DB.prepare(`SELECT event_type,COUNT(*) count,COUNT(DISTINCT COALESCE(CAST(user_id AS TEXT),visitor_key)) people FROM customer_events WHERE created_at>=datetime('now',?) GROUP BY event_type`).bind(since).all()).results||[];
  const map=Object.fromEntries(events.map(x=>[x.event_type,{events:n(x.count),people:n(x.people)}]));
  const paid=await ctx.env.DB.prepare(`SELECT COUNT(*) orders,COUNT(DISTINCT user_id) buyers,COALESCE(SUM(total),0) revenue FROM orders WHERE status='paid' AND updated_at>=datetime('now',?)`).bind(since).first();
  const rows=(await ctx.env.DB.prepare(`WITH ev AS (
    SELECT product_id,
      COUNT(DISTINCT CASE WHEN event_type='product_view' THEN COALESCE(CAST(user_id AS TEXT),visitor_key) END) views,
      COUNT(DISTINCT CASE WHEN event_type='add_to_cart' THEN COALESCE(CAST(user_id AS TEXT),visitor_key) END) carts,
      COUNT(DISTINCT CASE WHEN event_type='checkout_start' THEN COALESCE(CAST(user_id AS TEXT),visitor_key) END) checkouts
    FROM customer_events WHERE created_at>=datetime('now',?) AND product_id IS NOT NULL GROUP BY product_id
  ), sales AS (
    SELECT oi.product_id,COUNT(DISTINCT o.id) purchases,COALESCE(SUM(oi.price),0) revenue
    FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.status='paid'
    WHERE o.updated_at>=datetime('now',?) GROUP BY oi.product_id
  )
  SELECT p.id,p.slug,p.title,p.category,p.created_at,p.inventory_origin,p.family_key,p.series_no,
    COALESCE(ev.views,0) views,COALESCE(ev.carts,0) carts,COALESCE(ev.checkouts,0) checkouts,
    COALESCE(sales.purchases,0) purchases,COALESCE(sales.revenue,0) revenue
  FROM products p LEFT JOIN ev ON ev.product_id=p.id LEFT JOIN sales ON sales.product_id=p.id
  WHERE p.deleted_at IS NULL AND p.product_kind='product'
  ORDER BY views DESC LIMIT 250`).bind(since,since).all()).results||[];
  const products=rows.map(x=>({...x,views:n(x.views),carts:n(x.carts),checkouts:n(x.checkouts),purchases:n(x.purchases),revenue:n(x.revenue),family:x.family_key||familyFromTitle(x.title),series:n(x.series_no)||seriesFromTitle(x.title),inventory_origin:x.inventory_origin||'premade_stock'}));
  const families=new Map();
  for(const x of products){const key=x.family.toLocaleLowerCase('th-TH');if(!families.has(key))families.set(key,{family:x.family,category:x.category,products:0,max_series:0,views:0,carts:0,checkouts:0,purchases:0,revenue:0,premade:0,demand_driven:0});const f=families.get(key);f.products++;f.max_series=Math.max(f.max_series,x.series);f.views+=x.views;f.carts+=x.carts;f.checkouts+=x.checkouts;f.purchases+=x.purchases;f.revenue+=x.revenue;x.inventory_origin==='demand_driven'?f.demand_driven++:f.premade++}
  const productFamilies=[...families.values()].map(f=>{const cartRate=f.views?f.carts/f.views:0,purchaseRate=f.views?f.purchases/f.views:0;let recommendation='HOLD',reason='ข้อมูลการเข้าดูยังไม่พอ';if(f.views>=20&&f.purchases>=3){recommendation='PRODUCE';reason='มีทั้งความสนใจและยอดซื้อรองรับ'}else if(f.views>=30&&f.carts>=3&&!f.purchases){recommendation='TEST';reason='สนใจ/ใส่ตะกร้า แต่ยังไม่เกิดยอดซื้อ ควรแก้ข้อเสนอหรือ Checkout ก่อนผลิตหนัก'}else if(f.views>=30&&cartRate<0.03){recommendation='HOLD';reason='มี Exposure แต่ Add to Cart ต่ำ'}return {...f,cart_rate:cartRate,purchase_rate:purchaseRate,recommendation,reason,next_series:f.max_series+1}}).sort((a,b)=>b.purchases-a.purchases||b.carts-a.carts||b.views-a.views);
  const journeys=(await ctx.env.DB.prepare(`SELECT e.user_id,u.name,u.username,MAX(e.created_at) last_seen,COUNT(*) events,GROUP_CONCAT(DISTINCT e.event_type) event_types FROM customer_events e JOIN users u ON u.id=e.user_id WHERE e.created_at>=datetime('now',?) GROUP BY e.user_id ORDER BY last_seen DESC LIMIT 20`).bind(since).all()).results||[];
  return json({days,events:map,purchase:{orders:n(paid?.orders),buyers:n(paid?.buyers),revenue:n(paid?.revenue)},products:products.slice(0,20),product_families:productFamilies.slice(0,30),journeys});
}
