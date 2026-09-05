import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const select = html.match(/<select id="marketplaceComparisonDays">([\s\S]*?)<\/select>/)?.[1] || "";

assert.match(select, /<option value=["']3["'] selected>3 วัน<\/option>/);
assert.doesNotMatch(select, /<option value=["']7["'] selected>/);
assert.match(client, /marketplaceComparisonDays: 3/);
assert.match(client, /comparison_days: Number\(\$\("#marketplaceComparisonDays"\)\.value\) \|\| 3/);
assert.match(html, /tiktok-analyzer\.js\?v=02085/);

console.log("TikTok Marketplace 3-day default comparison: PASS");
