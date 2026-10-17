import { json, requireBoss } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { syncVision7KeyProducts } from '../../../_vision7_key_storefront.js';

// Final deliberate publish gate after package, signer and client E2E are verified.
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireBoss(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({}));
  const programId = Number(body.program_id);
  if (!Number.isSafeInteger(programId) || programId < 1 || body.confirm !== 'publish-v-record') return json({ error: 'ต้องยืนยันการเผยแพร่ V-Record' }, 400);
  const signer = String(ctx.env.VRECORD_LICENSE_SIGNING_PKCS8 || '');
  try { await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(signer), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']); }
  catch { return json({ error: 'ยังไม่ได้ตั้งค่า signer V-Record' }, 503); }
  const program = await ctx.env.DB.prepare("SELECT id,active,cover_url,platform_type,trial_hours,max_devices FROM vision7_programs WHERE id=? AND code='v-record'").bind(programId).first();
  if (!program) return json({ error: 'ไม่พบ V-Record' }, 404);
  if (Number(program.active) !== 0) return json({ error: 'V-Record เผยแพร่แล้ว' }, 409);
  if (program.platform_type !== 'windows' || Number(program.trial_hours) !== 168 || Number(program.max_devices) !== 1 || !program.cover_url) return json({ error: 'ข้อมูลโปรแกรมยังไม่พร้อม' }, 409);
  const plans = (await ctx.env.DB.prepare("SELECT plan_code,offer_price,duration_days,product_id FROM vision7_plans WHERE program_id=? AND active=1").bind(programId).all()).results || [];
  if (plans.length !== 2 || !plans.some(p => p.plan_code === 'monthly' && Number(p.offer_price) === 19900 && Number(p.duration_days) === 30 && p.product_id) || !plans.some(p => p.plan_code === 'yearly' && Number(p.offer_price) === 99900 && Number(p.duration_days) === 365 && p.product_id)) return json({ error: 'แพ็กเกจ V-Record ยังไม่ตรงราคาและระยะเวลา' }, 409);
  const release = await ctx.env.DB.prepare("SELECT object_key,file_size,sha256 FROM vision7_releases WHERE program_id=? AND status='published' AND version='0.6.0' ORDER BY id DESC LIMIT 1").bind(programId).first();
  if (!release || !Number.isSafeInteger(Number(release.file_size)) || Number(release.file_size) < 100000 || Number(release.file_size) > 95 * 1024 * 1024 || !/^[a-f0-9]{64}$/i.test(String(release.sha256))) return json({ error: 'ยังไม่มีแพ็กเกจ V-Record ที่พร้อมเผยแพร่' }, 409);
  const file = await ctx.env.FILES.head(release.object_key);
  if (!file || Number(file.size) !== Number(release.file_size) || file.customMetadata?.sha256 !== release.sha256) return json({ error: 'ไฟล์รีลีสในคลังไม่ครบ' }, 409);
  const activated = await ctx.env.DB.prepare("UPDATE vision7_programs SET active=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND code='v-record' AND active=0 AND EXISTS (SELECT 1 FROM vision7_releases WHERE program_id=? AND version='0.6.0' AND status='published' AND object_key=? AND file_size=? AND sha256=?)")
    .bind(programId, programId, release.object_key, release.file_size, release.sha256).run();
  if (Number(activated.meta?.changes) !== 1) return json({ error: 'รีลีสเปลี่ยนระหว่างตรวจสอบ กรุณาตรวจสอบแล้วเผยแพร่อีกครั้ง' }, 409);
  try { await syncVision7KeyProducts(ctx.env, programId); }
  catch (error) {
    await ctx.env.DB.prepare("UPDATE vision7_programs SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND code='v-record'").bind(programId).run();
    await syncVision7KeyProducts(ctx.env, programId).catch(() => {});
    throw error;
  }
  return json({ ok: true, program_id: programId }, 200, { 'cache-control': 'no-store' });
}
