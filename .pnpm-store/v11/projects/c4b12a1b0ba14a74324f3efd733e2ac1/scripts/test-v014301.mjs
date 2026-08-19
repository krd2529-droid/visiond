import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const version = read("VERSION.txt").trim();
const html = read("public/course-seller.html");
const js = read("public/course-seller.js");

assert.equal(version, "v0.14.301");
assert.doesNotMatch(html, /ยังไม่มี EP ที่เพิ่มแล้ว|กรอกรายละเอียด EP ด้านบน แล้วเพิ่มเข้าในตะกร้าคอร์สนี้/);
assert.doesNotMatch(js, /ยังไม่มี EP ที่เพิ่มแล้ว|กด “\+ สร้าง EP เพิ่ม” เพื่อเริ่มบทเรียนแรก/);
assert.match(html, /id="sellerLessonList" class="seller-lesson-list"><\/div>/);
assert.match(js, /sellerLessonList\.replaceChildren\(\)/);

console.log("v0.14.301 removes redundant empty EP notice: PASS");
