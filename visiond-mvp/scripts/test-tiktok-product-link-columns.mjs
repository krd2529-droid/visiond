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
assert.ok((client.match(/<th>ลิงก์สินค้า<\/th>/g) || []).length >= 4, "non-Showcase product-table renderers need a link column");
assert.ok((client.match(/productLinkControl\(/g) || []).length >= 5, "non-Showcase product-table row renderers need a copy control");
const showcaseRenderer = client.slice(client.indexOf("function renderShowcaseProducts"), client.indexOf("function marketplacePrice"));
assert.doesNotMatch(showcaseRenderer, /<th>ลิงก์สินค้า<\/th>|productLinkControl\(|target="_blank"/, "Showcase alone must not render product links");
assert.match(client, /upgradeLegacyProductLinkCells\(\$\("#angelProducts"\)\)/);
assert.match(client, /upgradeLegacyProductLinkCells\(\$\("#result"\)\)/);
assert.match(css, /\.copy-product-link\{/);
assert.match(html, /tiktok-analyzer\.js\?v=02119/);
assert.match(html, /tiktok-analyzer\.css\?v=02089/);

console.log("TikTok product-link copy column across product tables: PASS");
