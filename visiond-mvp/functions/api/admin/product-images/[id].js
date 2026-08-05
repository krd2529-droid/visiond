import { json, requireAdmin } from "../../../_lib.js";

const imageTypes = ["image/jpeg", "image/png", "image/webp"];
const extension = (file) => file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

export async function onRequestPost(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const product = await ctx.env.DB.prepare(
    "SELECT cover_url,preview_urls FROM products WHERE id=?",
  ).bind(ctx.params.id).first();
  if (!product) return json({ error: "ไม่พบสินค้า กรุณาบันทึกสินค้าก่อนอัปโหลดรูป" }, 404);
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
    await ctx.env.FILES.delete(previous.slice("/api/media/".length));
  return json({ ok: true, slot, url });
}

export async function onRequestDelete(ctx) {
  const auth = await requireAdmin(ctx);
  if (auth.error) return auth.error;
  const product = await ctx.env.DB.prepare(
    "SELECT cover_url,preview_urls FROM products WHERE id=?",
  ).bind(ctx.params.id).first();
  if (!product) return json({ error: "ไม่พบสินค้า" }, 404);
  const slot = Math.max(0, Math.min(2, Number(new URL(ctx.request.url).searchParams.get("slot")) || 0));
  let previews = [];
  try { previews = JSON.parse(product.preview_urls || "[]"); } catch (error) { previews = []; }
  const images = [product.cover_url, previews[1], previews[2]], removed = images[slot];
  images[slot] = slot === 0 ? "/assets/product-placeholder.svg" : null;
  await ctx.env.DB.prepare(
    "UPDATE products SET cover_url=?,preview_urls=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
  ).bind(images[0], JSON.stringify(images), ctx.params.id).run();
  if (removed?.startsWith("/api/media/"))
    await ctx.env.FILES.delete(removed.slice("/api/media/".length));
  return json({ ok: true });
}
