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
  for (const sql of ["ALTER TABLE vision7_licenses ADD COLUMN issuance_type TEXT NOT NULL DEFAULT 'legacy'", "ALTER TABLE vision7_licenses ADD COLUMN issue_cost INTEGER NOT NULL DEFAULT 0"]) await ctx.env.DB.prepare(sql).run().catch(() => {});
  const rows = await ctx.env.DB.prepare(
    `SELECT l.id,l.user_id,l.program_id,l.plan_id,l.order_id,l.key_last4,l.status,l.starts_at,l.expires_at,l.renewed_at,l.max_devices,l.binding_state,l.source,l.note,l.created_at,l.issuance_type,l.issue_cost,u.name user_name,u.email,p.code program_code,p.platform_type,x.title program_title,q.name plan_name,q.duration_days,COALESCE(NULLIF(l.issue_cost,0),CASE WHEN l.order_id IS NOT NULL THEN COALESCE((SELECT oi.price FROM order_items oi WHERE oi.order_id=l.order_id AND oi.product_id=q.product_id LIMIT 1),0) WHEN l.issuance_type='test' THEN 0 ELSE COALESCE(px.price,q.price,0) END,0) display_cost,COALESCE(issuer.name,issuer.username,CASE WHEN l.order_id IS NOT NULL THEN 'ระบบ/ออเดอร์' ELSE 'ระบบ' END) issuer_name,(SELECT COUNT(*) FROM vision7_license_devices d WHERE d.license_id=l.id AND d.revoked_at IS NULL) active_devices FROM vision7_licenses l JOIN users u ON u.id=l.user_id JOIN vision7_programs p ON p.id=l.program_id LEFT JOIN products x ON x.id=p.product_id LEFT JOIN vision7_plans q ON q.id=l.plan_id LEFT JOIN products px ON px.id=q.product_id LEFT JOIN users issuer ON issuer.id=l.created_by ORDER BY l.created_at DESC`,
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
    operator: { id: a.user.id, name: a.user.name || a.user.username || "Boss" },
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
    issuanceType = b.key_mode === "test" ? "test" : "customer",
    userId = issuanceType === "test" ? Number(a.user.id) : Number(b.user_id),
    programId = Number(b.program_id);
  let planId = issuanceType === "test" ? null : Number(b.plan_id) || null;
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
  let expiresAt = null, issueCost = 0;
  if (issuanceType === "test") {
    const testDuration = String(b.test_duration || "30");
    if (!new Set(["30", "365", "lifetime"]).has(testDuration)) return json({ error: "อายุคีย์ทดสอบไม่ถูกต้อง" }, 400);
    if (testDuration !== "lifetime") expiresAt = sqlTime(new Date(Date.now() + Number(testDuration) * 86400000));
  }
  if (planId) {
    const p = await ctx.env.DB.prepare(
      "SELECT q.duration_days,COALESCE(q.offer_price,x.price,q.price,0) issue_cost FROM vision7_plans q LEFT JOIN products x ON x.id=q.product_id WHERE q.id=? AND q.program_id=? AND q.active=1",
    )
      .bind(planId, programId)
      .first();
    if (!p) return json({ error: "ไม่พบแพ็กเกจ" }, 404);
    issueCost = issuanceType === "test" ? 0 : Math.max(0, Math.round(Number(p.issue_cost) || 0));
    if (p.duration_days)
      expiresAt = sqlTime(
        new Date(Date.now() + Number(p.duration_days) * 86400000),
      );
  }
  let out = null;
  try {
    out = await issueLicense(ctx.env, {
      userId,
      programId,
      planId,
      status: "active",
      maxDevices: Number(program.max_devices) || 3,
      source: "admin",
      note: text(b.note),
      createdBy: a.user.id,
      expiresAt,
      issuanceType,
      issueCost,
    });
    const bindingState = bindingStateForProgram(program.platform_type);
    await ctx.env.DB.prepare(
      "UPDATE vision7_licenses SET binding_state=? WHERE id=?",
    ).bind(bindingState, out.id).run();
    await licenseEvent(ctx.env, out.id, a.user.id, "binding_state_initialized", {
      binding_state: bindingState,
      platform_type: program.platform_type,
    });
    return json({ ok: true, license: { ...out, binding_state: bindingState } }, 201);
  } catch (error) {
    if (out?.id) await ctx.env.DB.prepare("DELETE FROM vision7_licenses WHERE id=?").bind(out.id).run().catch(() => {});
    return json({ error: "ออกคีย์ไม่สำเร็จ ระบบไม่ได้บันทึกคีย์ครึ่งรายการ", code: "VISION7_LICENSE_ISSUE_FAILED" }, 500);
  }
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
  if (action === "reset_devices") {
    const devices = (await ctx.env.DB.prepare("SELECT id,device_hash FROM vision7_license_devices WHERE license_id=? AND revoked_at IS NULL").bind(id).all()).results || [];
    const hashes = [...new Set(devices.map((device) => String(device.device_hash || "")).filter(Boolean))];
    const owner = await ctx.env.DB.prepare("SELECT user_id FROM vision7_licenses WHERE id=?").bind(id).first();
    const shops = (await ctx.env.DB.prepare("SELECT id FROM veasy_shops WHERE license_id=?").bind(id).all().catch(() => ({ results: [] }))).results || [];
    const statements = [ctx.env.DB.prepare("UPDATE vision7_license_devices SET revoked_at=CURRENT_TIMESTAMP WHERE license_id=? AND revoked_at IS NULL").bind(id)];
    for (const hash of hashes) statements.push(ctx.env.DB.prepare("UPDATE vision7_app_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE user_id=? AND device_hash=? AND revoked_at IS NULL").bind(owner.user_id, hash));
    for (const shop of shops) {
      statements.push(ctx.env.DB.prepare("DELETE FROM veasy_runtime_leases WHERE shop_id=?").bind(shop.id));
      statements.push(ctx.env.DB.prepare("DELETE FROM veasy_conversation_leases WHERE shop_id=?").bind(shop.id));
    }
    if (statements.length) await ctx.env.DB.batch(statements);
    await licenseEvent(ctx.env, id, a.user.id, "device_slots_reset_by_operator", { revoked_devices: devices.length, shop_preserved: true, reason: text(b.note) || "test_slot_reset" });
    return json({ ok: true, revoked_devices: devices.length, active_devices: 0, key_preserved: true, shop_preserved: true });
  }
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
