import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const page = read("public/course-center.html");
const plans = read("functions/_course_plans.js");
const orders = read("functions/api/orders/index.js");

assert.equal(read("VERSION.txt").trim(), "v0.14.264");
assert.match(page, /ตั้งค่ารับเงินสำหรับแบบ 1 และแบบ 2/);
assert.match(page, /แบบ 3 รับเงินเข้าบัญชี VisionD และแบ่งรายได้ 50\/50/);
assert.match(page, /แบบ 3 ให้ VisionD ตรวจสลิปอัตโนมัติและหักค่าตรวจ 1 บาทจากส่วนของผู้สอน/);
assert.match(plans, /rights:.*paymentOwner:'seller'.*teacherPercent:100.*visiondPercent:0.*apiFee:0/);
assert.match(plans, /free:.*paymentOwner:'seller'.*teacherPercent:100.*visiondPercent:0.*apiFee:0/);
assert.match(plans, /partner:.*paymentOwner:'visiond'.*teacherPercent:50.*visiondPercent:50.*apiFee:100/);
assert.match(orders, /partnerCourse=seller\?\.course_plan==='partner'/);
assert.match(orders, /seller&&!partnerCourse\?/);
console.log("v0.14.264 separated course payment and slip rules: PASS");
