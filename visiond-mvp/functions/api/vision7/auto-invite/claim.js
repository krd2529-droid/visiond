import { json } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { requireVision7User } from '../../../_vision7_auth.js';
import { rateLimitIdentityAtomic } from '../../../_security.js';
import { autoInvitePurchase, autoInviteSigner, claimAutoInvite, ensureAutoInviteSchema, normalizeAutoInviteMachineId } from '../../../_auto_invite.js';

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireVision7User(ctx);
  if (auth.error) return auth.error;
  const limit = await rateLimitIdentityAtomic(ctx.env,'auto_invite_claim',String(auth.user.id),{limit:8,windowMinutes:1,blockMinutes:1});
  if (limit.error) return json({ error:'ขอคีย์ถี่เกินไป กรุณาลองใหม่อีกครั้งใน 1 นาที' },429,{ 'retry-after':String(limit.retryAfter),'cache-control':'private, no-store' });
  const body = await ctx.request.json().catch(() => ({}));
  const orderItemId = Number(body.order_item_id);
  const machineId = normalizeAutoInviteMachineId(body.machine_id);
  if (!Number.isSafeInteger(orderItemId) || orderItemId <= 0 || !machineId)
    return json({ error: 'กรุณากรอกรหัสเครื่องรูปแบบ XXXX-XXXX-XXXX-XXXX' }, 400, { 'cache-control': 'private, no-store' });
  await ensureAutoInviteSchema(ctx.env);
  const purchase = await autoInvitePurchase(ctx.env, orderItemId, auth.user.id);
  if (!purchase) return json({ error: 'ยังไม่พบออเดอร์ Follow me ที่ชำระเงินแล้ว' }, 403, { 'cache-control': 'private, no-store' });
  if (purchase.machine_id && purchase.machine_id !== machineId)
    return json({ error: 'คีย์นี้ผูกกับเครื่องอื่นแล้ว ไม่สามารถเปลี่ยนเครื่องได้' }, 409, { 'cache-control': 'private, no-store' });
  let signer = null;
  if (!purchase.key_ciphertext) {
    try { signer = await autoInviteSigner(ctx.env); }
    catch { return json({ error: 'ระบบออกคีย์ยังไม่พร้อม กรุณาลองใหม่ภายหลัง', code: 'AUTO_INVITE_SIGNER_UNAVAILABLE' }, 503, { 'cache-control': 'private, no-store' }); }
  }
  try {
    const result = await claimAutoInvite(ctx.env, purchase, machineId, signer);
    if (result.conflict) return json({ error: 'คีย์นี้ผูกกับเครื่องอื่นแล้ว ไม่สามารถเปลี่ยนเครื่องได้' }, 409, { 'cache-control': 'private, no-store' });
    return json({ ok: true, key: result.key, machine_id: machineId, existing: !!result.existing }, 200, { 'cache-control': 'private, no-store' });
  } catch {
    return json({ error: 'ออกคีย์ไม่สำเร็จ กรุณาลองใหม่โดยใช้รหัสเครื่องเดิม', code: 'AUTO_INVITE_CLAIM_FAILED' }, 503, { 'cache-control': 'private, no-store' });
  }
}
