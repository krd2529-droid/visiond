import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/tiktok-analyzer.html");
const client = read("public/tiktok-analyzer.js");

assert.equal((html.match(/id="manualCForm"/g) || []).length, 1);
assert.equal((html.match(/id="manualCName"/g) || []).length, 1);
assert.match(html, /<article><h3>ลิสต์คัดสินค้าของฉัน<\/h3>[\s\S]*?<form id="manualCForm"[\s\S]*?<div id="productPrepSummary"/);
assert.doesNotMatch(html, /<section id="angelInventory"[\s\S]*?<form id="manualCForm"/);
assert.match(client, /\$\("#manualCForm"\)\.addEventListener\("submit"/);
assert.match(client, /button\.dataset\.setC = productName/);
assert.match(client, /button\.dataset\.productScore = "0"/);
assert.match(html, /tiktok-analyzer\.js\?v=02072/);

console.log("TikTok manual C placement regression: PASS");
