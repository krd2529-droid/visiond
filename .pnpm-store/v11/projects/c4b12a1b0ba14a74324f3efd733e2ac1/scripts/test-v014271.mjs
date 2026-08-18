import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const js = read("public/course-seller.js");
assert.equal(read("VERSION.txt").trim(), "v0.14.271");
assert.match(js, />เข้าแบบ 1 · ผู้สอนรับ 100%<\/button>/);
assert.match(js, />เข้าแบบ 2 · ผู้สอนรับ 100%<\/button>/);
assert.match(js, />เข้าแบบ 3 · ผู้สอน 50% \/ VisionD 50%<\/button>/);
console.log("v0.14.271 course plan revenue labels: PASS");
