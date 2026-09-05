import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { encryptChannelValue } from "../functions/_channel_crypto.js";
import {
  addTikTokShopShowcaseProducts,
  searchTikTokShopOpenCollaborationProducts,
  tikTokMarketplaceGrowth,
} from "../functions/_tiktok_shop_api.js";
import { onRequestPost } from "../functions/api/admin/tiktok-connections/marketplace.js";

globalThis.crypto ||= webcrypto;
globalThis.btoa ||= value => Buffer.from(value, "binary").toString("base64");
globalThis.atob ||= value => Buffer.from(value, "base64").toString("binary");

const secret = "marketplace-adversarial-encryption-key-1234567890";
const baseEnv = {
  VISIOND_CHANNEL_ENCRYPTION_KEY: secret,
  TIKTOK_SHOP_APP_KEY: "app-key",
  TIKTOK_SHOP_APP_SECRET: "app-secret",
};
const accessCiphertext = await encryptChannelValue(baseEnv, "access-token");
const connection = {
  id: "creator-1",
  user_id: 41,
  status: "active",
  scopes: "creator.affiliate_collaboration.read,creator.showcase.write",
  access_token_ciphertext: accessCiphertext,
  refresh_token_ciphertext: accessCiphertext,
  access_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

const calls = [];
const provider = async (url, options) => {
  calls.push({ url: new URL(url), options, body: JSON.parse(options.body || "{}") });
  return Response.json({ code: 0, data: { products: [{ id: "open-1", title: "สินค้าจาก Open Collaboration", units_sold: 12, commission_rate: 850, detail_link: "https://example.test/open-1" }], next_page_token: "next-open", total_count: 51 } });
};
const helperResult = await searchTikTokShopOpenCollaborationProducts(baseEnv, connection, {
  keywords: [" ของเล่นเด็ก ", "เสริมพัฒนาการ"], resultLimit: 1, pageToken: "page-2", sortField: "not_allowed", sortOrder: "sideways",
  priceMin: 100, priceMax: 900, categoryId: "kids-1", commissionPercentMin: 5, commissionPercentMax: 25,
}, provider);
assert.equal(helperResult.products[0].product_id, "open-1");
assert.equal(helperResult.next_page_token, "next-open");
assert.equal(calls.length, 1);
assert.equal(calls[0].url.pathname, "/affiliate_creator/202405/open_collaborations/products/search");
assert.doesNotMatch(calls[0].url.pathname, /showcase/i);
assert.equal(calls[0].options.method, "POST");
assert.equal(calls[0].url.searchParams.get("page_size"), "1");
assert.equal(calls[0].url.searchParams.get("page_token"), "page-2");
assert.equal(calls[0].url.searchParams.get("sort_field"), "units_sold");
assert.equal(calls[0].url.searchParams.get("sort_order"), "DESC");
assert.deepEqual(calls[0].body.title_keywords, ["ของเล่นเด็ก", "เสริมพัฒนาการ"]);
assert.deepEqual(calls[0].body.sales_price_range, { amount_ge: "100", amount_lt: "900" });
assert.deepEqual(calls[0].body.category, { id: "kids-1" });
assert.deepEqual(calls[0].body.commission_rate_range, { rate_ge: 500, rate_lt: 2500 });
const addStart = calls.length, addIds = Array.from({ length: 25 }, (_, index) => `product-${index + 1}`);
await addTikTokShopShowcaseProducts(baseEnv, connection, addIds, provider);
const addCalls = calls.slice(addStart);
assert.equal(addCalls.length, 2, "Showcase add must split the official maximum of 20 IDs per request");
assert.deepEqual(addCalls.map(call => call.url.pathname), ["/affiliate_creator/202405/showcases/products/add", "/affiliate_creator/202405/showcases/products/add"]);
assert.deepEqual(addCalls.map(call => call.body.add_type), ["PRODUCT_ID", "PRODUCT_ID"]);
assert.deepEqual(addCalls.map(call => call.body.product_ids.length), [20, 5]);
await addTikTokShopShowcaseProducts(baseEnv, { ...connection, scopes: "creator.video.write" }, ["video-scope-product"], provider);
await searchTikTokShopOpenCollaborationProducts(baseEnv, { ...connection, scopes: " creator.affiliate_collaboration.read , creator.showcase.write " }, { resultLimit: 1 }, provider);
await assert.rejects(
  () => searchTikTokShopOpenCollaborationProducts(baseEnv, { ...connection, scopes: "creator.showcase.read,creator.showcase.write" }, {}, provider),
  /AFFILIATE_COLLABORATION_READ_REQUIRED/,
);
let dedupePage = 0;
const deduped = await searchTikTokShopOpenCollaborationProducts(baseEnv, connection, { resultLimit: 2 }, async () => {
  dedupePage++;
  return Response.json({ code: 0, data: dedupePage === 1
    ? { products: [{ id: "same", title: "ซ้ำหน้าแรก", units_sold: 1 }], next_page_token: "next" }
    : { products: [{ id: "same", title: "ซ้ำหน้าสอง", units_sold: 2 }, { id: "unique", title: "รายการใหม่", units_sold: 3 }], next_page_token: "" } });
});
assert.deepEqual(deduped.products.map(item => item.product_id), ["same", "unique"], "overlapping upstream pages must be deduplicated");
assert.deepEqual(tikTokMarketplaceGrowth(12, null), { latest: 12, previous: null, change: null, growth_percent: null });
assert.deepEqual(tikTokMarketplaceGrowth(15, 12), { latest: 15, previous: 12, change: 3, growth_percent: 25 });

class Statement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    if (this.sql.includes("runtime_schema_state")) return { version: 66 };
    if (this.sql.includes("SELECT u.id")) return { id: this.db.userId, role: "admin", name: "Tester", email: "test@example.test" };
    if (this.sql.includes("FROM tiktok_shop_creator_connections WHERE id=?")) return this.args[0] === connection.id && this.args[1] === this.db.userId && connection.user_id === this.db.userId ? connection : null;
    return null;
  }
  async all() {
    if (this.sql.includes("FROM tiktok_shop_marketplace_snapshots")) return { results: this.db.historical.slice(-1) };
    return { results: [] };
  }
  async run() { return { meta: { changes: 1 } }; }
}
class Database {
  constructor(userId = 41) { this.userId = userId; this.historical = []; this.currentSnapshots = new Map(); this.snapshotWrites = 0; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    for (const statement of statements) if (statement.sql?.includes("INSERT INTO tiktok_shop_marketplace_snapshots")) {
      this.snapshotWrites++;
      this.currentSnapshots.set(statement.args[2], { product_id: statement.args[2], units_sold: statement.args[3], captured_at: "2026-09-05T00:00:00Z" });
    }
    return statements.map(() => ({ meta: { changes: 1 } }));
  }
}
const db = new Database(), originalFetch = globalThis.fetch;
let units = 20, endpointFetchCalls = 0;
globalThis.fetch = async (_url, options) => { endpointFetchCalls += 1; return Response.json({ code: 0, data: { products: [{ product_id: "market-9", product_name: "สินค้านอก Showcase", units_sold: units, commission_rate: 900 }], next_page_token: "token-2", total_count: 40 } }); };
const endpointCall = async () => onRequestPost({
  env: { ...baseEnv, DB: db },
  request: new Request("https://visiondonline.com/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { cookie: "vd_session=session", "content-type": "application/json" }, body: JSON.stringify({ connection_id: connection.id, keyword: "ของเล่น", result_limit: 1 }) }),
});
try {
  const callsBeforeInvalid = endpointFetchCalls, invalidRange = await onRequestPost({
    env: { ...baseEnv, DB: db },
    request: new Request("https://visiondonline.com/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { cookie: "vd_session=session", "content-type": "application/json" }, body: JSON.stringify({ connection_id: connection.id, price_min: 500, price_max: 100 }) }),
  });
  assert.equal(invalidRange.status, 400, "contradictory filters must be rejected before TikTok API calls");
  assert.equal(endpointFetchCalls, callsBeforeInvalid);
  const first = await endpointCall(), firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.source, "open_collaboration_marketplace");
  assert.equal(firstBody.products[0].growth.previous, null, "first snapshot must not invent growth");
  assert.equal(db.snapshotWrites, 1);
  assert.equal(db.currentSnapshots.size, 1, "same-day snapshot is one upserted row per product");
  db.historical = [{ product_id: "market-9", units_sold: 20, captured_at: "2026-08-29T00:00:00Z" }];
  units = 30;
  const secondBody = await (await endpointCall()).json();
  assert.equal(secondBody.products[0].growth.previous, 20);
  assert.equal(secondBody.products[0].growth.growth_percent, 50);
  assert.equal(db.snapshotWrites, 2);
  assert.equal(db.currentSnapshots.size, 1, "second search on the same day updates instead of duplicating snapshot rows");
  const foreign = new Database(99), denied = await onRequestPost({ env: { ...baseEnv, DB: foreign }, request: new Request("https://visiondonline.com/api/admin/tiktok-connections/marketplace", { method: "POST", headers: { cookie: "vd_session=other", "content-type": "application/json" }, body: JSON.stringify({ connection_id: connection.id }) }) });
  assert.equal(denied.status, 404, "connection lookup must be scoped to the signed-in admin");
} finally { globalThis.fetch = originalFetch; }

const uiSource = await readFile(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const uiStart = uiSource.indexOf("function marketplacePrice"), uiEnd = uiSource.indexOf("function renderShopDashboard", uiStart);
assert.ok(uiStart >= 0 && uiEnd > uiStart, "marketplace UI functions must exist");
const elements = new Map();
const element = id => elements.get(id) || elements.set(id, {
  id, value: "", hidden: false, disabled: false, textContent: "", innerHTML: "",
  querySelectorAll: () => [], querySelector: () => null, addEventListener() {},
}).get(id);
element("marketplaceKeyword").value = "สินค้า & เด็ก";
element("marketplaceSort").value = "units_sold";
element("marketplaceOrder").value = "DESC";
element("marketplaceLimit").value = "20";
element("marketplaceComparisonDays").value = "7";
element("marketplacePriceMin").value = "100";
element("marketplacePriceMax").value = "900";
element("marketplaceCategory").value = "kids-1";
element("marketplaceCommissionMin").value = "5";
element("marketplaceCommissionMax").value = "25";
let uiRequest;
const context = {
  state: { shopConnection: { id: connection.id }, marketplaceProducts: [], marketplaceNextToken: "", marketplaceSearchedAt: "" },
  $: selector => element(selector.replace(/^#/, "")),
  api: async (path, options) => { uiRequest = { path, body: JSON.parse(options.body) }; return { products: [{ product_id: "u1", name: "สินค้า <นอก Showcase>", units_sold: 1, growth: { growth_percent: null } }], next_page_token: "ui-next" }; },
  escapeHtml: value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
  safeProductImage: value => String(value || ""),
  console, Date, Number, JSON, globalThis: null,
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${uiSource.slice(uiStart, uiEnd)}\nglobalThis.__searchMarketplace=searchMarketplace;`, context);
await context.__searchMarketplace("ui-page-2");
assert.equal(uiRequest.path, "/api/admin/tiktok-connections/marketplace");
assert.equal(uiRequest.body.page_token, "ui-page-2");
assert.equal(uiRequest.body.connection_id, connection.id);
assert.equal(uiRequest.body.result_limit, 20, "UI and endpoint must use the same bounded result-limit field");
assert.equal(uiRequest.body.page_size, undefined, "legacy page_size is ignored by the endpoint");
assert.equal(uiRequest.body.price_min, "100");
assert.equal(uiRequest.body.price_max, "900");
assert.equal(uiRequest.body.category_id, "kids-1");
assert.equal(uiRequest.body.commission_percent_min, "5");
assert.equal(uiRequest.body.commission_percent_max, "25");
assert.equal(uiRequest.body.comparison_days, 7);
assert.match(element("marketplaceResults").innerHTML, /Open Collaboration/);
assert.match(element("marketplaceResults").innerHTML, /สินค้า &lt;นอก Showcase&gt;/);
assert.doesNotMatch(element("marketplaceResults").innerHTML, /data-product-id=/, "marketplace rows must not masquerade as Showcase rows");

console.log("TikTok marketplace adversarial endpoint/helper/UI regression: PASS");
