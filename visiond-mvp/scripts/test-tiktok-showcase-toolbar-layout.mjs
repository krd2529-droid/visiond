import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const css = read("public/tiktok-analyzer.css"), html = read("public/tiktok-analyzer.html"), client = read("public/tiktok-analyzer.js");

assert.match(css, /\.showcase-panel>\.showcase-heading\{display:grid;grid-template-columns:minmax\(260px,1fr\) auto/);
assert.match(css, /\.showcase-panel #showcaseTableControls\{display:grid;grid-template-columns:minmax\(280px,360px\) auto/);
assert.match(css, /\.showcase-panel \.showcase-tools\{margin:0 0 14px;padding:12px 14px;border:1px solid #d1eae8/);
assert.match(css, /@media\(max-width:960px\)[\s\S]*\.showcase-panel #showcaseTableControls\{width:100%;grid-template-columns:minmax\(240px,1fr\) auto/);
assert.match(css, /@media\(max-width:640px\)[\s\S]*\.showcase-panel #showcaseTableControls\{grid-template-columns:1fr\}/);
assert.match(client, /id="showcaseTableControls" class="related-table-controls"/);
assert.match(client, /<div class="showcase-tools"><label>ค้นหาสินค้า/);
assert.match(html, /tiktok-analyzer\.css\?v=02073/);

console.log("TikTok Showcase toolbar layout regression: PASS");
