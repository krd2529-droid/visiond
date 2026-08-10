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
  if (!programId || device.length < 8)
    return json({ error: "ข้อมูลโปรแกรมหรือเครื่องไม่ถูกต้อง" }, 400);
  const program = await ctx.env.DB.prepare(
    "SELECT id,trial_hours,max_devices,platform_type FROM vision7_programs WHERE id=? AND active=1",
  )
    .bind(programId)
    .first();
  if (!program) return json({ error: "ไม่พบโปรแกรม" }, 404);
  const used = await ctx.env.DB.prepare(
    "SELECT 1 used FROM vision7_trial_entitlements WHERE user_id=? AND program_id=?",
  )
    .bind(a.user.id, programId)
    .first();
  if (used)
    return json({ error: "บัญชีนี้เคยใช้สิทธิ์ทดลองของโปรแกรมนี้แล้ว" }, 409);
  const hours = Math.max(1, Math.min(168, Number(program.trial_hours) || 24)),
    expiresAt = new Date(Date.now() + hours * 3600000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19),
    out = await issueLicense(ctx.env, {
      userId: a.user.id,
      programId,
      status: "trial",
      maxDevices: Number(program.max_devices) || 3,
      source: "trial",
      createdBy: a.user.id,
      expiresAt,
    });
  const bindingState=bindingStateForProgram(program.platform_type);
  await ctx.env.DB.prepare('UPDATE vision7_licenses SET binding_state=? WHERE id=?').bind(bindingState,out.id).run();
  await ctx.env.DB.prepare(
    `INSERT INTO vision7_trial_entitlements(user_id,program_id,license_id,started_at,expires_at) VALUES(?,?,?,CURRENT_TIMESTAMP,?)`,
  )
    .bind(a.user.id, programId, out.id, expiresAt)
    .run();
  await ctx.env.DB.prepare(
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
  return json({ ok: true, key: out.key, expires_at: expiresAt }, 201);
}
