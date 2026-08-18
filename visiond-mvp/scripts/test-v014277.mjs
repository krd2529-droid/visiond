import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const version = read('VERSION.txt');
const plans = read('functions/_course_plans.js');
const center = read('public/course-center.js');
const seller = read('public/course-seller.js');
const api = read('functions/api/course-seller/index.js');
const lessons = read('functions/api/course-seller/[id]/lessons.js');
const catalog = read('public/courses.js') + read('public/home-course-catalog.js') + read('public/course-detail.js');
const assistant = read('public/v12-sales-assistant.js');

assert.match(version, /v0\.14\.277/);
assert.doesNotMatch(plans, /free:\s*\{/);
assert.match(plans, /partner:\{code:'partner',number:2/);
assert.match(plans, /==='free'\?COURSE_PLANS\.rights/);
assert.doesNotMatch(center, /data-course-plan="free"|เริ่มขายฟรี|แบบ 3/);
assert.match(center, /\{ rights: 1, partner: 2 \}/);
assert.doesNotMatch(seller, /data-course-plan="free"|เริ่มขายฟรี|แบบ 3|free_course_count/);
assert.match(seller, /เข้าแบบ 2 · ผู้สอน 50% \/ VisionD 50%/);
assert.match(api, /\['rights','partner'\]\.includes/);
assert.doesNotMatch(api, /free_course_count/);
assert.doesNotMatch(lessons, /course_plan\s*===\s*['"]free['"]/);
assert.doesNotMatch(catalog, /เริ่มขายฟรี|แบบ 3/);
assert.doesNotMatch(assistant, /3 รูปแบบ|v12-course-plans/);
assert.match(assistant, /2 รูปแบบ/);

console.log('v0.14.277 focused tests: PASS');
