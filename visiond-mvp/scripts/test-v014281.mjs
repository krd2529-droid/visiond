import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const version = read("VERSION.txt").trim();
const html = read("public/course-seller.html");
const js = read("public/course-seller.js");

assert.equal(version, "v0.14.281");
assert.match(html, /id="sendCourseReview"[^>]*disabled/);
assert.match(html, /id="sendCourseReviewHelp"/);
assert.match(js, /if\(sendCourseReview\)sendCourseReview\.disabled=!ready/);
assert.match(js, /if\(sendCourseReviewHelp\)sendCourseReviewHelp\.textContent=/);
assert.match(js, /if\(sendCourseReview\)sendCourseReview\.onclick=/);
assert.ok(js.indexOf("if(sendCourseReview)sendCourseReview.onclick") < js.lastIndexOf("load();"));
console.log("v0.14.281 course type 1 startup crash and review control: PASS");
