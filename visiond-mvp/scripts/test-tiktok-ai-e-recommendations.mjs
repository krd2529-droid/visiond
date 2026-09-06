import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");

assert.match(html, /direction-analysis[\s\S]*ai-recommendations/);
assert.match(html, /สินค้าแนะนำจาก AI/);
assert.match(html, /data-list="ai-recommendations"/);
assert.match(client, /String\(item\?\.product_type \|\| item\?\.grade \|\| ""\)\.toUpperCase\(\) === "E"/);
assert.match(client, /resultProductTable\(aiRecommendations, "fit_score"\)/);
assert.match(css, /\.result-grid>\.direction-analysis,\.result-grid>\.ai-recommendations/);
assert.match(html, /tiktok-analyzer\.js\?v=02119/);
assert.match(html, /tiktok-analyzer\.css\?v=02089/);

console.log("TikTok AI grade-E recommendations table: PASS");
