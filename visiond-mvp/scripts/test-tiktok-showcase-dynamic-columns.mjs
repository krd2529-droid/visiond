import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const render = client.match(/function renderShowcaseProducts[\s\S]*?\n\}/)?.[0] || "";

assert.ok(render, "Showcase renderer must exist");
for (const key of ["grade", "sales", "commission", "gmvLatest", "gmvPrevious", "growth", "score", "reason"]) assert.match(render, new RegExp(`${key}: filtered\\.some`));
assert.match(render, /const columnCount = 2 \+ Object\.values\(columns\)\.filter\(Boolean\)\.length/);
assert.match(render, /columns\.gmvLatest \|\| columns\.gmvPrevious \|\| columns\.growth/);
assert.match(render, /<th>รูปและสินค้า<\/th>/);
assert.match(render, /<th>จัดการ<\/th>/);
assert.match(render, /colspan="\$\{columnCount\}"/);
assert.equal(read("VERSION.txt").trim(), "v0.20.49");

console.log("TikTok Showcase dynamic non-empty columns regression: PASS");
