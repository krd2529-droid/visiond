import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const html = read("public/course-seller.html");
const js = read("public/course-seller.js");
const api = read("functions/api/course-seller/index.js");

assert.match(html, /id="sellerLessonManager"[\s\S]*data-state="waiting-course"/);
assert.doesNotMatch(html, /id="sellerLessonManager"[\s\S]{0,160}\shidden(?:\s|>)/);
assert.match(html, /id="sellerLessonIntro"/);
assert.match(html, /\+ สร้าง EP เพิ่ม/);
assert.match(html, /วิดีโอ MP4\/WEBM สูงสุด 2 GB/);
assert.match(html, /เอกสารแนบของ EP นี้/);
assert.match(html, /id="sendCourseReview"/);
assert.doesNotMatch(html, /id="closeSellerLessons"/);
assert.match(js, /function showLessonDraftGate\(\)/);
assert.match(js, /sellerLessonManager\.dataset\.state="editing"/);
assert.match(js, /addSellerLesson\.disabled=false/);
assert.doesNotMatch(api, /function episodePlan\(/);
assert.doesNotMatch(api, /INSERT INTO course_lessons[\s\S]*json_each/);
assert.match(api, /expected_episodes/);

console.log("v0.14.298 current EP workspace regression: PASS");
