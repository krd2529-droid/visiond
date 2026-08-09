import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const rows=await ctx.env.DB.prepare(`SELECT c.id course_id,p.title,
    (SELECT COUNT(*) FROM orders o WHERE o.seller_course_id=c.id AND o.status='paid') paid_orders,
    (SELECT COUNT(*) FROM orders o WHERE o.seller_course_id=c.id AND o.status='paid' AND (o.slip_key IS NOT NULL OR EXISTS(SELECT 1 FROM order_slip_evidence se WHERE se.order_id=o.id))) approved_slips,
    (SELECT COUNT(*) FROM entitlements e JOIN orders o ON o.id=e.order_id WHERE e.product_id=p.id AND e.active=1 AND o.seller_course_id=c.id AND o.status='paid') learning_rights,
    (SELECT COUNT(*) FROM entitlements e WHERE e.product_id=p.id AND e.active=1 AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.id=e.order_id AND o.seller_course_id=c.id AND o.status='paid')) invalid_rights
    FROM courses c JOIN products p ON p.id=c.product_id WHERE c.course_origin='seller_rights' AND p.deleted_at IS NULL ORDER BY c.id DESC`).all();
  const items=(rows.results||[]).map(x=>{const paid=Number(x.paid_orders)||0,slips=Number(x.approved_slips)||0,rights=Number(x.learning_rights)||0,invalid=Number(x.invalid_rights)||0;return {...x,paid_orders:paid,approved_slips:slips,learning_rights:rights,invalid_rights:invalid,healthy:paid===slips&&slips===rights&&invalid===0,difference:rights-slips}});
  return json({checked_at:new Date().toISOString(),healthy:items.every(x=>x.healthy),issues:items.filter(x=>!x.healthy).length,items},200,{'cache-control':'no-store'});
}
