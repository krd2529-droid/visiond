import assert from "node:assert/strict";
import fs from "node:fs";

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");

assert.match(html, /<h3>ลิสคัดสินค้าของฉัน<\/h3>/);
assert.doesNotMatch(html, /Ranking สินค้า 40 รายการ/);
assert.equal(read("VERSION.txt").trim(), "v0.20.49");

console.log("TikTok personal product-list title regression: PASS");
