import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("public/tiktok-analyzer.css", "utf8"), html = fs.readFileSync("public/tiktok-analyzer.html", "utf8");
assert.match(css, /\.product-table-wrap,\.shop-product-table-wrap,\.showcase-table-wrap\{border-color:#b8dedc;border-radius:12px;background:#fff\}/);
assert.match(css, /\.product-table thead th,\.shop-product-table thead th,\.showcase-table thead th\{height:46px;padding:11px 12px;border-bottom:0;background:linear-gradient\(90deg,#087e77,#079c93\);color:#fff;font-size:13px;font-weight:900;line-height:1.35;vertical-align:middle;white-space:nowrap\}/);
assert.match(html, /tiktok-analyzer\.css\?v=02085/);
console.log("TikTok Analyzer unified table-header visual system: PASS");
