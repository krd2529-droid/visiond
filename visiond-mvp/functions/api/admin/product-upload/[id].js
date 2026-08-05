import { json, requireAdmin } from "../../../_lib.js";

const extension = (file) => file.type === "application/zip" || file.name?.toLowerCase().endsWith(".zip") ? "zip" : "pdf";

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const product = await ctx.env.DB.prepare("SELECT id FROM products WHERE id=?").bind(ctx.params.id).first();
  if (!product) return json({ error: "ไม่พบสินค้า กรุณาบันทึกสินค้าก่อนอัปโหลดไฟล์" }, 404);
  const form = await ctx.request.formData(), file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function" || !file.size || file.size > 100 * 1024 * 1024 || !["application/pdf", "application/zip"].includes(file.type))
    return json({ error: "ไฟล์ต้องเป็น PDF หรือ ZIP ไม่เกิน 100 MB" }, 400);
  const previous = await ctx.env.DB.prepare("SELECT id,object_key FROM product_files WHERE product_id=?").bind(product.id).all(), key = `product-${product.id}-${crypto.randomUUID()}.${extension(file)}`;
  await ctx.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const inserted = await ctx.env.DB.prepare(
    "INSERT INTO product_files(product_id,label,object_key,mime_type,file_size,version) VALUES(?,?,?,?,?,?) RETURNING id",
  ).bind(product.id, String(form.get("label") || "ไฟล์สินค้าฉบับเต็ม"), key, file.type, file.size, "1.0").first();
  for (const old of previous.results || []) {
    await ctx.env.DB.prepare("DELETE FROM downloads WHERE product_file_id=?").bind(old.id).run();
    await ctx.env.DB.prepare("DELETE FROM product_files WHERE id=?").bind(old.id).run();
    await ctx.env.FILES.delete(old.object_key);
  }
  return json({ ok: true, id: inserted.id, file_size: file.size, mime_type: file.type });
}
