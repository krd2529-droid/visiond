import { json, requireAdmin } from "../../../_lib.js";
import { putTrash } from "../../../_trash.js";

const extension = (file) => file.type === "application/zip" || file.name?.toLowerCase().endsWith(".zip") ? "zip" : "pdf";
const vision5Product = (env,id) => env.DB.prepare(`SELECT p.id FROM products p WHERE p.id=? AND (p.category='resale-rights' OR EXISTS(SELECT 1 FROM courses c WHERE c.product_id=p.id AND (c.owner_user_id IS NOT NULL OR c.course_origin='seller_rights' OR c.course_type='resale_rights')))`)
  .bind(id).first();

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const product = await ctx.env.DB.prepare("SELECT id FROM products WHERE id=?").bind(ctx.params.id).first();
  if (!product) return json({ error: "ไม่พบสินค้า กรุณาบันทึกสินค้าก่อนอัปโหลดไฟล์" }, 404);
  if (await vision5Product(ctx.env,product.id)) return json({error:"ไฟล์ของสินค้า Vision 5 ต้องจัดการผ่านหน้าระบบ Vision 5 เท่านั้น"},403);
  const form = await ctx.request.formData(), file = form.get("file");
  if (!file || typeof file.arrayBuffer !== "function" || !file.size || file.size > 100 * 1024 * 1024 || !["application/pdf", "application/zip"].includes(file.type))
    return json({ error: "ไฟล์ต้องเป็น PDF หรือ ZIP ไม่เกิน 100 MB" }, 400);
  const previous = await ctx.env.DB.prepare("SELECT * FROM product_files WHERE product_id=?").bind(product.id).all(), key = `product-${product.id}-${crypto.randomUUID()}.${extension(file)}`;
  await ctx.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  const inserted = await ctx.env.DB.prepare(
    "INSERT INTO product_files(product_id,label,object_key,mime_type,file_size,version) VALUES(?,?,?,?,?,?) RETURNING id",
  ).bind(product.id, String(form.get("label") || "ไฟล์สินค้าฉบับเต็ม"), key, file.type, file.size, "1.0").first();
  for (const old of previous.results || []) {
    await putTrash(ctx.env,{item_type:'product_file',title:old.label||'ไฟล์สินค้ารุ่นก่อน',product_id:product.id,object_key:old.object_key,payload:{label:old.label,mime_type:old.mime_type,file_size:old.file_size,version:old.version}});
    await ctx.env.DB.prepare("DELETE FROM downloads WHERE product_file_id=?").bind(old.id).run();
    await ctx.env.DB.prepare("DELETE FROM product_files WHERE id=?").bind(old.id).run();
  }
  return json({ ok: true, id: inserted.id, file_size: file.size, mime_type: file.type });
}
