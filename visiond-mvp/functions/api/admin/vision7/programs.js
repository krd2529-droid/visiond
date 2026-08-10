import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";
import { ensureVision7Schema } from "../../../_vision7_schema.js";
import { safeVersion, validPlanCode } from "../../../_vision7.js";
const text = (v, n = 120) =>
  String(v || "")
    .trim()
    .slice(0, n);
export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  const rows = await ctx.env.DB.prepare(
    `SELECT p.*,x.title product_title,(SELECT json_group_array(json_object('id',q.id,'code',q.plan_code,'name',q.name,'price',q.price,'product_price',(SELECT z.price FROM products z WHERE z.id=q.product_id),'duration_days',q.duration_days,'product_id',q.product_id,'active',q.active)) FROM vision7_plans q WHERE q.program_id=p.id) plans FROM vision7_programs p LEFT JOIN products x ON x.id=p.product_id ORDER BY p.updated_at DESC`,
  ).all();
  let productOptions = [], productOptionsAvailable = true;
  try {
    const options = await ctx.env.DB.prepare(
    `SELECT x.id,x.title,x.slug,x.price,x.status,x.category,
      CASE WHEN p.id IS NOT NULL THEN 'program' WHEN q.id IS NOT NULL THEN 'plan' ELSE NULL END binding_type,
      COALESCE(p.code,v.code) binding_program
     FROM products x
     LEFT JOIN vision7_programs p ON p.product_id=x.id
     LEFT JOIN vision7_plans q ON q.product_id=x.id
     LEFT JOIN vision7_programs v ON v.id=q.program_id
     WHERE x.deleted_at IS NULL ORDER BY x.id DESC`,
    ).all();
    productOptions = options.results || [];
  } catch {
    productOptionsAvailable = false;
  }
  return json({ items: rows.results || [], product_options: productOptions, product_options_available: productOptionsAvailable, product_options_error: productOptionsAvailable ? null : "VISION7_PRODUCT_OPTIONS_UNAVAILABLE" });
}

const optionalProductId = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  if ((typeof value !== "string" && typeof value !== "number") || !/^[1-9]\d*$/.test(String(value))) return NaN;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : NaN;
};
export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  const b = await ctx.request.json().catch(() => ({})),
    code = text(b.code, 50)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, ""),
    version = safeVersion(b.current_version || "1.0.0"),
    platform = ["windows", "mac", "web", "cross-platform", "veasy"].includes(String(b.platform_type)) ? String(b.platform_type) : "windows";
  if (!code || !version)
    return json({ error: "รหัสโปรแกรมหรือเวอร์ชันไม่ถูกต้อง" }, 400);
  const plans = (Array.isArray(b.plans) ? b.plans : [])
      .map((p) => ({ ...p, plan_code: validPlanCode(p.plan_code), product_id: optionalProductId(p.product_id) }))
      .filter((p) => p.plan_code),
    productId = optionalProductId(b.product_id),
    productIds = [productId, ...plans.map((p) => p.product_id)].filter(Boolean);
  if ([productId, ...plans.map((p) => p.product_id)].some(Number.isNaN))
    return json({ error: "Product ID ต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป หรือเว้นว่าง" }, 400);
  if (new Set(productIds).size !== productIds.length)
    return json({ error: "Product ID ของโปรแกรมและแพ็กเกจห้ามซ้ำกัน" }, 400);
  if (productIds.length) {
    const found = await ctx.env.DB.prepare(
      `SELECT id FROM products WHERE id IN (${productIds.map(() => "?").join(",")}) AND deleted_at IS NULL`,
    ).bind(...productIds).all();
    if ((found.results || []).length !== productIds.length)
      return json({ error: "มี Product ID ที่ไม่พบในระบบ กรุณาตรวจเลขสินค้าอีกครั้ง" }, 400);
    const used = await ctx.env.DB.prepare(
      `SELECT product_id,program_code FROM (
        SELECT p.product_id,p.code program_code FROM vision7_programs p WHERE p.product_id IS NOT NULL
        UNION ALL
        SELECT q.product_id,p.code program_code FROM vision7_plans q JOIN vision7_programs p ON p.id=q.program_id WHERE q.product_id IS NOT NULL
      ) WHERE product_id IN (${productIds.map(() => "?").join(",")}) LIMIT 1`,
    ).bind(...productIds).first();
    if (used) return json({ error: `Product ID #${used.product_id} ถูกผูกกับโปรแกรม ${used.program_code} แล้ว` }, 409);
  }
  let id = null;
  try {
    const r = await ctx.env.DB.prepare(
      `INSERT INTO vision7_programs(product_id,code,platform_type,current_version,minimum_version,requires_online,force_update,max_devices,trial_hours,active) VALUES(?,?,?,?,?,?,?,?,?,?)`,
    ).bind(productId,code,platform,version,safeVersion(b.minimum_version || version) || version,b.requires_online === false ? 0 : 1,b.force_update ? 1 : 0,3,24,b.active === false ? 0 : 1).run();
    id = Number(r.meta.last_row_id);
    for (const p of plans) {
      await ctx.env.DB.prepare(
        `INSERT INTO vision7_plans(program_id,product_id,plan_code,name,price,duration_days,active) VALUES(?,?,?,?,?,?,?)`,
      ).bind(id,p.product_id,p.plan_code,text(p.name,80) || p.plan_code,Math.max(0,Math.round(Number(p.price) || 0)),p.plan_code === "lifetime" ? null : p.plan_code === "monthly" ? 30 : 365,p.active === false ? 0 : 1).run();
    }
    return json({ ok: true, id }, 201);
  } catch (error) {
    if (id) await ctx.env.DB.prepare("DELETE FROM vision7_programs WHERE id=?").bind(id).run().catch(() => {});
    const message = String(error?.message || "");
    if (message.includes("UNIQUE")) return json({ error: "รหัสโปรแกรมหรือ Product ID นี้ถูกใช้งานแล้ว" }, 409);
    if (message.includes("FOREIGN KEY")) return json({ error: "Product ID ไม่ถูกต้องหรือไม่มีอยู่ในระบบ" }, 400);
    return json({ error: "สร้างโปรแกรมไม่สำเร็จ กรุณาลองใหม่", code: "VISION7_PROGRAM_CREATE_FAILED" }, 500);
  }
}
