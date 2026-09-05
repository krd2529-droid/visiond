import { decryptChannelValue, encryptChannelValue } from "./_channel_crypto.js";
import { refreshTikTokShopToken, tikTokShopOAuthConfig } from "./_tiktok_shop_oauth.js";
const enc = new TextEncoder(), clean = (v, n = 3e3) => String(v ?? "").trim().slice(0, n), host = "https://open-api.tiktokglobalshop.com";
const hex = (bytes) => [...new Uint8Array(bytes)].map((x) => x.toString(16).padStart(2, "0")).join("");
const expiryIso = (value) => {
  const n = Math.max(0, Number(value) || 0), epoch = n > 2e9 ? Math.floor(n / 1e3) : n > 1e9 ? n : Math.floor(Date.now() / 1e3) + n;
  return new Date(epoch * 1e3).toISOString();
};
async function tikTokShopSign(path, params, body, secret) {
  const paramString = Object.keys(params).filter((k) => !["sign", "access_token"].includes(k)).sort().map((k) => `${k}${params[k]}`).join(""), input = `${secret}${path}${paramString}${body || ""}${secret}`, key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(input)));
}
async function tikTokShopRequest(config, accessToken, { path, method = "GET", query = {}, body = null }, fetchImpl = fetch) {
  const timestamp = String(Math.floor(Date.now() / 1e3)), params = { app_key: config.appKey, timestamp, ...query }, bodyText = body === null ? "" : JSON.stringify(body), sign = await tikTokShopSign(path, params, bodyText, config.appSecret), url = new URL(path, host);
  url.search = new URLSearchParams({ ...params, sign }).toString();
  const response = await fetchImpl(url, { method, headers: { "content-type": "application/json", "x-tts-access-token": accessToken }, body: bodyText || void 0, signal: AbortSignal.timeout(3e4) }), payload = await response.json().catch(() => ({}));
  if (!response.ok || Number(payload.code) !== 0) {
    const error = new Error(`TIKTOK_SHOP_API_${response.status}_${clean(payload.message || "FAILED", 160)}`);
    error.code = payload.code;
    error.requestId = payload.request_id;
    throw error;
  }
  return payload.data || {};
}
async function activeTikTokShopToken(env, connection, fetchImpl = fetch) {
  const config = tikTokShopOAuthConfig(env);
  if (!config.configured) throw new Error("TIKTOK_SHOP_NOT_CONFIGURED");
  let access = await decryptChannelValue(env, connection.access_token_ciphertext), expires = Date.parse(connection.access_expires_at), now = Date.now();
  if (expires > now + 6 * 60 * 60 * 1e3 && expires < now + 8 * 86400 * 1e3) return { config, access };
  const refresh = await decryptChannelValue(env, connection.refresh_token_ciphertext), token = await refreshTikTokShopToken(config, refresh, fetchImpl);
  access = token.access_token;
  const refreshedScopes = token.granted_scopes === undefined ? connection.scopes : Array.isArray(token.granted_scopes) ? token.granted_scopes.join(",") : clean(token.granted_scopes, 2000);
  await env.DB.prepare(`UPDATE tiktok_shop_creator_connections SET access_token_ciphertext=?,refresh_token_ciphertext=?,scopes=?,access_expires_at=?,refresh_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(await encryptChannelValue(env, access), await encryptChannelValue(env, token.refresh_token || refresh), refreshedScopes, expiryIso(token.access_token_expire_in), expiryIso(token.refresh_token_expire_in), connection.id).run();
  return { config, access };
}
const productId = (p) => clean(p.product_id || p.id, 100), productName = (p) => clean(p.product_name || p.title || p.name, 500), imageUrl = (p) => clean(p.main_image_url || p.image_url || p.main_images?.[0]?.url || p.main_images?.[0]?.url_list?.[0] || p.images?.[0]?.url || p.images?.[0]?.urls?.[0] || p.product_images?.[0]?.url || p.product_images?.[0]?.url_list?.[0] || p.main_image?.url || p.main_image?.url_list?.[0] || p.product_image?.url || p.product_image?.url_list?.[0] || p.image?.url || p.image?.url_list?.[0] || p.cover?.url || p.product?.main_image_url || p.product?.image?.url || p.product?.image?.url_list?.[0], 1500), money = (v) => v && typeof v === "object" ? { amount: clean(v.amount, 80), currency: clean(v.currency, 20), rate: Number(v.rate) || void 0 } : null;
const finiteNumber = value => { const number = Number(value); return Number.isFinite(number) ? number : 0; };
const optionalNonNegativeNumber = value => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;
const connectionScopes = connection => new Set(String(connection?.scopes || "").split(",").map(scope => scope.trim()).filter(Boolean));
const canWriteShowcase = connection => { const scopes = connectionScopes(connection); return scopes.has("creator.showcase.write") || scopes.has("creator.video.write"); };
const commissionRate = product => finiteNumber(product.commission_rate ?? product.commission?.rate ?? product.standard_commission_rate);
const marketplacePrice = product => { const value = product.sales_price || product.sale_price || product.price; if (!value || typeof value !== "object") return value || null; if (value.minimum_amount !== undefined || value.maximum_amount !== undefined) return { minimum_amount: clean(value.minimum_amount, 80), maximum_amount: clean(value.maximum_amount, 80), currency: clean(value.currency, 20) }; return money(value) || value; };
const marketplaceCategory = product => {
  const source = product.category || product.product_category || product.category_info || {}, category = Array.isArray(source) ? source.at(-1) || {} : source;
  return { id: clean(category.id || category.category_id, 100), name: clean(category.local_name || category.name || category.category_name, 300) };
};
const normalizeTikTokMarketplaceProduct = product => {
  const category = marketplaceCategory(product), shop = product.shop || product.seller || product.shop_info || {}, collaboration = product.open_collaboration || product.collaboration || {}, published = product.publish_time || product.published_at || product.create_time || product.created_at || null;
  return { product_id: productId(product), name: productName(product), image_url: imageUrl(product), product_url: clean(product.detail_link || product.product_url || product.share_url, 1500), shop_name: clean(shop.name || shop.shop_name || product.shop_name || product.seller_name, 300), published_at: published, units_sold: Math.max(0, finiteNumber(product.units_sold)), commission_rate: Math.max(0, commissionRate(product)), content_creator_count: optionalNonNegativeNumber(product.content_creator_count ?? collaboration.content_creator_count), showcase_creator_count: optionalNonNegativeNumber(product.showcase_creator_count ?? collaboration.showcase_creator_count), price: marketplacePrice(product), category_id: category.id, category_name: category.name, raw_json: JSON.stringify(product) };
};
const tikTokMarketplaceGrowth = (current, previous) => { const latest = Math.max(0, finiteNumber(current)), prior = previous === null || previous === undefined ? null : Math.max(0, finiteNumber(previous)); return { latest, previous: prior, change: prior === null ? null : latest - prior, growth_percent: prior === null ? null : prior > 0 ? (latest - prior) / prior * 100 : latest > 0 ? null : 0 }; };
const skuRows = (order) => Array.isArray(order.skus) ? order.skus : Array.isArray(order.products) ? order.products : Array.isArray(order.product_list) ? order.product_list : [], firstMoney = (row, names) => names.map((name) => money(row?.[name])).find((value) => value?.amount), sumMoney = (rows, names) => {
  const values = rows.map((row) => firstMoney(row, names)).filter(Boolean), currencies = [...new Set(values.map((x) => x.currency).filter(Boolean))];
  if (!values.length || currencies.length > 1) return null;
  return { amount: values.reduce((sum, x) => sum + (Number(x.amount) || 0), 0).toFixed(2), currency: currencies[0] || "" };
};
async function syncTikTokShopCreator(env, connection, { days = 30, maxShowcase = 100, maxOrders = 500, syncShowcase = true, syncOrders = true } = {}, fetchImpl = fetch) {
  maxShowcase = Math.min(2000, Math.max(1, Math.floor(Number(maxShowcase) || 100)));
  const { config, access } = await activeTikTokShopToken(env, connection, fetchImpl), call = (options) => tikTokShopRequest(config, access, options, fetchImpl), profile = await call({ path: "/affiliate_creator/202508/profiles" });
  let showcase = [], pageToken = "";
  while (syncShowcase && showcase.length < maxShowcase) {
    const data = await call({ path: "/affiliate_creator/202405/showcases/products", query: { page_size: String(Math.min(20, maxShowcase - showcase.length)), origin: "SHOWCASE", ...pageToken ? { page_token: pageToken } : {} } });
    showcase.push(...data.products || []);
    pageToken = clean(data.next_page_token);
    if (!pageToken) break;
  }
  const missingImageIds = showcase.filter((product) => productId(product) && !imageUrl(product)).map(productId);
  if (missingImageIds.length && String(connection.scopes || "").split(",").includes("creator.affiliate_collaboration.read")) {
    const detailsById = new Map();
    for (let index = 0; index < missingImageIds.length; index += 50) {
      try {
        const data = await call({ path: "/affiliate_creator/202509/open_collaborations/products", method: "POST", query: { product_ids: missingImageIds.slice(index, index + 50).join(",") }, body: {} });
        for (const detail of data.products || []) detailsById.set(productId(detail), detail);
      } catch (error) {
        console.warn("TIKTOK_SHOWCASE_IMAGE_ENRICHMENT_FAILED", { code: clean(error?.message, 160) });
        break;
      }
    }
    showcase = showcase.map((product) => ({ ...detailsById.get(productId(product)), ...product, main_image_url: imageUrl(product) || imageUrl(detailsById.get(productId(product)) || {}) }));
  }
  const now = Math.floor(Date.now() / 1e3), since = now - Math.min(90, Math.max(1, Number(days) || 30)) * 86400;
  let orders = [], orderToken = "";
  while (syncOrders && orders.length < maxOrders) {
    const data = await call({ path: "/affiliate_creator/202410/orders/search", method: "POST", query: { page_size: String(Math.min(100, maxOrders - orders.length)), ...orderToken ? { page_token: orderToken } : {} }, body: { create_time_ge: since, create_time_lt: now } });
    orders.push(...data.orders || []);
    orderToken = clean(data.next_page_token);
    if (!orderToken) break;
  }
  const oldGrades = new Map(((await env.DB.prepare("SELECT product_id,product_grade FROM tiktok_shop_showcase_products WHERE connection_id=?").bind(connection.id).all()).results || []).map((x) => [String(x.product_id), x.product_grade])), statements = [env.DB.prepare(`UPDATE tiktok_shop_creator_connections SET creator_username=?,creator_avatar_url=?,selection_region=?,profile_json=?,last_synced_at=CURRENT_TIMESTAMP,last_sync_error='',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(clean(profile.username, 300), clean(profile.avatar?.url, 1500), clean(profile.selection_region, 30), JSON.stringify(profile), connection.id), ...(syncShowcase?[env.DB.prepare("DELETE FROM tiktok_shop_showcase_products WHERE connection_id=?").bind(connection.id), ...showcase.filter(productId).map((p, i) => env.DB.prepare(`INSERT INTO tiktok_shop_showcase_products(connection_id,product_id,name,image_url,product_url,origin,price_json,commission_json,sort_order,raw_json,product_grade) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(connection.id, productId(p), productName(p), imageUrl(p), clean(p.detail_link || p.product_url || p.share_url, 1500), clean(p.origin, 30), JSON.stringify(money(p.sales_price) || money(p.price) || p.sales_price || p.price || null), JSON.stringify(money(p.commission) || p.commission || null), i, JSON.stringify(p), oldGrades.get(productId(p)) || "B"))]:[]), ...orders.filter((o) => clean(o.order_id || o.id, 100)).map((o) => {
    const rows = skuRows(o), ids = rows.map(productId).filter(Boolean).concat(o.product_id ? [clean(o.product_id, 100)] : []), gmv = money(o.gmv) || sumMoney(rows, ["actual_commission_base", "estimated_commission_base", "price"]), commission = money(o.commission) || sumMoney(rows, ["actual_paid_commission", "actual_commission", "estimated_paid_commission", "estimated_commission"]);
    return env.DB.prepare(`INSERT INTO tiktok_shop_affiliate_orders(connection_id,order_id,create_time,product_ids,status,gmv_json,commission_json,raw_json,synced_at) VALUES(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(connection_id,order_id) DO UPDATE SET create_time=excluded.create_time,product_ids=excluded.product_ids,status=excluded.status,gmv_json=excluded.gmv_json,commission_json=excluded.commission_json,raw_json=excluded.raw_json,synced_at=CURRENT_TIMESTAMP`).bind(connection.id, clean(o.order_id || o.id, 100), Number(o.create_time) || 0, JSON.stringify([...new Set(ids)]), clean(o.status, 80), JSON.stringify(gmv), JSON.stringify(commission), JSON.stringify(o));
  })];
  for (let i = 0; i < statements.length; i += 50) await env.DB.batch(statements.slice(i, i + 50));
  return { profile, showcaseCount: showcase.length, orderCount: orders.length, days: Math.min(90, Math.max(1, Number(days) || 30)) };
}
async function removeTikTokShopShowcaseProducts(env, connection, productIds, fetchImpl = fetch) {
  const ids = [...new Set(productIds.map((x) => clean(x, 100)).filter(Boolean))].slice(0, 200);
  if (!ids.length) throw new Error("TIKTOK_SHOP_PRODUCTS_REQUIRED");
  if (!canWriteShowcase(connection)) throw new Error("TIKTOK_SHOP_SCOPE_CREATOR_SHOWCASE_WRITE_REQUIRED");
  const { config, access } = await activeTikTokShopToken(env, connection, fetchImpl), data = await tikTokShopRequest(config, access, { path: "/affiliate_creator/202409/showcases/products", method: "DELETE", body: { product_ids: ids } }, fetchImpl);
  await env.DB.prepare(`DELETE FROM tiktok_shop_showcase_products WHERE connection_id=? AND product_id IN (${ids.map(() => "?").join(",")})`).bind(connection.id, ...ids).run();
  return { removed: ids.length, data };
}
async function addTikTokShopShowcaseProducts(env, connection, productIds, fetchImpl = fetch) {
  const ids = [...new Set(productIds.map((x) => clean(x, 100)).filter(Boolean))].slice(0, 200);
  if (!ids.length) throw new Error("TIKTOK_SHOP_PRODUCTS_REQUIRED");
  if (!canWriteShowcase(connection)) throw new Error("TIKTOK_SHOP_SCOPE_CREATOR_SHOWCASE_WRITE_REQUIRED");
  const { config, access } = await activeTikTokShopToken(env, connection, fetchImpl), batches = [], errors = [];
  for (let index = 0; index < ids.length; index += 20) {
    const productIdsBatch = ids.slice(index, index + 20), data = await tikTokShopRequest(config, access, { path: "/affiliate_creator/202405/showcases/products/add", method: "POST", body: { add_type: "PRODUCT_ID", product_ids: productIdsBatch } }, fetchImpl);
    batches.push(data);
    if (Array.isArray(data?.errors)) errors.push(...data.errors.map(error => ({ ...error, batch: Math.floor(index / 20) + 1 })));
  }
  return { requested: ids.length, added: Math.max(0, ids.length - errors.length), errors, batches };
}
async function searchTikTokShopOpenCollaborationProducts(env, connection, { keywords = [], shopKeyword = "", resultLimit = 20, pageToken = "", sortField = "units_sold", sortOrder = "DESC", priceMin = null, priceMax = null, categoryId = "", commissionPercentMin = null, commissionPercentMax = null } = {}, fetchImpl = fetch) {
  if (!String(connection.scopes || "").split(",").map(scope => scope.trim()).includes("creator.affiliate_collaboration.read")) throw new Error("TIKTOK_SHOP_SCOPE_CREATOR_AFFILIATE_COLLABORATION_READ_REQUIRED");
  const titleKeywords = (Array.isArray(keywords) ? keywords : [keywords]).map(value => clean(value, 255)).filter(Boolean).slice(0, 20), normalizedShopKeyword=clean(shopKeyword,300).toLocaleLowerCase(), allowedSortFields = new Set(["commission_rate", "product_sales_price", "commission", "units_sold"]), normalizedSort = allowedSortFields.has(sortField) ? sortField : "units_sold", limit = Math.min(100, Math.max(1, Number(resultLimit) || 20));
  const body = {}, validAmount = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0, validPercent = value => validAmount(value) && Number(value) <= 100;
  if (titleKeywords.length) body.title_keywords = titleKeywords;
  if (validAmount(priceMin) || validAmount(priceMax)) body.sales_price_range = { ...(validAmount(priceMin) ? { amount_ge: String(Number(priceMin)) } : {}), ...(validAmount(priceMax) ? { amount_lt: String(Number(priceMax)) } : {}) };
  if (clean(categoryId, 100)) body.category = { id: clean(categoryId, 100) };
  if (validPercent(commissionPercentMin) || validPercent(commissionPercentMax)) body.commission_rate_range = { ...(validPercent(commissionPercentMin) ? { rate_ge: Math.round(Number(commissionPercentMin) * 100) } : {}), ...(validPercent(commissionPercentMax) ? { rate_lt: Math.round(Number(commissionPercentMax) * 100) } : {}) };
  const { config, access } = await activeTikTokShopToken(env, connection, fetchImpl), productsById = new Map();
  let nextPageToken = clean(pageToken, 1000), totalCount = 0;
  const seenTokens = new Set(); let pages = 0;
  do {
    if (seenTokens.has(nextPageToken || "__first__")) break;
    seenTokens.add(nextPageToken || "__first__");
    pages += 1;
    const data = await tikTokShopRequest(config, access, { path: "/affiliate_creator/202405/open_collaborations/products/search", method: "POST", query: { page_size: String(Math.min(20, limit - productsById.size)), sort_field: normalizedSort, sort_order: sortOrder === "ASC" ? "ASC" : "DESC", ...(nextPageToken ? { page_token: nextPageToken } : {}) }, body }, fetchImpl);
    for (const product of (data.products || []).map(normalizeTikTokMarketplaceProduct)) {
      if (normalizedShopKeyword && !product.shop_name.toLocaleLowerCase().includes(normalizedShopKeyword)) continue;
      if (product.product_id && !productsById.has(product.product_id)) productsById.set(product.product_id, product);
    }
    nextPageToken = clean(data.next_page_token, 1000); totalCount = Math.max(totalCount, finiteNumber(data.total_count));
  } while (productsById.size < limit && nextPageToken && pages < 10);
  const products = [...productsById.values()].slice(0, limit), categories = [...new Map(products.filter(product => product.category_id && product.category_name).map(product => [product.category_id, { id: product.category_id, name: product.category_name }])).values()].sort((left, right) => left.name.localeCompare(right.name, "th"));
  return { products, categories, next_page_token: nextPageToken, total_count: Math.max(0, totalCount) };
}
export {
  activeTikTokShopToken,
  addTikTokShopShowcaseProducts,
  removeTikTokShopShowcaseProducts,
  searchTikTokShopOpenCollaborationProducts,
  syncTikTokShopCreator,
  normalizeTikTokMarketplaceProduct,
  tikTokMarketplaceGrowth,
  tikTokShopRequest,
  tikTokShopSign
};
