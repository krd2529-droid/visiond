import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const html = read("public/course-basket-edit.html");
const js = read("public/course-basket-edit.js");
const lessonApi = read("functions/api/course-seller/[id]/lessons.js");
const lessonItemApi = read("functions/api/course-seller/[id]/lessons/[lessonId].js");

assert.equal(read("VERSION.txt").trim(), "v0.14.131");
assert.match(html, /<label>ชื่อคอร์ส<input name="title" required/);
assert.match(html, /id="basketEpisodeManager"/);
assert.match(html, /id="basketAddEpisode"[\s\S]*?\+ สร้าง EP เพิ่ม/);
assert.match(html, /id="basketEpisodeForm"/);
assert.match(html, /name="lesson_id"/);
assert.match(html, /name="video"[\s\S]*?video\/mp4,video\/webm/);
assert.match(html, /name="documents"[\s\S]*?multiple/);
assert.match(html, /course-basket-edit\.js\?v=014131/);
assert.match(js, /fetch\(`\/api\/course-seller\/\$\{id\}\/lessons`/);
assert.match(js, /method:\s*lessonId \? "PUT" : "POST"/);
assert.match(js, /data-delete-episode/);
assert.match(js, /data-delete-file/);
assert.doesNotMatch(js, /setTimeout\(\(\) => \(location\.href/);
assert.match(lessonApi, /hasPaidSale/);
assert.match(lessonApi, /หลังมียอดขาย เปลี่ยนแปลงเนื้อหาทั้งหมดไม่ได้/);
assert.match(lessonItemApi, /async function locked/);

console.log("v0.14.131 inline course basket EP manager PASS");
