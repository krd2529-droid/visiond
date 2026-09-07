import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const slugs=[...new Set(String(new URL(ctx.request.url).searchParams.get('slugs')||'').split(',').map(value=>value.trim()).filter(Boolean))].slice(0,30);
  if(!slugs.length)return json({items:[]},200,{'cache-control':'private, no-store'});
  const {results}=await ctx.env.DB.prepare(`SELECT p.slug,MAX(CASE o.status WHEN 'paid' THEN 4 WHEN 'pending_review' THEN 3 WHEN 'awaiting_payment' THEN 2 WHEN 'rejected' THEN 1 ELSE 0 END) status_rank FROM orders o JOIN order_items oi ON oi.order_id=o.id JOIN products p ON p.id=oi.product_id WHERE o.user_id=? AND p.slug IN (${slugs.map(()=>'?').join(',')}) GROUP BY p.slug`).bind(auth.user.id,...slugs).all();
  const statusByRank={4:'paid',3:'pending_review',2:'awaiting_payment',1:'rejected'};
  return json({items:results.filter(item=>Number(item.status_rank)>0).map(item=>({slug:item.slug,status:statusByRank[Number(item.status_rank)],blocked:Number(item.status_rank)>=2}))},200,{'cache-control':'private, no-store'});
}
// Feature: COMMERCE-ORDER-STATUS-001 — compact per-page purchase status
