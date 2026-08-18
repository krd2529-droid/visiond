import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const js = read("public/course-center.js");
assert.equal(read("VERSION.txt").trim(), "v0.14.273");
assert.match(js, /จำกัด 3 คอร์ส · คอร์สละไม่เกิน 5 EP/);
assert.match(js, /free_course_count/);
console.log("v0.14.273 free course plan limit label: PASS");
