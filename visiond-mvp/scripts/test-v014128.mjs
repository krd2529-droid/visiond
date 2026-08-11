import fs from "node:fs";
import assert from "node:assert/strict";
const read = (file) =>
  fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const html = read("public/course-center.html"),
  editHtml = read("public/course-basket-edit.html"),
  js = read("public/course-seller.js"),
  editJs = read("public/course-basket-edit.js"),
  api = read("functions/api/course-seller/index.js"),
  editApi = read("functions/api/course-seller/[id].js"),
  flow = read("public/vision5-flow.css");
assert.equal(read("VERSION.txt").trim(), "v0.14.128");
assert.match(js, /เริ่มขายคอร์สใน 3 ขั้นตอน/);
assert.match(js, /data-v5-step="credit"/);
assert.match(js, /data-v5-step="setup"/);
assert.match(js, /data-v5-step="course"/);
assert.doesNotMatch(js, /data-v5-step="draft"/);
assert.doesNotMatch(js, /data-v5-step="bind"/);
assert.match(js, /ตั้งค่ารับเงินและตรวจสลิป/);
assert.match(js, /สร้างคอร์ส · เพิ่ม EP · เผยแพร่/);
assert.match(js, /\["pending", "approved"\]\.includes\(data\.payment_profile\?\.status\)/);
assert.doesNotMatch(html, /name="expected_episodes"/);
assert.doesNotMatch(editHtml, /name="expected_episodes"/);
assert.doesNotMatch(editJs, /expected_episodes:/);
assert.match(
  api,
  /function episodePlan\(\)\s*\{\s*return \[\{ title: "EP\.1"/s,
);
assert.match(
  editApi,
  /SELECT COUNT\(\*\) n FROM course_lessons WHERE course_id=\?/,
);
assert.match(js, /planned_lesson_count/);
assert.match(js, /สร้างแล้ว \$\{total\} EP/);
assert.match(js, /publish\.textContent = complete\s*\? "เผยแพร่"/s);
assert.match(html, /เผยแพร่ตะกร้าคอร์ส/);
assert.match(html, /Boss ตรวจอนุมัติก่อนเปิดขาย/);
assert.match(html, /https:\/\/easyslip\.com\//);
assert.match(html, /จัดการ API Token/);
assert.match(flow, /vision5-steps--compact/);
assert.match(html, /course-seller\.js\?v=014128/);
console.log("v0.14.128 Vision 5 three-step auto-EP flow PASS");
