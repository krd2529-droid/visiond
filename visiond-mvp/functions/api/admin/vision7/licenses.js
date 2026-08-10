import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";
import { ensureVision7Schema } from "../../../_vision7_schema.js";
import {
  issueLicense,
  maskedLicense,
  validLicenseStatus,
  licenseEvent,
} from "../../../_vision7.js";
import { vision7LicenseEncryptionConfigured } from "../../../_vision7_license_crypto.js";
import {
  ensureVision7KeyCenterSchema,
  bindingStateForProgram,
} from "../../../_vision7_key_center.js";
const text = (v, n = 300) =>
  String(v || "")
    .normalize("NFKC")
    .trim()
    .slice(0, n);
const sqlTime = (d) => d.toISOString().replace("T", " ").slice(0, 19);
export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7KeyCenterSchema(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  const rows = await ctx.env.DB.prepare(
    `SELECT l.id,l.user_id,l.program_id,l.plan_id,l.key_last4,l.status,l.starts_at,l.expires_at,l.renewed_at,l.max_devices,l.binding_state,l.source,l.note,l.created_at,u.name user_name,u.email,p.code program_code,p.platform_type,x.title program_title,q.name plan_name,(SELECT COUNT(*) FROM vision7_license_devices d WHERE d.license_id=l.id AND d.revoked_at IS NULL) active_devices FROM vision7_licenses l JOIN users u ON u.id=l.user_id JOIN vision7_programs p ON p.id=l.program_id LEFT JOIN products x ON x.id=p.product_id LEFT JOIN vision7_plans q ON q.id=l.plan_id ORDER BY l.created_at DESC LIMIT 500`,
  ).all();
  const items = (rows.results || []).map((x) => ({
      ...x,
      key_masked: maskedLicense(x),
    })),
    summary = {
      total: items.length,
      active: items.filter((x) => x.status === "active").length,
      expired: items.filter((x) => x.status === "expired").length,
      unbound_veasy: items.filter(
        (x) => x.platform_type === "veasy" && x.binding_state === "unbound",
      ).length,
      active_devices: items.reduce(
        (n, x) => n + Number(x.active_devices || 0),
        0,
      ),
    };
  return json({
    encryption_ready: vision7LicenseEncryptionConfigured(ctx.env),
    summary,
    items,
  });
}
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7KeyCenterSchema(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  if (!vision7LicenseEncryptionConfigured(ctx.env))
    return json(
      {
        error: "ยังไม่ได้ตั้งค่า VISION7_LICENSE_ENCRYPTION_KEY",
        code: "VISION7_LICENSE_ENCRYPTION_NOT_CONFIGURED",
      },
      503,
    );
  const b = await ctx.request.json().catch(() => ({})),
    userId = Number(b.user_id),
    programId = Number(b.program_id),
    planId = Number(b.plan_id) || null;
  if (!userId || !programId)
    return json({ error: "กรุณาเลือกผู้ใช้และโปรแกรม" }, 400);
  const user = await ctx.env.DB.prepare("SELECT id FROM users WHERE id=?")
      .bind(userId)
      .first(),
    program = await ctx.env.DB.prepare(
      "SELECT id,platform_type,max_devices FROM vision7_programs WHERE id=? AND active=1",
    )
      .bind(programId)
      .first();
  if (!user || !program) return json({ error: "ไม่พบผู้ใช้หรือโปรแกรม" }, 404);
  let expiresAt = null;
  if (planId) {
    const p = await ctx.env.DB.prepare(
      "SELECT duration_days FROM vision7_plans WHERE id=? AND program_id=? AND active=1",
    )
      .bind(planId, programId)
      .first();
    if (!p) return json({ error: "ไม่พบแพ็กเกจ" }, 404);
    if (p.duration_days)
      expiresAt = sqlTime(
        new Date(Date.now() + Number(p.duration_days) * 86400000),
      );
  }
  const out = await issueLicense(ctx.env, {
    userId,
    programId,
    planId,
    status: "active",
    maxDevices: Number(program.max_devices) || 3,
    source: "admin",
    note: text(b.note),
    createdBy: a.user.id,
    expiresAt,
  });
  const bindingState = bindingStateForProgram(program.platform_type);
  await ctx.env.DB.prepare(
    "UPDATE vision7_licenses SET binding_state=? WHERE id=?",
  )
    .bind(bindingState, out.id)
    .run();
  await licenseEvent(ctx.env, out.id, a.user.id, "binding_state_initialized", {
    binding_state: bindingState,
    platform_type: program.platform_type,
  });
  return json(
    { ok: true, license: { ...out, binding_state: bindingState } },
    201,
  );
}
export async function onRequestPatch(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  const b = await ctx.request.json().catch(() => ({})),
    id = text(b.id, 80),
    action = String(b.action || "status");
  if (!id) return json({ error: "ไม่พบรหัสคีย์" }, 400);
  const license = await ctx.env.DB.prepare(
    "SELECT id,program_id,plan_id,status,expires_at FROM vision7_licenses WHERE id=?",
  )
    .bind(id)
    .first();
  if (!license) return json({ error: "ไม่พบคีย์" }, 404);
  if (action === "status") {
    const status = validLicenseStatus(b.status);
    if (!status) return json({ error: "สถานะไม่ถูกต้อง" }, 400);
    await ctx.env.DB.prepare(
      `UPDATE vision7_licenses SET status=?,note=CASE WHEN ?='' THEN note ELSE ? END,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
      .bind(status, text(b.note), text(b.note), id)
      .run();
    await licenseEvent(ctx.env, id, a.user.id, "status_changed", {
      from: license.status,
      status,
      note: text(b.note),
    });
    return json({ ok: true, status });
  }
  if (action === "renew") {
    const planId = Number(b.plan_id) || Number(license.plan_id) || 0,
      plan =
        planId &&
        (await ctx.env.DB.prepare(
          "SELECT id,duration_days,name FROM vision7_plans WHERE id=? AND program_id=? AND active=1",
        )
          .bind(planId, license.program_id)
          .first());
    if (!plan)
      return json({ error: "กรุณาเลือกแพ็กเกจต่ออายุที่ถูกต้อง" }, 400);
    let expiresAt = null;
    if (plan.duration_days) {
      const old = Date.parse(
          String(license.expires_at || "").replace(" ", "T") + "Z",
        ),
        base = Number.isFinite(old) && old > Date.now() ? old : Date.now();
      expiresAt = sqlTime(
        new Date(base + Number(plan.duration_days) * 86400000),
      );
    }
    await ctx.env.DB.prepare(
      `UPDATE vision7_licenses SET plan_id=?,status='active',expires_at=?,renewed_at=CURRENT_TIMESTAMP,note=CASE WHEN ?='' THEN note ELSE ? END,updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
      .bind(plan.id, expiresAt, text(b.note), text(b.note), id)
      .run();
    await licenseEvent(ctx.env, id, a.user.id, "renewed_by_operator", {
      plan_id: plan.id,
      plan_name: plan.name,
      duration_days: plan.duration_days,
      expires_at: expiresAt,
      note: text(b.note),
    });
    return json({ ok: true, status: "active", expires_at: expiresAt });
  }
  return json({ error: "คำสั่งจัดการคีย์ไม่ถูกต้อง" }, 400);
}
