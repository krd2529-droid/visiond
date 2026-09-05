import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../public/tiktok-analyzer.css", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");
assert.match(css, /\.marketplace-search-main\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
assert.match(css, /label:nth-of-type\(1\)\{grid-column:1\/3\}/);
assert.match(css, /label:nth-of-type\(2\)\{grid-column:3\/5\}/);
assert.match(css, /label:nth-of-type\(3\)\{grid-column:1\/2\}/);
assert.match(css, /label:nth-of-type\(4\)\{grid-column:2\/3\}/);
assert.match(css, />button\{grid-column:3\/5\}/);
assert.match(css, /@media\(max-width:600px\)[\s\S]*grid-template-columns:1fr/);
assert.match(css, /\.marketplace-filters>div\{grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
assert.match(css, /\.marketplace-filters label:nth-child\(-n\+4\)\{grid-column:span 3\}/);
assert.match(css, /\.marketplace-filters label:nth-child\(n\+5\)\{grid-column:span 4\}/);
assert.match(css, /@media\(max-width:900px\)[\s\S]*\.marketplace-filters label:last-child\{grid-column:1\/-1\}/);
assert.match(css, /@media\(max-width:600px\)[\s\S]*\.marketplace-filters label:nth-child\(n\)\{grid-column:1\}/);
assert.match(html, /tiktok-analyzer\.css\?v=\d+/);
console.log("Marketplace search responsive layout regression: PASS");
