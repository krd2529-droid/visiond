import { json, requireAdmin } from "../../../_lib.js";

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
