import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");
const css = read("public/tiktok-analyzer.css");

assert.match(html, /<article class="direction-analysis"><h3>ทิศทางช่อง<\/h3><div data-field="direction"><\/div><\/article>/);
assert.match(css, /\.result-grid>\.direction-analysis\{grid-column:1\/-1;width:100%\}/);
assert.match(html, /data-list="winners"/);
assert.match(html, /data-list="candidates"/);
assert.equal(read("VERSION.txt").trim(), "v0.20.46");

console.log("TikTok channel direction full-width card regression: PASS");
