import { json, requireBoss } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { syncVision7KeyProducts } from '../../../_vision7_key_storefront.js';

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireBoss(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({}));
  const programId = Number(body.program_id), expectedHash = String(body.apk_sha256 || '').toLowerCase();
  if (!Number.isSafeInteger(programId) || programId < 1 || body.confirm !== 'publish-vsms' || !/^[a-f0-9]{64}$/.test(expectedHash))
    return json({ error: 'ต้องยืนยันการเผยแพร่ VSMS พร้อม SHA-256 ของ APK ที่ตรวจลายเซ็นแล้ว' }, 400);
  const program = await ctx.env.DB.prepare("SELECT id,active,cover_url,platform_type,current_version,minimum_version,trial_hours,max_devices,requires_online FROM vision7_programs WHERE id=? AND code='sms-mix'").bind(programId).first();
  if (!program) return json({ error: 'ไม่พบ VSMS' }, 404);
  if (Number(program.active) !== 0) return json({ error: 'VSMS เผยแพร่แล้ว' }, 409);
  if (program.platform_type !== 'android' || program.current_version !== '0.5.2' || program.minimum_version !== '0.5.2' || Number(program.trial_hours) !== 0 || Number(program.max_devices) !== 1 || Number(program.requires_online) !== 1 || !program.cover_url)
    return json({ error: 'ข้อมูล VSMS ยังไม่พร้อม' }, 409);
  const plans = (await ctx.env.DB.prepare("SELECT plan_code,offer_price,duration_days,product_id FROM vision7_plans WHERE program_id=? AND active=1").bind(programId).all()).results || [];
  if (plans.length !== 2 || !plans.some(p => p.plan_code === 'monthly' && Number(p.offer_price) === 99900 && Number(p.duration_days) === 30 && p.product_id) || !plans.some(p => p.plan_code === 'yearly' && Number(p.offer_price) === 999900 && Number(p.duration_days) === 365 && p.product_id))
    return json({ error: 'แพ็กเกจ VSMS ยังไม่ตรงราคาและระยะเวลา' }, 409);
  const release = await ctx.env.DB.prepare("SELECT object_key,file_name,mime_type,file_size,sha256 FROM vision7_releases WHERE program_id=? AND status='published' AND version='0.5.2' ORDER BY id DESC LIMIT 1").bind(programId).first();
  if (!release || !String(release.file_name).toLowerCase().endsWith('.apk') || release.mime_type !== 'application/vnd.android.package-archive' || !Number.isSafeInteger(Number(release.file_size)) || Number(release.file_size) < 10000 || Number(release.file_size) > 95 * 1024 * 1024 || String(release.sha256).toLowerCase() !== expectedHash)
    return json({ error: 'ยังไม่มี APK VSMS ที่ตรงกับไฟล์ที่ตรวจลายเซ็นแล้ว' }, 409);
  const file = await ctx.env.FILES.head(release.object_key);
  if (!file || Number(file.size) !== Number(release.file_size) || file.customMetadata?.sha256 !== release.sha256)
    return json({ error: 'APK ในคลังไม่ครบ' }, 409);
  const activated = await ctx.env.DB.prepare("UPDATE vision7_programs SET active=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND code='sms-mix' AND active=0 AND EXISTS (SELECT 1 FROM vision7_releases WHERE program_id=? AND version='0.5.2' AND status='published' AND object_key=? AND file_size=? AND sha256=?)")
    .bind(programId, programId, release.object_key, release.file_size, release.sha256).run();
  if (Number(activated.meta?.changes) !== 1) return json({ error: 'รีลีสเปลี่ยนระหว่างตรวจสอบ' }, 409);
  try { await syncVision7KeyProducts(ctx.env, programId); }
  catch (error) {
    await ctx.env.DB.prepare("UPDATE vision7_programs SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND code='sms-mix'").bind(programId).run();
    await syncVision7KeyProducts(ctx.env, programId).catch(() => {});
    throw error;
  }
  return json({ ok: true, program_id: programId, apk_sha256: expectedHash }, 200, { 'cache-control': 'no-store' });
}
