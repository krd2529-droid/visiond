import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const ui = read("public/tiktok-analyzer.js");
const html = read("public/tiktok-analyzer.html");

assert.match(ui, /inventoryProducts/);
assert.match(ui, /inventoryByName/);
assert.match(ui, /"ABCDEF"\.indexOf/);
assert.match(ui, /selection\.product_type \|\| product\.product_grade/);
for (const column of ["เกรด", "ขายได้", "ค่าคอม", "คะแนน", "เหตุผลล่าสุด", "ตรวจครั้งถัดไป"]) assert.ok(ui.includes(column));
assert.match(html, /Showcase และตารางคัดสินค้า/);
assert.match(html, /เรียง A–F/);
assert.match(html, /v0\.14\.596/);
assert.equal(read("VERSION.txt").trim(), "v0.14.596");

console.log("v0.14.596 merged Showcase sales and A-F sorting checks passed");
