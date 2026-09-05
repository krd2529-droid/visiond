import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");

assert.match(client, /const orderDetailsById = new Map\(\)/);
assert.match(client, /orderDetailsById\.get\(String\(product\.product_id\)\)/);
assert.match(client, /image_url: product\.image_url \|\| product\.raw_image_url \|\| detail\.image_url/);
assert.match(client, /name: product\.name \|\| detail\.name/);
assert.doesNotMatch(client, /image_url: detail\.image_url \|\| product\.image_url/);

console.log("TikTok Showcase order-image fallback regression: PASS");
