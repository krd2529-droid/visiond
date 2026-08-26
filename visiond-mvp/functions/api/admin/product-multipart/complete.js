import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";
// Feature: PROD-FILE-001 — รวม multipart upload และผูกไฟล์กับตะกร้าสินค้า
const vision5Product = (env,id) => env.DB.prepare(`SELECT p.id FROM products p WHERE p.id=? AND (p.category='resale-rights' OR EXISTS(SELECT 1 FROM courses c WHERE c.product_id=p.id AND (c.owner_user_id IS NOT NULL OR c.course_origin='seller_rights' OR c.course_type='resale_rights')))`)
  .bind(id).first();

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({})), key = String(body.key || ""), uploadId = String(body.upload_id || ""), pending=body.mode==='pending', productId = Number(body.product_id), size = Number(body.file_size), parts = Array.isArray(body.parts) ? body.parts : [];
  if (!/^(?:product-\d+|vision4-pending)-[0-9a-f-]+\.(pdf|zip)$/i.test(key) || (pending?!key.startsWith('vision4-pending-'):!key.startsWith(`product-${productId}-`)) || !uploadId || !parts.length || size < 1 || size > 2 * 1024 * 1024 * 1024) return json({ error: "ข้อมูลการอัปโหลดไม่ถูกต้อง" }, 400);
  if(!pending){const product = await ctx.env.DB.prepare("SELECT id FROM products WHERE id=? AND deleted_at IS NULL").bind(productId).first();if (!product) return json({ error: "ไม่พบสินค้า" }, 404);if(await vision5Product(ctx.env,product.id))return json({error:"ไฟล์ของสินค้า Vision 5 ต้องจัดการผ่านหน้าระบบ Vision 5 เท่านั้น"},403)}
  await ctx.env.FILES.resumeMultipartUpload(key, uploadId).complete(parts.map(p => ({ partNumber: Number(p.part_number), etag: String(p.etag) })));
  const mime = key.toLowerCase().endsWith(".zip") ? "application/zip" : "application/pdf";
  const row=pending?await ctx.env.DB.prepare("INSERT INTO vision4_pending_files(file_name,object_key,mime_type,file_size,pages,status) VALUES(?,?,?,?,?,'waiting_bundle') RETURNING id").bind(String(body.file_name||'ไฟล์รอรวมชุด'),key,mime,size,Math.max(1,Number(body.pages)||1)).first():await ctx.env.DB.prepare("INSERT INTO product_files(product_id,label,object_key,mime_type,file_size,version) VALUES(?,?,?,?,?,?) RETURNING id").bind(productId, String(body.label || "ไฟล์สินค้าฉบับเต็ม"), key, mime, size, "1.0").first();
  return json({ ok: true, id: row.id });
}
