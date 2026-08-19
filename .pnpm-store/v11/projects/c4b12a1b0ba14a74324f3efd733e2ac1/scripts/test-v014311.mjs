import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('public/admin-courses.html');
const adminUi = read('public/admin-courses.js');
const reviewUi = read('public/course-review-admin.js');
const listApi = read('functions/api/admin/course-seller-reviews/index.js');
const autoApi = read('functions/api/admin/course-seller-reviews/auto.js');
const actionApi = read('functions/api/admin/course-seller-reviews/[id].js');

assert.match(read('VERSION.txt'), /v0\.14\.311/);
assert.match(html, /id="sellerReview"/);
assert.match(html, /ตรวจคอร์สพาร์ตเนอร์ 50\/50/);
assert.match(html, /ผู้สอน 50% \/ VisionD 50%/);
assert.match(html, /admin-courses\.js\?v=014311/);
assert.match(html, /course-review-admin\.js\?v=014311/);
assert.doesNotMatch(html, /ตรวจตะกร้าคอร์สจากสิทธิ์|sellerPaymentReviews/);

for (const api of [listApi, autoApi, actionApi]) {
  assert.match(api, /course_plan='partner'/);
}
assert.doesNotMatch(listApi, /seller_payment_status|profiles/);
assert.doesNotMatch(autoApi, /basket_binding_locked|license_entitlement_id/);
assert.doesNotMatch(actionApi, /course_right_credits|credit_refunded|คืน 1 เครดิต|ไม่อนุมัติตะกร้า/);
assert.match(actionApi, /review_status='approved'.*active=1/);
assert.match(actionApi, /productStatus:'published'/);
assert.match(actionApi, /คอร์สพาร์ตเนอร์ถูกเผยแพร่ในแคตตาล็อกคอร์ส/);

assert.match(adminUi, /course_plan==='partner'.*คอร์สพาร์ตเนอร์ 50\/50/);
assert.match(reviewUi, /พาร์ตเนอร์ 50\/50/);
assert.match(reviewUi, /อนุมัติคอร์สพาร์ตเนอร์/);
assert.doesNotMatch(reviewUi, /sellerPaymentReviews|คืน 1 เครดิต|อนุมัติตะกร้า/);

console.log('PASS v0.14.311 partner-only course review queue and approval flow');
