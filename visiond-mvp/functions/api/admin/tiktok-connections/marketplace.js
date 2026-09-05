import { json, requireAdmin } from "../../../_lib.js";
import { ensureDatabase } from "../../../_schema.js";
import { ensureTikTokAnalyzerSchema } from "../../../_tiktok_analyzer.js";
import { normalizeTikTokMarketplaceProduct, searchTikTokShopOpenCollaborationProducts, tikTokMarketplaceGrowth } from "../../../_tiktok_shop_api.js";

const headers = { "cache-control": "private, no-store" }, clean = (value, max = 255) => String(value ?? "").trim().slice(0, max);
const optionalNumber = value => value === "" || value === null || value === undefined ? null : Number(value);
export const categoriesFromStoredProducts = rows => [...new Map(rows.flatMap(row => {
  try {
    const product = normalizeTikTokMarketplaceProduct(JSON.parse(row.raw_json || "{}"));
    return product.category_id && product.category_name ? [[product.category_id, { id: product.category_id, name: product.category_name }]] : [];
  } catch { return []; }
}).map(([id, category]) => [String(id), category])).values()].sort((left, right) => left.name.localeCompare(right.name, "th"));

export async function onRequestPost(ctx) {
  await ensureDatabase(ctx.env); await ensureTikTokAnalyzerSchema(ctx.env);
  const auth = await requireAdmin(ctx); if (auth.error) return auth.error;
  const body = await ctx.request.json().catch(() => ({})), connectionId = clean(body.connection_id, 100), channelId=clean(body.channel_id,80);
  const connection = await ctx.env.DB.prepare("SELECT * FROM tiktok_shop_creator_connections WHERE id=? AND user_id=? AND channel_id=? AND status='active'").bind(connectionId, auth.user.id, channelId).first();
  if (!connection) return json({ error: "ไม่พบบัญชี TikTok Shop Creator ที่เชื่อมอยู่" }, 404, headers);
  if (body.categories_only === true) {
    const rows = (await ctx.env.DB.prepare("SELECT raw_json FROM tiktok_shop_marketplace_snapshots WHERE connection_id=? UNION ALL SELECT raw_json FROM tiktok_shop_showcase_products WHERE connection_id=? LIMIT 4000").bind(connection.id, connection.id).all()).results || [];
    return json({ ok: true, source: "stored_tiktok_category_ids", categories: categoriesFromStoredProducts(rows) }, 200, headers);
  }
  const keywords = Array.isArray(body.keywords) ? body.keywords : clean(body.keyword) ? clean(body.keyword).split(/\s+/) : [];
  const priceMin = optionalNumber(body.price_min), priceMax = optionalNumber(body.price_max), commissionMin = optionalNumber(body.commission_percent_min), commissionMax = optionalNumber(body.commission_percent_max);
  if ([priceMin, priceMax].some(value => value !== null && (!Number.isFinite(value) || value < 0)) || (priceMin !== null && priceMax !== null && priceMin > priceMax)) return json({ error: "ช่วงราคาสินค้าไม่ถูกต้อง กรุณาตรวจราคาต่ำสุดและสูงสุด" }, 400, headers);
  if ([commissionMin, commissionMax].some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) || (commissionMin !== null && commissionMax !== null && commissionMin > commissionMax)) return json({ error: "ช่วงค่าคอมต้องอยู่ระหว่าง 0–100% และค่าต่ำสุดต้องไม่เกินค่าสูงสุด" }, 400, headers);
  try {
    const shopKeyword=clean(body.shop_keyword,300),shopSearch=Boolean(shopKeyword),comparisonDays = [3, 7, 14, 30].includes(Number(body.comparison_days)) ? Number(body.comparison_days) : 7;
    const result = await searchTikTokShopOpenCollaborationProducts(ctx.env, connection, { keywords, shopKeyword, resultLimit: body.result_limit, pageToken: body.page_token, sortField: clean(body.sort_field, 40), sortOrder: clean(body.sort_order, 10), priceMin, priceMax, categoryId: body.category_id, commissionPercentMin: commissionMin, commissionPercentMax: commissionMax });
    if(shopSearch)return json({ok:true,source:"open_collaboration_shop_products",...result},200,headers);
    const ids = result.products.map(product => product.product_id), previous = new Map();
    if (ids.length) {
      const targetModifier = `-${comparisonDays} days`, rows = (await ctx.env.DB.prepare(`SELECT s.product_id,s.units_sold,s.captured_at FROM tiktok_shop_marketplace_snapshots s WHERE s.connection_id=? AND s.product_id IN (${ids.map(() => "?").join(",")}) AND s.id=(SELECT prior.id FROM tiktok_shop_marketplace_snapshots prior WHERE prior.connection_id=s.connection_id AND prior.product_id=s.product_id AND prior.snapshot_date<=date('now',?) ORDER BY prior.snapshot_date DESC,prior.captured_at DESC,prior.id DESC LIMIT 1)`).bind(connection.id, ...ids, targetModifier).all()).results || [];
      rows.forEach(row => previous.set(String(row.product_id), row));
      await ctx.env.DB.batch(result.products.map(product => ctx.env.DB.prepare("INSERT INTO tiktok_shop_marketplace_snapshots(id,connection_id,product_id,units_sold,commission_rate,raw_json,snapshot_date,captured_at) VALUES(?,?,?,?,?,?,date('now'),CURRENT_TIMESTAMP) ON CONFLICT(connection_id,product_id,snapshot_date) DO UPDATE SET units_sold=excluded.units_sold,commission_rate=excluded.commission_rate,raw_json=excluded.raw_json,captured_at=CURRENT_TIMESTAMP").bind(crypto.randomUUID(), connection.id, product.product_id, product.units_sold, product.commission_rate, product.raw_json)));
    }
    return json({ ok: true, source: "open_collaboration_marketplace", comparison_days: comparisonDays, ...result, products: result.products.map(product => { const prior = previous.get(product.product_id); return { ...product, growth: tikTokMarketplaceGrowth(product.units_sold, prior?.units_sold), previous_snapshot_at: prior?.captured_at || null }; }) }, 200, headers);
  } catch (error) {
    const detail = clean(error?.message, 240), missingScope = detail.includes("SCOPE_CREATOR_AFFILIATE_COLLABORATION_READ");
    return json({ error: missingScope ? "ต้องเปิดสิทธิ์ creator.affiliate_collaboration.read แล้วเชื่อม TikTok Shop ใหม่" : "ค้นสินค้า Open Collaboration Marketplace ไม่สำเร็จ", detail }, missingScope ? 403 : 502, headers);
  }
}
