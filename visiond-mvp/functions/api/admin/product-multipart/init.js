import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";

const MAX_SIZE = 1024 * 1024 * 1024;

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env);
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({}));
  const pending = body.mode === "pending", productId = Number(body.product_id), size = Number(body.file_size);
  const type = body.file_type === "application/zip" || /\.zip$/i.test(body.file_name || "") ? "application/zip" : body.file_type === "application/pdf" || /\.pdf$/i.test(body.file_name || "") ? "application/pdf" : "";
  if ((!pending && !Number.isInteger(productId)) || !type || !Number.isFinite(size) || size < 1 || size > MAX_SIZE) return json({ error: "ไฟล์ต้องเป็น PDF หรือ ZIP ไม่เกิน 1 GB" }, 400);
  if(!pending){const product = await ctx.env.DB.prepare("SELECT id FROM products WHERE id=? AND deleted_at IS NULL").bind(productId).first();if (!product) return json({ error: "ไม่พบสินค้า" }, 404)}
  const key = `${pending?'vision4-pending':`product-${productId}`}-${crypto.randomUUID()}.${type === "application/zip" ? "zip" : "pdf"}`;
  const upload = await ctx.env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: type }, customMetadata: { productId: pending?'':String(productId), fileSize: String(size), mode:pending?'pending':'product' } });
  return json({ key, upload_id: upload.uploadId, chunk_size: 50 * 1024 * 1024 });
}
