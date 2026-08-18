import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("public/course-center.html");
const js = read("public/course-center.js");
assert.equal(read("VERSION.txt").trim(), "v0.14.272");
assert.match(html, /course-center\.js\?v=014272/);
assert.doesNotMatch(html, /course-seller\.js/);
for (const removed of ["paymentProfilePanel", "slipApiPanel", "createPanel", "sellerLessonManager", "publishPanel"]) {
  assert.doesNotMatch(html, new RegExp(`id=["']${removed}["']`));
}
assert.match(html, /กำลังโหลดรูปแบบคอร์ส/);
assert.match(js, /fetch\("\/api\/course-seller", \{ cache: "no-store" \}\)/);
for (const number of [1, 2, 3]) assert.match(js, new RegExp(`เข้าแบบ ${number}`));
console.log("v0.14.272 course center single initial view: PASS");
