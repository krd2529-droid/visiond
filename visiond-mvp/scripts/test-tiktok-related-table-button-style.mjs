import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const css = read("public/tiktok-analyzer.css");
const html = read("public/tiktok-analyzer.html");

assert.match(css, /\.related-table-controls button\{[^}]*min-height:42px[^}]*padding:9px 14px[^}]*border:1px solid #08aaa2[^}]*border-radius:10px[^}]*background:#fff[^}]*color:#087a75[^}]*font:inherit[^}]*font-weight:900[^}]*cursor:pointer/);
assert.match(css, /\.related-table-controls button:hover\{background:#e7faf8\}/);
assert.match(css, /\.related-table-controls button:disabled\{opacity:\.55;cursor:wait\}/);
assert.equal((css.match(/\.marketplace-filters>div\{grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/g) || []).length, 1);
assert.match(html, /tiktok-analyzer\.css\?v=02054/);

console.log("TikTok related-table button theme regression: PASS");
