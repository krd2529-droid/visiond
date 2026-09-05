import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync("public/tiktok-analyzer.css", "utf8"), html = fs.readFileSync("public/tiktok-analyzer.html", "utf8");
assert.match(css, /\.marketplace-panel \.showcase-table-wrap\+\.showcase-pagination\{justify-content:flex-end;margin:0;padding:14px 0 8px\}/);
assert.doesNotMatch(css, /\.marketplace-table\+\.showcase-pagination/);
assert.match(css, /\.marketplace-panel \.showcase-pagination small\{flex-basis:100%;text-align:right\}/);
assert.match(html, /tiktok-analyzer\.css\?v=02084/);
console.log("TikTok Marketplace pagination is separated below the table and right aligned: PASS");
