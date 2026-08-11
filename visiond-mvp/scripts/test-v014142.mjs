import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(file,'utf8');
const api=read('functions/api/admin/course-seller-reviews/auto.js');
const html=read('public/admin-courses.html');
const ui=read('public/course-review-admin.js');

assert.equal(read('VERSION.txt').trim(),'v0.14.142');
assert.match(api,/requireAdmin/);
assert.match(api,/auth\.user\.role!=='boss'/);
assert.match(api,/review_status='pending'/);
assert.match(api,/review_status='approved'/);
assert.match(api,/review_status='changes_requested'/);
assert.match(api,/remaining_pending/);
assert.match(api,/seller_course_auto_review/);
assert.match(api,/MAX_BATCH=100/);
assert.doesNotMatch(api,/while\s*\(|setInterval|setTimeout/);
assert.match(html,/id="autoReviewSellerCourses"/);
assert.match(html,/อนุมัติคอร์สอัตโนมัติ/);
assert.match(html,/ไม่วนตรวจซ้ำ/);
assert.match(html,/course-review-admin\.js\?v=014142/);
assert.match(ui,/course-seller-reviews\/auto/);
assert.match(ui,/autoReview\.disabled=true/);
assert.match(ui,/รายการไม่ผ่านจะส่งกลับแก้ไขและไม่ถูกตรวจวนซ้ำ/);
assert.match(read('public/index.html'),/WEB v0\.14\.142/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.142/);

console.log('v0.14.142 course auto-review loop guard checks passed');
