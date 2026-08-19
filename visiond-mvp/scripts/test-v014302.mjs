import fs from "node:fs";
import assert from "node:assert/strict";

const html = fs.readFileSync(new URL("../public/course-seller.html", import.meta.url), "utf8");
const js = fs.readFileSync(new URL("../public/course-seller.js", import.meta.url), "utf8");
const version = fs.readFileSync(new URL("../VERSION.txt", import.meta.url), "utf8").trim();

assert.equal(version, "v0.14.302");
assert.match(html, /id="addSellerLesson"[^>]*>[\s\S]*?\+ เพิ่ม EP/);
assert.doesNotMatch(html, /id="addSellerLesson"[^>]*disabled/);
assert.doesNotMatch(html, /สร้าง EP เพิ่ม/);
assert.doesNotMatch(html, /สร้าง EP ใหม่/);
assert.match(js, /function showLessonDraftGate\(\)[\s\S]*?addSellerLesson\.disabled=false/);
assert.match(js, /addSellerLesson\.onclick\s*=\s*\(\)\s*=>\s*\{[\s\S]*?resetLessonEditor\([\s\S]*?false\)/);

console.log("v0.14.302 add EP button regression: PASS");
