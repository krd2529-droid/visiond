import assert from "node:assert/strict";
import fs from "node:fs";

const client = fs.readFileSync(new URL("../public/tiktok-analyzer.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../functions/api/admin/tiktok-analyzer/index.js", import.meta.url), "utf8");
const html = fs.readFileSync(new URL("../public/tiktok-analyzer.html", import.meta.url), "utf8");

assert.match(client, /function decorateSoldProductSelection\(products = \[\]\)/);
assert.match(client, /sold-selection-heading">ลิสต์คัดสินค้า/);
assert.match(client, /data-select-sold-product/);
assert.match(client, /เพิ่มเข้าลิสต์คัดสินค้า/);
assert.match(client, /อยู่ในลิสต์คัดสินค้าแล้ว/);
assert.match(client, /disabled>ข้อมูลไม่พร้อม/);
assert.match(client, /sourceKind = "sold_product_selection"/);
assert.match(client, /data-product-url/);
assert.match(client, /data-product-evidence/);
assert.match(client, /data-product-grade/);
assert.match(client, /requestedGrade = button\.dataset\.productGrade \|\| "D"/);
assert.match(client, /await syncSelectedSoldProductGrades\(\)/);
assert.match(client, /action", "sync_sold_product_grades"/);
assert.match(api, /'sold_product_selection'/);
assert.match(api, /savedGrade=sourceKind==='sold_product_selection'/);
assert.match(api, /sales>=30\?'A':sales>=16\?'B':sales>0\?'C':'D'/);
assert.match(api, /source_kind='sold_product_selection'/);
assert.match(api, /เกรด \$\{savedGrade\} ตามยอดขายจริง 30 วัน/);
assert.match(html, /tiktok-analyzer\.js\?v=02117/);

console.log("TikTok sold-products selection-list column and action: PASS");
