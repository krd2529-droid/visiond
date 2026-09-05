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
assert.match(client, /ความหนาแน่นครีเอเตอร์/);
assert.match(client, /ไม่มีข้อมูลจาก API/);
assert.match(client, /ทำคอนเทนต์/);
assert.match(client, /เก็บ Showcase/);
assert.match(client, /colspan="7"/);
assert.match(css, /\.creator-density\{/);
assert.match(html, /tiktok-analyzer\.js\?v=02059/);

console.log("TikTok Marketplace creator density: PASS");
