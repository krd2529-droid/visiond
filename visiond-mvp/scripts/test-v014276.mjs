import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const version = readFileSync("VERSION.txt", "utf8").trim();
const js = readFileSync("public/course-seller.js", "utf8");
const css = readFileSync("public/course-seller.css", "utf8");
const html = readFileSync("public/course-seller.html", "utf8");

assert.equal(version, "v0.14.276");
assert.match(js, /sellerCourseForm\.hidden = false/);
assert.match(js, /id="startCourseForm"/);
assert.match(js, /เริ่มกรอกข้อมูลคอร์ส/);
assert.match(js, /new AbortController\(\)/);
assert.match(js, /12000/);
assert.match(js, /ลองตรวจเครดิตใหม่/);
assert.match(js, /paymentProfilePanel\.hidden = true/);
assert.match(js, /slipApiPanel\.hidden = true/);
assert.match(js, /paymentProfilePanel\.hidden = false/);
assert.match(js, /slipApiPanel\.hidden = false/);
assert.match(css, /course-credit-actions/);
assert.match(html, /id="sellerCourseForm"/);
assert.match(html, /ใช้ 1 เครดิตและสร้างตะกร้าคอร์ส/);

const immediate = js.lastIndexOf("if (coursePlanPages[courseCreateMode]) enterCourseCreatePage(courseCreateMode);");
const loadCall = js.lastIndexOf("load();");
assert.ok(immediate >= 0 && immediate < loadCall, "ต้องวาดหน้าสร้างก่อนเริ่มโหลด API");

console.log("v0.14.276 course plan 1 loading tests passed");
