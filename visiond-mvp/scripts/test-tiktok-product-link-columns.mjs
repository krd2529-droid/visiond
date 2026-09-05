import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");

assert.match(client, /function productLinkControl\(value\)/);
assert.match(client, /data-copy-product-link/);
assert.match(client, /navigator\.clipboard\.writeText\(url\)/);
assert.match(client, /document\.execCommand\("copy"\)/);
assert.match(client, /คัดลอกลิงก์สินค้าแล้ว/);
assert.match(client, /ไม่มีลิงก์/);
assert.ok((client.match(/<th>ลิงก์สินค้า<\/th>/g) || []).length >= 5, "all dynamically named product-table renderers need a link column");
assert.ok((client.match(/productLinkControl\(/g) || []).length >= 6, "all product-table row renderers need a copy control");
assert.match(client, /upgradeLegacyProductLinkCells\(\$\("#angelProducts"\)\)/);
assert.match(client, /upgradeLegacyProductLinkCells\(\$\("#result"\)\)/);
assert.match(css, /\.copy-product-link\{/);
assert.match(html, /tiktok-analyzer\.js\?v=02100/);
assert.match(html, /tiktok-analyzer\.css\?v=02082/);

console.log("TikTok product-link copy column across product tables: PASS");
