import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const approval = read('functions/api/admin/course-seller-reviews/[id].js');
const catalogApi = read('functions/api/courses/index.js');
const catalogUi = read('public/home-course-catalog.js');
const orders = read('functions/api/orders/index.js');
const slip = read('functions/api/orders/[id]/slip.js');
const adminOrders = read('functions/api/admin/orders.js');
const approve = read('functions/api/admin/orders/[id]/approve.js');
const reject = read('functions/api/admin/orders/[id]/reject.js');
const adminUi = read('public/admin.js');
const memberUi = read('public/member-dashboard.js');

assert.match(read('VERSION.txt'), /v0\.14\.310/);
assert.match(approval, /review_status='approved'.*active=1/);
assert.match(approval, /productStatus:'published'/);
assert.match(catalogApi, /c\.active=1 AND p\.status='published'/);
assert.match(catalogUi, /Number\(x\.active\)===1&&x\.product_status==='published'/);

assert.match(orders, /partnerCourse=seller\?\.course_plan==='partner'/);
assert.match(orders, /seller&&!partnerCourse\?/);
assert.match(slip, /partnerCourse\?String\(ctx\.env\.EASYSLIP_API_KEY/);
assert.match(slip, /PARTNER_BOSS_REVIEW/);
assert.match(slip, /ระบบส่งให้ VisionD ตรวจ/);

assert.match(adminOrders, /boss_can_review_partner/);
assert.match(approve, /partnerCourse=order\.course_plan==='partner'/);
assert.match(approve, /boss_partner_slip_approval/);
assert.match(reject, /partnerCourse=order\.course_plan==='partner'/);
assert.match(reject, /เฉพาะ Boss ปฏิเสธสลิปคอร์สพาร์ตเนอร์ได้/);
assert.match(adminUi, /data-partner="1"/);
assert.match(adminUi, /EasySlip ตรวจไม่ผ่านอัตโนมัติ/);
assert.match(memberUi, /o\.course_plan==='partner'\?'VisionD หรือ Boss'/);

console.log('PASS v0.14.310 partner course approval, catalog, checkout, EasySlip and Boss fallback');
