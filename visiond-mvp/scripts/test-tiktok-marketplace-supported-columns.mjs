import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const render = client.match(/function renderMarketplaceProducts[\s\S]*?\n\}/)?.[0] || "";
assert.match(client, /const marketplaceCategoryField = \$\("#marketplaceCategory"\)\?\.closest\("label"\);\s*if \(marketplaceCategoryField\) marketplaceCategoryField\.hidden = true;/, "Marketplace category filter must be hidden");

assert.ok(render, "Marketplace renderer must exist");
assert.doesNotMatch(render, /<th>สินค้าใหม่<\/th>/);
assert.doesNotMatch(render, /<th>ราคา<\/th>/);
assert.doesNotMatch(render, /product\.published_at/);
assert.match(render, /const columnCount = 9/);
assert.match(render, /<th>สินค้า<\/th>/);
for (const heading of ["ร้านค้า", "ขายแล้ว", "ค่าคอม", "เติบโต"]) assert.match(render, new RegExp(`<th>${heading}`));
assert.doesNotMatch(render, /ความหนาแน่นครีเอเตอร์|creatorDensity|content_creator_count|showcase_creator_count/);
for (const heading of ["รูปและสินค้า", "หมวดหมู่", "ลิงก์สินค้า", "ลิสต์คัดสินค้า"]) assert.match(render, new RegExp(`<th>${heading}`));
assert.match(render,/mode === "shop" \?/);
assert.match(render,/ข้อมูลสินค้าจาก TikTok เวลา/);

console.log("TikTok Marketplace supported columns only: PASS");
