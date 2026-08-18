import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
assert.equal(read("VERSION.txt").trim(), "v0.14.296");
const html = read("public/course-seller.html");
const ui = read("public/course-seller.js");
for (const oldText of ["บัญชีรับเงินของเจ้าของคอร์ส", "paymentProfilePanel", "paymentProfileForm", "slipApiPanel", "slipApiForm", "สร้างร่างคอร์สพาร์ตเนอร์", "ใช้ 1 เครดิตและสร้างตะกร้าคอร์ส"]){
  assert.doesNotMatch(html, new RegExp(oldText));
  assert.doesNotMatch(ui, new RegExp(oldText));
}
assert.match(html, /บันทึกข้อมูลและไปจัดการ EP/);
assert.match(ui, /latestEditableCourse/);
assert.match(ui, /sellerCourseForm\.hidden=true/);
console.log("v0.14.296 remove legacy creator payment flow and stale create-course wording: PASS");
