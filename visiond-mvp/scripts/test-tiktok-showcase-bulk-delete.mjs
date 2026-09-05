import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const client = read("public/tiktok-analyzer.js");
const html = read("public/tiktok-analyzer.html");

assert.match(html, /id="removeShowcasePage"[^>]*>ลบสินค้าในหน้านี้</);
assert.match(html, /id="removeShowcaseAll"[^>]*>ลบสินค้าทั้งหมด</);
assert.doesNotMatch(html, /removeShowcaseF|ลบสินค้าที่เลือกออกจาก Showcase/);
assert.doesNotMatch(client, /remove-showcase-check/);
assert.match(client, /#shopGradeList \[data-product-id\]/);
assert.match(client, /state\.showcaseProducts\.map\(\(product\) => product\.product_id\)/);
assert.match(client, /index \+= 200/);
assert.match(client, /uniqueIds\.slice\(index, index \+ 200\)/);
assert.match(client, /ย้อนกลับไม่ได้/);
assert.match(client, /ลบสำเร็จ \$\{removed\.toLocaleString\(\)\} รายการ ก่อนเกิดข้อผิดพลาด/);
assert.equal(read("VERSION.txt").trim(), "v0.20.46");

console.log("TikTok Showcase page/all deletion regression: PASS");
