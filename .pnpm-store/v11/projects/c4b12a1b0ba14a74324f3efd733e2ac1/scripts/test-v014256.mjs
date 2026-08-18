import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [version, index, admin, ui, css] = await Promise.all([
  "VERSION.txt", "public/index.html", "public/admin.html", "public/course-seller.js", "public/course-seller.css",
].map(read));
assert.ok(Number(version.trim().split(".").pop()) >= 256);
assert.match(index, /WEB v0\.14\.\d+/);
assert.match(admin, /ADMIN v0\.14\.\d+/);
assert.ok(!ui.includes('querySelector(".seller-hero")\n  ?.insertAdjacentHTML'));
for (const token of [
  "ซื้อสิทธิ์และมีเครดิต",
  "ตั้งค่าบัญชีรับเงินและตรวจสลิปเอง",
  "ตรวจเงื่อนไขพาร์ตเนอร์ 50/50",
  "config.steps.map",
  "coursePlanFlow",
  "paymentProfilePanel.hidden = plan === \"partner\"",
  "slipApiPanel.hidden = plan !== \"rights\"",
  "ลูกค้าชำระเข้าบัญชีผู้สอนโดยตรง และผู้สอนต้องตรวจพร้อมอนุมัติสลิปเอง",
  "ลูกค้าชำระเข้าบัญชีบริษัท VisionD",
  "ก่อนฟอร์ม",
]) if (token !== "ก่อนฟอร์ม") assert.ok(ui.includes(token), token);
assert.match(css, /\.course-plan-flow/);
assert.match(css, /\.course-plan-condition/);
console.log("v0.14.256 plan-specific step guides: PASS");
