import { json } from "../../../../_lib.js";
import { ensureDatabase } from "../../../../_schema.js";
import { ensureVision7Schema } from "../../../../_vision7_schema.js";
import { requireVision7User } from "../../../../_vision7_auth.js";
import { refreshLicenseExpiry } from "../../../../_vision7.js";

const validCode = (value) => /^[a-z0-9_-]{1,50}$/.test(String(value || ""));

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireVision7User(ctx);
  if (auth.error) return auth.error;
  const code = String(ctx.params.code || "").toLowerCase();
  if (!validCode(code)) return json({ error: "ไม่พบแอป" }, 404, { "cache-control": "no-store" });
  const program = await ctx.env.DB.prepare("SELECT id FROM vision7_programs WHERE code=? AND active=1").bind(code).first();
  if (!program) return json({ error: "ไม่พบแอป" }, 404, { "cache-control": "no-store" });
  let license = await ctx.env.DB.prepare("SELECT id,status,expires_at FROM vision7_licenses WHERE program_id=? AND user_id=? AND status IN ('active','trial') AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP) ORDER BY created_at DESC LIMIT 1").bind(program.id,auth.user.id).first();
  if (!license) {
    const owned = await ctx.env.DB.prepare("SELECT 1 owned FROM vision7_licenses WHERE program_id=? AND user_id=? LIMIT 1").bind(program.id,auth.user.id).first();
    return json({ error: owned ? "คีย์หมดอายุหรือถูกระงับ กรุณาต่ออายุสิทธิ์ก่อนดาวน์โหลด" : "ต้องซื้อคีย์และได้รับสิทธิ์ก่อนดาวน์โหลดไฟล์ติดตั้ง", code: owned ? "VISION7_LICENSE_INACTIVE" : "VISION7_LICENSE_REQUIRED" }, 403, { "cache-control": "no-store" });
  }
  license = await refreshLicenseExpiry(ctx.env, license);
  if (!["active", "trial"].includes(license.status)) return json({ error: "คีย์หมดอายุหรือถูกระงับ กรุณาต่ออายุสิทธิ์ก่อนดาวน์โหลด", code: "VISION7_LICENSE_INACTIVE", status: license.status }, 403, { "cache-control": "no-store" });
  const release = await ctx.env.DB.prepare(
    `SELECT r.object_key,r.file_name,r.mime_type,r.file_size,r.sha256,r.version
       FROM vision7_releases r
      WHERE r.program_id=? AND r.status='published'
      ORDER BY r.published_at DESC,r.id DESC LIMIT 1`,
  ).bind(program.id).first();
  if (!release) return json({ error: "ยังไม่มีไฟล์ติดตั้งสำหรับแอปนี้" }, 404, { "cache-control": "no-store" });
  const object = await ctx.env.FILES.get(release.object_key);
  if (!object) return json({ error: "ไฟล์ติดตั้งไม่พร้อมใช้งาน" }, 404, { "cache-control": "no-store" });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", release.mime_type || "application/octet-stream");
  headers.set("content-length", String(release.file_size));
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(release.file_name)}`);
  headers.set("cache-control", "private, no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("cross-origin-resource-policy", "same-site");
  headers.set("x-vision7-version", release.version);
  headers.set("x-vision7-sha256", release.sha256);
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
