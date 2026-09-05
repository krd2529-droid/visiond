import { json, requireBoss } from '../../../../_lib.js';
import { ensureDatabase } from '../../../../_schema.js';
import { ensureVxReferralSchema } from '../../../../_vx_referrals.js';
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env); await ensureVxReferralSchema(ctx.env);
  const auth = await requireBoss(ctx); if (auth.error) return auth.error;
  const orderId = Number(ctx.params.id), body = await ctx.request.json().catch(() => ({})), reason = String(body.reason || '').trim().slice(0,300);
  if (!orderId || !reason) return json({ error: 'กรุณาระบุออเดอร์และเหตุผลการคืนเงิน' }, 400);
  const order = await ctx.env.DB.prepare("SELECT id,status FROM orders WHERE id=?").bind(orderId).first();
  if (!order || order.status !== 'paid') return json({ error: 'คืนเงินได้เฉพาะออเดอร์ที่ชำระแล้ว' }, 409);
  if (await ctx.env.DB.prepare("SELECT oi.id FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? AND p.product_kind='member' LIMIT 1").bind(orderId).first()) return json({ error: 'ออเดอร์สมาชิกต้องคำนวณสิทธิ์คงเหลือก่อนคืนเงิน กรุณาดำเนินการผ่านฝ่ายบัญชี' }, 409);
  if (await ctx.env.DB.prepare("SELECT id FROM course_right_credits WHERE order_id=? AND used_course_id IS NOT NULL LIMIT 1").bind(orderId).first()) return json({ error: 'เครดิตจากออเดอร์นี้ถูกใช้สร้างคอร์สแล้ว ต้องถอนคอร์สก่อนคืนเงิน' }, 409);
  if (await ctx.env.DB.prepare("SELECT id FROM vx_referral_commissions WHERE order_id=? AND status='processing'").bind(orderId).first()) return json({ error: 'ค่าคอมอยู่ระหว่างรอบจ่าย กรุณาหยุดและตรวจรอบจ่ายก่อนคืนเงิน' }, 409);
  const results = await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE orders SET status='refunded',admin_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='paid' AND NOT EXISTS(SELECT 1 FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=orders.id AND p.product_kind='member') AND NOT EXISTS(SELECT 1 FROM course_right_credits cr WHERE cr.order_id=orders.id AND cr.used_course_id IS NOT NULL) AND NOT EXISTS(SELECT 1 FROM vx_referral_commissions vc WHERE vc.order_id=orders.id AND vc.status='processing')").bind(reason, orderId),
    ctx.env.DB.prepare("UPDATE entitlements SET active=0 WHERE order_id=? AND active=1 AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='refunded' AND admin_note=?)").bind(orderId,orderId,reason),
    ctx.env.DB.prepare("UPDATE course_right_credits SET active=0 WHERE order_id=? AND active=1 AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='refunded' AND admin_note=?)").bind(orderId,orderId,reason),
    ctx.env.DB.prepare("UPDATE category_memberships SET active=0,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND active=1 AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='refunded' AND admin_note=?)").bind(orderId,orderId,reason),
    ctx.env.DB.prepare("UPDATE vx_referral_commissions SET status='reversed',void_reason=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status IN('pending','approved','payable') AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='refunded' AND admin_note=?)").bind(reason, orderId,orderId,reason),
    ctx.env.DB.prepare("INSERT OR IGNORE INTO vx_referral_adjustments(id,commission_id,referrer_user_id,amount,currency,reason,created_by) SELECT ?,id,referrer_user_id,-amount,currency,?,? FROM vx_referral_commissions WHERE order_id=? AND status='paid' AND EXISTS(SELECT 1 FROM orders WHERE id=? AND status='refunded' AND admin_note=?)").bind(crypto.randomUUID(), reason, auth.user.id, orderId,orderId,reason)
  ]);
  return Number(results[0]?.meta?.changes) === 1 ? json({ ok: true, status: 'refunded', access_revoked: true, commission_reversed: Number(results[4]?.meta?.changes) === 1, clawback_recorded: Number(results[5]?.meta?.changes) === 1 }) : json({ error: 'ออเดอร์ถูกเปลี่ยนสถานะไปแล้ว' }, 409);
}
