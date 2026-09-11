import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");
const css = read("public/tiktok-analyzer.css");

assert.doesNotMatch(html, /direction-analysis|data-field="direction"|ทิศทางช่อง/,'v92 retires only the visible direction card');
assert.match(css, /\.result-grid>\.ai-recommendations\{grid-column:1\/-1;width:100%\}/);
assert.match(html, /data-list="winners"/);
assert.match(html, /data-list="candidates"/);
assert.equal(read("VERSION.txt").trim(), "v0.20.96");

console.log("TikTok retired direction card and retained AI full-width regression: PASS");
