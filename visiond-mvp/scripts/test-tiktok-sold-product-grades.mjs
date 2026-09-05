import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const css = read("public/tiktok-analyzer.css");

assert.match(client, /function shopSalesGrade\(sales\)/);
assert.match(client, /sold >= 30 \? "A" : sold >= 16 \? "B" : sold > 0 \? "C" : ""/);
const gradeBody = client.match(/function shopSalesGrade\(sales\) \{([\s\S]*?)\n\}/)?.[1];
assert.ok(gradeBody, "shopSalesGrade implementation must exist");
const shopSalesGrade = new Function("sales", gradeBody);
assert.equal(shopSalesGrade(49), "A");
assert.equal(shopSalesGrade(30), "A");
assert.equal(shopSalesGrade(29), "B");
assert.equal(shopSalesGrade(16), "B");
assert.equal(shopSalesGrade(15), "C");
assert.equal(shopSalesGrade(1), "C");
assert.equal(shopSalesGrade(0), "");
assert.match(client, /เกรดจากยอดออเดอร์จริงในช่วงวันที่เลือก/);
assert.match(client, /<th>เกรด<\/th>/);
assert.match(client, /type-pill type-\$\{grade\}/);
assert.match(client, /เกรด \$\{grade\} · คำนวณจาก \$\{row\.count\.toLocaleString\(\)\} ออเดอร์จริง/);
assert.match(client, /if \(!product\.analysisOnly\) return shopSalesGrade\(sales\)/);
assert.match(css, /\.shop-grade-note/);

console.log("TikTok sold-product grading regression: PASS");
