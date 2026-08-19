import { json, requireAdmin, statusLabel } from '../../_lib.js';

export async function onRequestGet(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const { results } = await ctx.env.DB.prepare(`SELECT o.*,u.name customer_name,u.email customer_email,u.phone customer_phone,COALESCE(owner.vision5_test_account,0) vision5_test_account FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN users owner ON owner.id=o.course_owner_user_id WHERE o.status IN ('awaiting_payment','pending_review','rejected') ORDER BY CASE o.status WHEN 'pending_review' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,o.id DESC`).all();
  for (const order of results) {
    order.items = (await ctx.env.DB.prepare("SELECT COALESCE(oi.product_title,p.title,'สินค้า') title,p.category,p.product_kind,oi.price,COUNT(*) quantity,SUM(oi.price) line_total FROM order_items oi LEFT JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? GROUP BY oi.product_id,COALESCE(oi.product_title,p.title,'สินค้า'),p.category,p.product_kind,oi.price ORDER BY MIN(oi.id)").bind(order.id).all()).results;
    order.item_count = order.items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    order.has_resale_rights = order.items.some(item => item.category === 'resale-rights');
    order.vision5_managed = Boolean(order.course_owner_user_id || order.seller_course_id);
    const partnerCourse = order.course_plan === 'partner';
    const manual = order.status === 'pending_review' && order.slip_key && order.slip_verification_status === 'manual';
    order.boss_can_review_rights = Boolean(order.has_resale_rights && auth.user.role === 'boss' && manual);
    order.boss_can_review_vision5_test = Boolean(Number(order.vision5_test_account) === 1 && auth.user.role === 'boss' && manual);
    order.boss_can_review_partner = Boolean(partnerCourse && auth.user.role === 'boss' && manual);
    order.vision5_reason = order.boss_can_review_partner ? 'คอร์สพาร์ตเนอร์รับเงินผ่าน VisionD และรอ Boss ตรวจสลิปแมนนวล' : order.boss_can_review_vision5_test ? 'บัญชีทดสอบ Vision 5 ต้องให้ Boss ตรวจและอนุมัติ' : order.vision5_managed ? 'เจ้าของคอร์สเป็นผู้ตรวจใน Vision 5' : order.has_resale_rights ? (auth.user.role === 'boss' ? 'Boss ตรวจสลิปและอนุมัติสิทธิ์แทนได้' : 'เฉพาะ Boss ตรวจสลิปตะกร้าสิทธิ์ได้') : 'VisionD ตรวจได้';
    order.status_label = statusLabel(order.status);
    order.slip_url = order.slip_key ? `/api/admin/slip?key=${encodeURIComponent(order.slip_key)}` : null;
  }
  return json({ items: results });
}
