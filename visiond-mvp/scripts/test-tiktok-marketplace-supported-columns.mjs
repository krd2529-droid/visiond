import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const render = client.match(/function renderMarketplaceProducts[\s\S]*?\n\}/)?.[0] || "";

assert.ok(render, "Marketplace renderer must exist");
assert.doesNotMatch(render, /<th>สินค้าใหม่<\/th>/);
assert.doesNotMatch(render, /<th>ราคา<\/th>/);
assert.doesNotMatch(render, /product\.published_at|marketplacePrice\(product\.price\)/);
assert.match(render, /colspan="7"/);
for (const heading of ["สินค้า Open Collaboration", "ร้านค้า", "ขายแล้ว", "ค่าคอม", "ความหนาแน่นครีเอเตอร์", "เติบโต"]) assert.match(render, new RegExp(`<th>${heading}`));

console.log("TikTok Marketplace supported columns only: PASS");
