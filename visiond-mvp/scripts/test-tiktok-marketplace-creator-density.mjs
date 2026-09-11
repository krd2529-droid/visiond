import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeTikTokMarketplaceProduct } from "../functions/_tiktok_shop_api.js";

const direct = normalizeTikTokMarketplaceProduct({ product_id: "p1", content_creator_count: 12, showcase_creator_count: 34 });
assert.equal(direct.content_creator_count, 12);
assert.equal(direct.showcase_creator_count, 34);

const nested = normalizeTikTokMarketplaceProduct({ product_id: "p2", collaboration: { content_creator_count: 5, showcase_creator_count: 9 } });
assert.equal(nested.content_creator_count, 5);
assert.equal(nested.showcase_creator_count, 9);

const missing = normalizeTikTokMarketplaceProduct({ product_id: "p3" });
assert.equal(missing.content_creator_count, null);
assert.equal(missing.showcase_creator_count, null);

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
const render = client.match(/function renderMarketplaceProducts[\s\S]*?\n\}/)?.[0] || "";
assert.ok(render, "Marketplace renderer must exist");
assert.doesNotMatch(render, /ความหนาแน่นครีเอเตอร์|creatorDensity|content_creator_count|showcase_creator_count/);
assert.doesNotMatch(css, /\.creator-density/);
assert.match(render, /const columnCount = 9/);
assert.match(html, /tiktok-analyzer\.js\?v=02161/);
assert.match(html, /tiktok-analyzer\.css\?v=02101/);

console.log("TikTok Marketplace provider density retained and presentation removed: PASS");
