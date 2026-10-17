import { json, requireBoss } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { fulfillVision7Order } from '../../../_vision7_orders.js';

// Recover a paid order if its post-payment key issuance failed. No payment state is changed here.
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireBoss(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({}));
  const orderId = Number(body.order_id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) return json({ error: 'เลขออเดอร์ไม่ถูกต้อง' }, 400, { 'cache-control': 'no-store' });
  const order = await ctx.env.DB.prepare("SELECT id,user_id,status FROM orders WHERE id=? AND status='paid'").bind(orderId).first();
  if (!order) return json({ error: 'ต้องเป็นออเดอร์ที่ยืนยันชำระเงินแล้ว' }, 409, { 'cache-control': 'no-store' });
  const eligible = await ctx.env.DB.prepare("SELECT 1 found FROM order_items oi JOIN vision7_plans q ON q.product_id=oi.product_id JOIN vision7_programs p ON p.id=q.program_id WHERE oi.order_id=? AND p.code='v-record' LIMIT 1").bind(orderId).first();
  if (!eligible) return json({ error: 'ออเดอร์นี้ไม่มี V-Record' }, 404, { 'cache-control': 'no-store' });
  const fulfilled = await fulfillVision7Order(ctx.env,order,auth.user,'v-record');
  return json({ ok: true, items: fulfilled.map(item => ({ license_id: item.license_id, action: item.action, existing: Boolean(item.existing) })) }, 200, { 'cache-control': 'private, no-store' });
}
