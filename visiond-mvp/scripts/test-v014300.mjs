import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const version = read("VERSION.txt").trim();
const html = read("public/course-seller.html");
const js = read("public/course-seller.js");
const css = read("public/course-seller.css");

assert.equal(version, "v0.14.300");
assert.doesNotMatch(html, /บันทึกข้อมูลและไปจัดการ EP/);
assert.match(html, /name="duration_minutes"/);
assert.match(html, /เพิ่ม EP นี้ในตะกร้า/);
assert.match(js, /createPanel\.append\(sellerLessonManager\)/);
assert.match(js, /async function ensureCourseDraft\(\)/);
assert.match(js, /async function submitCurrentCourseForReview\(\)/);
assert.doesNotMatch(js, /sendCourseReview\.onclick=\(\)=>\{if\(activeLessonCourse\)openPublish/);
assert.match(js, /sellerCourseForm\.reportValidity\(\)/);
assert.match(js, /lessonData\.set\("duration_seconds"/);
assert.match(js, /resetLessonEditor\("",false\)/);
assert.doesNotMatch(js, /config\.steps\.map/);
assert.match(css, /seller-lesson-workspace\.seller-lesson-embedded/);

console.log("v0.14.300 unified course basket and EP flow: PASS");
