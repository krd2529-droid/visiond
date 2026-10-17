import { json, requireBoss } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { fulfillVision7Order } from '../../../_vision7_orders.js';

// Retry only SMS Mix key fulfillment for an already-paid order. Never changes payment state.
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireBoss(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({}));
  const orderId = Number(body.order_id);
  const noStore = { 'cache-control': 'private, no-store' };
  if (!Number.isSafeInteger(orderId) || orderId < 1) return json({ error: 'เลขออเดอร์ไม่ถูกต้อง' }, 400, noStore);
  const order = await ctx.env.DB.prepare("SELECT id,user_id,status FROM orders WHERE id=? AND status='paid'").bind(orderId).first();
  if (!order) return json({ error: 'ต้องเป็นออเดอร์ที่ยืนยันชำระเงินแล้ว' }, 409, noStore);
  const eligible = await ctx.env.DB.prepare("SELECT 1 found FROM order_items oi JOIN vision7_plans q ON q.product_id=oi.product_id JOIN vision7_programs p ON p.id=q.program_id WHERE oi.order_id=? AND p.code='sms-mix' LIMIT 1").bind(orderId).first();
  if (!eligible) return json({ error: 'ออเดอร์นี้ไม่มี VSMS' }, 404, noStore);
  const fulfilled = await fulfillVision7Order(ctx.env, order, auth.user, 'sms-mix');
  return json({ ok: true, items: fulfilled.map(item => ({ license_id: item.license_id, action: item.action, existing: Boolean(item.existing) })) }, 200, noStore);
}
