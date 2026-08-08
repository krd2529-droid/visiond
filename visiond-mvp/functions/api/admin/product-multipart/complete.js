import { json, requireAdmin } from "../../../_lib.js";

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({})), key = String(body.key || ""), uploadId = String(body.upload_id || ""), productId = Number(body.product_id), size = Number(body.file_size), parts = Array.isArray(body.parts) ? body.parts : [];
  if (!/^product-\d+-[0-9a-f-]+\.(pdf|zip)$/i.test(key) || !key.startsWith(`product-${productId}-`) || !uploadId || !parts.length || size < 1 || size > 1024 * 1024 * 1024) return json({ error: "ข้อมูลการอัปโหลดไม่ถูกต้อง" }, 400);
  const product = await ctx.env.DB.prepare("SELECT id FROM products WHERE id=? AND deleted_at IS NULL").bind(productId).first();
  if (!product) return json({ error: "ไม่พบสินค้า" }, 404);
  await ctx.env.FILES.resumeMultipartUpload(key, uploadId).complete(parts.map(p => ({ partNumber: Number(p.part_number), etag: String(p.etag) })));
  const mime = key.toLowerCase().endsWith(".zip") ? "application/zip" : "application/pdf";
  const row = await ctx.env.DB.prepare("INSERT INTO product_files(product_id,label,object_key,mime_type,file_size,version) VALUES(?,?,?,?,?,?) RETURNING id").bind(productId, String(body.label || "ไฟล์สินค้าฉบับเต็ม"), key, mime, size, "1.0").first();
  return json({ ok: true, id: row.id });
}
