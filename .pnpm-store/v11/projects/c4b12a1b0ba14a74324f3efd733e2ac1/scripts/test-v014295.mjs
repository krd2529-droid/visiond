import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
assert.equal(read("VERSION.txt").trim(), "v0.14.295");
const ui = read("public/course-seller.js");
assert.match(ui, /const latestEditableCourse = !requestedId && !rememberedCourse/);
assert.match(ui, /d\.courses\.find\(\(x\) => editableStatuses\.includes\(x\.review_status\)\)/);
assert.match(ui, /const course = requestedCourse \|\| rememberedCourse \|\| latestEditableCourse/);
assert.match(ui, /sellerCourseForm\.hidden=true/);
assert.match(ui, /openLessons\(course\)/);
console.log("v0.14.295 restore latest editable course and remove stale create action: PASS");
