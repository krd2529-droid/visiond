import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
assert.equal(read("VERSION.txt").trim(), "v0.14.294");
const ui = read("public/course-seller.js");
assert.match(ui, /vd_active_course_draft_id/);
assert.match(ui, /กำลังตรวจสถานะร่างเดิมก่อนแสดงขั้นตอนถัดไป/);
assert.match(ui, /ข้อมูลร่างเดิมยังไม่ถูกลบ/);
assert.match(ui, /history\.replaceState\(null, "", `\$\{location\.pathname\}\?\$\{params\.toString\(\)\}`\)/);
assert.doesNotMatch(ui, /if \(coursePlanPages\[courseCreateMode\]\) enterCourseCreatePage\(courseCreateMode\);/);
console.log("v0.14.294 refresh-safe course review action: PASS");
