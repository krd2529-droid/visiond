import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");

assert.match(client, /product\.selection\?\.product_type \|\| ""/);
assert.doesNotMatch(client, /selection\?\.product_type \|\| a\.product_grade/);
assert.match(client, /index < 0 \? 6 : index/);
assert.match(client, /ยังไม่จัดเกรด — ต้องวิเคราะห์สินค้านี้ก่อน/);
assert.match(css, /\.type-pill\.type-unknown\{background:#899a99\}/);
assert.equal(read("VERSION.txt").trim(), "v0.14.597");
console.log("Showcase ungraded product regression: PASS");
