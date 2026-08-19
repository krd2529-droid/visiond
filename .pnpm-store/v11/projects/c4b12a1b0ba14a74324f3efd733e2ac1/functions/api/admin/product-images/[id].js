import { json, requireAdmin } from "../../../_lib.js";
import { putTrash } from "../../../_trash.js";
// Feature: PROD-FILE-001 — จัดการรูปปกและรูปตัวอย่างของตะกร้าสินค้า

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const extension = (file) => file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
const vision5Product = (env,id) => env.DB.prepare(`SELECT p.id FROM products p WHERE p.id=? AND (p.category='resale-rights' OR EXISTS(SELECT 1 FROM courses c WHERE c.product_id=p.id AND (c.owner_user_id IS NOT NULL OR c.course_origin='seller_rights' OR c.course_type='resale_rights')))`)
  .bind(id).first();

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const product = await ctx.env.DB.prepare(
    "SELECT cover_url,preview_urls FROM products WHERE id=?",
  ).bind(ctx.params.id).first();
  if (!product) return json({ error: "ไม่พบสินค้า กรุณาบันทึกสินค้าก่อนอัปโหลดรูป" }, 404);
  if (await vision5Product(ctx.env,ctx.params.id)) return json({error:"รูปของสินค้า Vision 5 ต้องจัดการผ่านหน้าระบบ Vision 5 เท่านั้น"},403);
  const form = await ctx.request.formData(), file = form.get("file"), slot = Math.max(0, Math.min(2, Number(form.get("slot")) || 0));
  if (!file || typeof file.arrayBuffer !== "function" || !file.size || file.size > 5 * 1024 * 1024 || !imageTypes.includes(file.type))
    return json({ error: "รูปต้องเป็น JPG, PNG หรือ WEBP ไม่เกิน 5 MB" }, 400);
  let previews = [];
  try { previews = JSON.parse(product.preview_urls || "[]"); } catch (error) { previews = []; }
  const images = [product.cover_url, previews[1], previews[2]], previous = images[slot], key = `product-image-${ctx.params.id}-${slot + 1}-${crypto.randomUUID()}.${extension(file)}`, url = "/api/media/" + key;
  await ctx.env.FILES.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  images[slot] = url;
  await ctx.env.DB.prepare(
    "UPDATE products SET cover_url=?,preview_urls=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).bind(images[0] || "/assets/product-placeholder.svg", JSON.stringify(images), ctx.params.id).run();
  if (previous?.startsWith("/api/media/") && previous !== url)
    await putTrash(ctx.env,{item_type:'product_image',title:`รูปสินค้าช่อง ${slot+1} รุ่นก่อน`,product_id:Number(ctx.params.id),object_key:previous.slice('/api/media/'.length),payload:{slot}});
  return json({ ok: true, slot, url });
}

export async function onRequestDelete(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const product = await ctx.env.DB.prepare(
    "SELECT cover_url,preview_urls FROM products WHERE id=?",
  ).bind(ctx.params.id).first();
  if (!product) return json({ error: "ไม่พบสินค้า" }, 404);
  if (await vision5Product(ctx.env,ctx.params.id)) return json({error:"รูปของสินค้า Vision 5 ต้องจัดการผ่านหน้าระบบ Vision 5 เท่านั้น"},403);
  const slot = Math.max(0, Math.min(2, Number(new URL(ctx.request.url).searchParams.get("slot")) || 0));
  let previews = [];
  try { previews = JSON.parse(product.preview_urls || "[]"); } catch (error) { previews = []; }
  const images = [product.cover_url, previews[1], previews[2]], removed = images[slot];
  images[slot] = slot === 0 ? "/assets/product-placeholder.svg" : null;
  await ctx.env.DB.prepare(
    "UPDATE products SET cover_url=?,preview_urls=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).bind(images[0], JSON.stringify(images), ctx.params.id).run();
  if (removed?.startsWith("/api/media/"))
    await putTrash(ctx.env,{item_type:'product_image',title:`รูปสินค้าช่อง ${slot+1}`,product_id:Number(ctx.params.id),object_key:removed.slice('/api/media/'.length),payload:{slot}});
  return json({ ok: true });
}
