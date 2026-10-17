import { json, requireUser, sha256 } from "../../_lib.js";
import { vision7LicenseEncryptionConfigured } from "../../_vision7_license_crypto.js";
import { ensureDatabase } from "../../_schema.js";
import {ensureVision7KeyCenterSchema,bindingStateForProgram} from "../../_vision7_key_center.js";
import {
  issueLicense,
  safeDeviceName,
  safePlatform,
  safeVersion,
  licenseEvent,
} from "../../_vision7.js";
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7KeyCenterSchema(ctx.env);
  const a = await requireUser(ctx);
  if (a.error) return a.error;
  if (!vision7LicenseEncryptionConfigured(ctx.env))
    return json(
      {
        error: "ระบบทดลอง Vision 7 ยังไม่ได้ตั้งค่า Secret เข้ารหัสคีย์",
        code: "VISION7_LICENSE_ENCRYPTION_NOT_CONFIGURED",
      },
      503,
    );
  const b = await ctx.request.json().catch(() => ({})),
    programId = Number(b.program_id),
    device = String(b.device_id || "").trim();
  if (!programId)
    return json({ error: "ข้อมูลโปรแกรมหรือเครื่องไม่ถูกต้อง" }, 400);
  const program = await ctx.env.DB.prepare(
    "SELECT id,code,trial_hours,max_devices,platform_type FROM vision7_programs WHERE id=? AND active=1",
  )
    .bind(programId)
    .first();
  if (!program) return json({ error: "ไม่พบโปรแกรม" }, 404);
  if (program.code === 'sms-mix') return json({ error: "VSMS เปิดใช้งานด้วยคีย์ที่ซื้อเท่านั้น" }, 403);
  if (program.code !== 'v-record' && device.length < 8) return json({ error: "ข้อมูลโปรแกรมหรือเครื่องไม่ถูกต้อง" }, 400);
  if (program.code === 'v-record' && Number(program.trial_hours) !== 168) return json({ error: "ระยะทดลอง V-Record ยังไม่พร้อม" }, 503);
  const hours = Math.max(1, Math.min(168, Number(program.trial_hours) || 24)),
    expiresAt = new Date(Date.now() + hours * 3600000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
  if (program.code === 'v-record') {
    const existing = await ctx.env.DB.prepare('SELECT 1 FROM vision7_trial_entitlements WHERE user_id=? AND program_id=?').bind(a.user.id,programId).first();
    if (existing) return json({ error: 'บัญชีนี้เคยใช้สิทธิ์ทดลองของโปรแกรมนี้แล้ว' }, 409);
    try {
      const out = await issueLicense(ctx.env, {
        userId: a.user.id, programId, status: 'trial', maxDevices: 1,
        source: 'trial', createdBy: a.user.id, expiresAt, atomicTrialHours: 168,
      });
      return json({ ok: true, key: out.key, expires_at: expiresAt }, 201, { 'cache-control': 'private, no-store' });
    } catch (error) {
      const claimed = await ctx.env.DB.prepare('SELECT 1 FROM vision7_trial_entitlements WHERE user_id=? AND program_id=?').bind(a.user.id,programId).first();
      if (claimed) return json({ error: 'บัญชีนี้เคยใช้สิทธิ์ทดลองของโปรแกรมนี้แล้ว' }, 409);
      throw error;
    }
  }
  const claim = await ctx.env.DB.prepare("INSERT INTO vision7_trial_entitlements(user_id,program_id,started_at,expires_at) VALUES(?,?,CURRENT_TIMESTAMP,?) ON CONFLICT(user_id,program_id) DO NOTHING")
    .bind(a.user.id,programId,expiresAt).run();
  if (!claim.meta?.changes) return json({ error: "บัญชีนี้เคยใช้สิทธิ์ทดลองของโปรแกรมนี้แล้ว" }, 409);
  let out;
  try { out = await issueLicense(ctx.env, {
      userId: a.user.id,
      programId,
      status: "trial",
      maxDevices: program.code === 'v-record' ? 1 : Number(program.max_devices) || 3,
      source: "trial",
      createdBy: a.user.id,
      expiresAt,
    }); } catch (error) {
      await ctx.env.DB.prepare('DELETE FROM vision7_trial_entitlements WHERE user_id=? AND program_id=? AND license_id IS NULL').bind(a.user.id,programId).run();
      throw error;
    }
  const bindingState=bindingStateForProgram(program.platform_type);
  await ctx.env.DB.prepare('UPDATE vision7_licenses SET binding_state=? WHERE id=?').bind(bindingState,out.id).run();
  await ctx.env.DB.prepare(
    `UPDATE vision7_trial_entitlements SET license_id=? WHERE user_id=? AND program_id=? AND license_id IS NULL`,
  )
    .bind(out.id,a.user.id,programId)
    .run();
  if (program.code !== 'v-record') await ctx.env.DB.prepare(
    `INSERT INTO vision7_license_devices(license_id,device_hash,device_name,platform,app_version) VALUES(?,?,?,?,?)`,
  )
    .bind(
      out.id,
      await sha256(device),
      safeDeviceName(b.device_name),
      safePlatform(b.platform),
      safeVersion(b.app_version),
    )
    .run();
  await licenseEvent(ctx.env, out.id, a.user.id, "trial_started", { hours });
  return json({ ok: true, key: out.key, expires_at: expiresAt }, 201, { 'cache-control': 'private, no-store' });
}
