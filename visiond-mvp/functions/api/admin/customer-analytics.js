import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
const n=v=>Number(v)||0;
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),days=Math.min(90,Math.max(1,Number(url.searchParams.get('days'))||30)),since=`-${days-1} days`;
  const events=(await ctx.env.DB.prepare(`SELECT event_type,COUNT(*) count,COUNT(DISTINCT COALESCE(CAST(user_id AS TEXT),visitor_key)) people FROM customer_events WHERE created_at>=datetime('now',?) GROUP BY event_type`).bind(since).all()).results||[];
  const map=Object.fromEntries(events.map(x=>[x.event_type,{events:n(x.count),people:n(x.people)}]));
  const paid=await ctx.env.DB.prepare(`SELECT COUNT(*) orders,COUNT(DISTINCT user_id) buyers,COALESCE(SUM(total),0) revenue FROM orders WHERE status='paid' AND updated_at>=datetime('now',?)`).bind(since).first();
  const products=(await ctx.env.DB.prepare(`SELECT p.id,p.slug,p.title,COUNT(DISTINCT CASE WHEN e.event_type='product_view' THEN COALESCE(CAST(e.user_id AS TEXT),e.visitor_key) END) views,COUNT(DISTINCT CASE WHEN e.event_type='add_to_cart' THEN COALESCE(CAST(e.user_id AS TEXT),e.visitor_key) END) carts FROM products p LEFT JOIN customer_events e ON e.product_id=p.id AND e.created_at>=datetime('now',?) WHERE p.deleted_at IS NULL GROUP BY p.id HAVING views>0 OR carts>0 ORDER BY views DESC LIMIT 10`).bind(since).all()).results||[];
  const journeys=(await ctx.env.DB.prepare(`SELECT e.user_id,u.name,u.username,u.email,MAX(e.created_at) last_seen,COUNT(*) events,GROUP_CONCAT(DISTINCT e.event_type) event_types FROM customer_events e JOIN users u ON u.id=e.user_id WHERE e.created_at>=datetime('now',?) GROUP BY e.user_id ORDER BY last_seen DESC LIMIT 20`).bind(since).all()).results||[];
  return json({days,events:map,purchase:{orders:n(paid?.orders),buyers:n(paid?.buyers),revenue:n(paid?.revenue)},products,journeys});
}
