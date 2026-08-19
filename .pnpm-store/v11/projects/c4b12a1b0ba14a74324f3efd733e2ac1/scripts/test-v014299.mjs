import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const version = read("VERSION.txt").trim();
const js = read("public/course-seller.js");
const api = read("functions/api/course-seller/index.js");

assert.equal(version, "v0.14.299");
assert.match(js, /enterCourseCreatePage\(courseCreateMode\);\s*sellerMessage\.textContent = "กำลังตรวจสอบร่างคอร์สเดิม/);
assert.doesNotMatch(js, /if \(coursePlanPages\[courseCreateMode\]\) \{\s*createPanel\.hidden = false;\s*sellerCourseForm\.hidden = true;\s*createPanel\.querySelector\(":scope > h2"\)\.textContent = "กำลังโหลดตะกร้าคอร์ส/);
assert.match(js, /"\/api\/course-seller\?scope=create"/);
assert.match(js, /if \(!r\.ok\) \{[\s\S]*enterCourseCreatePage\(courseCreateMode\);[\s\S]*ฟอร์มตะกร้ายังใช้งานได้/);
assert.match(api, /searchParams\.get\("scope"\) === "create"/);
assert.match(api, /if \(createOnly\) \{[\s\S]*courses: items,[\s\S]*sales: \[\],[\s\S]*slip_issues: \[\]/);

console.log("v0.14.299 course basket load recovery: PASS");
