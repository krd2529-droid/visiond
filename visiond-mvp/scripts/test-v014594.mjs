import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const api = read("functions/_tiktok_shop_api.js");
const endpoint = read("functions/api/admin/tiktok-connections/index.js");
const ui = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");
const html = read("public/tiktok-analyzer.html");

assert.match(api, /maxShowcase = 2e3/);
assert.match(api, /Math\.min\(20, maxShowcase - showcase\.length\)/);
assert.match(api, /main_image_url \|\| p\.image_url/);
assert.match(endpoint, /LIMIT 2000/);
assert.match(endpoint, /p\.image_url/);
assert.match(ui, /pageSize = 20/);
assert.match(ui, /id="showcaseSearch"/);
assert.match(ui, /product\.image_url/);
assert.match(ui, /loading="lazy"/);
assert.match(ui, /พิมพ์ชื่อหรือรหัสสินค้า/);
assert.match(css, /\.showcase-product-image/);
assert.match(css, /\.showcase-pagination/);
assert.match(html, /v0\.14\.594/);
assert.equal(read("VERSION.txt").trim(), "v0.14.594");

console.log("v0.14.594 Showcase 2,000 products, images, search and pagination checks passed");
