import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const version = read("VERSION.txt").trim();
const html = read("public/course-seller.html");
const seller = read("public/course-seller.js");
const api = read("functions/api/course-seller/index.js");

assert.match(version, /^v0\.14\.\d+$/);
assert.ok(Number(version.split(".").at(-1)) >= 297, "ต้องเป็นแพต v0.14.297 หรือใหม่กว่า");
for (const obsolete of [
  "public/course-draft-first-ep.js",
  "public/course-draft-first-ep.css",
  "public/course-license-dates.js",
  "public/course-license-dates.css",
  "public/course-seller-actions.js",
  "public/course-seller-create-button.js",
]) assert.equal(existsSync(obsolete), false, `${obsolete} ต้องถูกลบจริง`);

assert.doesNotMatch(html, /course-draft-first-ep|course-license-dates|course-seller-actions|course-seller-create-button/);
assert.equal((html.match(/course-seller\.js/g) || []).length, 1, "หน้า seller ต้องมี controller เดียว");
assert.match(seller, /coursePlanByNumber = \{ "1": "partner" \}/);
assert.doesNotMatch(seller, /"2": "partner"/);
assert.equal((seller.match(/sellerCourseForm\.onsubmit/g) || []).length, 1, "ฟอร์มสร้างคอร์สต้องมี submit owner เดียว");
assert.match(seller, /sellerLessonForm\.onsubmit/);
assert.match(seller, /sendCourseReview\.onclick/);
assert.doesNotMatch(api, /payment_profile|sellerTokenStatus|seller_slip_api_key/);

console.log("v0.14.297 refresh single-controller regression: PASS");
