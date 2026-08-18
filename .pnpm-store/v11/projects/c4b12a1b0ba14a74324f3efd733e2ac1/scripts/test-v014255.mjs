import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");
const [version, index, admin, ui, css] = await Promise.all([
  "VERSION.txt",
  "public/index.html",
  "public/admin.html",
  "public/course-seller.js",
  "public/course-seller.css",
].map(read));
assert.ok(Number(version.trim().split(".").pop()) >= 255);
assert.match(index, /WEB v0\.14\.\d+/);
assert.match(admin, /ADMIN v0\.14\.\d+/);
for (const token of [
  "?create=${encodeURIComponent(plan)}",
  "function enterCourseCreatePage(plan)",
  "courseCreateMode",
  "สร้างคอร์สแบบ 1",
  "สร้างคอร์สแบบ 2 ฟรี",
  "สร้างคอร์สแบบ 3 พาร์ตเนอร์",
  "select.closest(\"label\").hidden = true",
  "course-plan-legacy-form",
  "ฟอร์มสร้างคอร์สเดิมถูกย้ายมาไว้ในแบบ 1 โดยเฉพาะ",
  "หน้าสร้างแบบ 2 สำหรับเริ่มขายฟรีโดยเฉพาะ",
  "หน้าสร้างแบบ 3 สำหรับพาร์ตเนอร์ 50/50 โดยเฉพาะ",
  "?course_id=${encodeURIComponent(d.id)}",
]) assert.ok(ui.includes(token), token);
for (const plan of ["rights", "free", "partner"])
  assert.ok(ui.includes(`${plan}: {`), plan);
assert.match(css, /\.course-create-page #createPanel/);
assert.match(css, /\.course-plan-page-head/);
console.log("v0.14.255 separate course creation page per plan: PASS");
