import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const {results}=await ctx.env.DB.prepare(`SELECT o.id order_id,o.order_no,o.user_id,o.total order_total,o.sale_price_recorded,o.slip_key,o.admin_note,o.created_at,o.updated_at paid_at,u.name customer_name,u.email customer_email,u.phone customer_phone,oi.product_id,COALESCE(oi.product_title,p.title,'สินค้าเดิม') product_title,oi.price sale_price,CASE WHEN o.order_no LIKE 'VD-MANUAL-%' THEN 'manual' ELSE 'slip_sale' END sale_type,CASE WHEN o.course_owner_user_id IS NULL THEN 'visiond' ELSE 'seller_course' END revenue_channel,(SELECT actor_name FROM unlock_logs ul WHERE ul.order_id=o.id ORDER BY ul.id LIMIT 1) approved_by FROM orders o JOIN users u ON u.id=o.user_id JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id WHERE o.status='paid' ORDER BY o.updated_at DESC,o.id DESC`).all();
  for(const item of results)item.slip_url=item.slip_key?`/api/admin/slip?key=${encodeURIComponent(item.slip_key)}`:null;
  return json({items:results});
}
