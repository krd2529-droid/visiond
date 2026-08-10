import { json } from "../../../../_lib.js";
import { ensureDatabase } from "../../../../_schema.js";
import { ensureVision7Schema } from "../../../../_vision7_schema.js";

const validCode = (value) => /^[a-z0-9_-]{1,50}$/.test(String(value || ""));

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const code = String(ctx.params.code || "").toLowerCase();
  if (!validCode(code)) return json({ error: "ไม่พบแอป" }, 404, { "cache-control": "public, max-age=60" });
  const release = await ctx.env.DB.prepare(
    `SELECT r.object_key,r.file_name,r.mime_type,r.file_size,r.sha256,r.version
       FROM vision7_programs p
       JOIN vision7_releases r ON r.program_id=p.id
      WHERE p.code=? AND p.active=1 AND r.status='published'
      ORDER BY r.published_at DESC,r.id DESC LIMIT 1`,
  ).bind(code).first();
  if (!release) return json({ error: "ยังไม่มีไฟล์ติดตั้งสำหรับแอปนี้" }, 404, { "cache-control": "public, max-age=60" });
  const object = await ctx.env.FILES.get(release.object_key);
  if (!object) return json({ error: "ไฟล์ติดตั้งไม่พร้อมใช้งาน" }, 404, { "cache-control": "no-store" });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("content-type", release.mime_type || "application/octet-stream");
  headers.set("content-length", String(release.file_size));
  headers.set("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(release.file_name)}`);
  headers.set("cache-control", "public, max-age=300, must-revalidate");
  headers.set("x-content-type-options", "nosniff");
  headers.set("content-security-policy", "default-src 'none'; sandbox");
  headers.set("cross-origin-resource-policy", "same-site");
  headers.set("x-vision7-version", release.version);
  headers.set("x-vision7-sha256", release.sha256);
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
