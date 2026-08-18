import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [version, index, admin, center, seller, ui, css] = await Promise.all([
  "VERSION.txt", "public/index.html", "public/admin.html", "public/course-center.html", "public/course-seller.html", "public/course-seller.js", "public/course-seller.css",
].map(read));
assert.ok(Number(version.trim().split(".").at(-1)) >= 259);
assert.match(index, /WEB v0\.14\.\d+/);
assert.match(admin, /ADMIN v0\.14\.\d+/);
assert.ok(!center.includes('class="seller-create-actions"'));
assert.match(center, /PART 1[\s\S]*PART 2[\s\S]*PART 3[\s\S]*PART 4[\s\S]*PART 5[\s\S]*PART 6/);
assert.doesNotMatch(center, /ต่อจาก PART 6/);
assert.match(ui, /data-course-plan="rights"[\s\S]*ซื้อเครดิต/);
assert.ok(ui.includes("เลือกแบบที่ต้องการก่อนสร้าง"));
for (const html of [center, seller]) {
  assert.ok(html.includes("คำอธิบายของ EP นี้"));
  assert.ok(html.includes("เอกสารแนบของ EP นี้"));
  assert.ok(html.includes("+ สร้าง EP เพิ่ม"));
  assert.ok(html.includes("ส่งคอร์สให้ Boss ตรวจ"));
}
assert.match(ui, /เพิ่ม EP พร้อมคำอธิบายและเอกสาร · ส่งตรวจ/);
assert.match(css, /\.course-plan-card-actions/);
console.log("v0.14.259 sequential course center parts: PASS");
