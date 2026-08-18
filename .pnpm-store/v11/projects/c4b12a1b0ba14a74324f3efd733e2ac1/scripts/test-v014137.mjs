import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read=file=>readFileSync(file,'utf8');
const payment=read('functions/api/course-seller/payment-profile.js');
const review=read('functions/api/admin/course-seller-reviews/[id].js');
const ui=read('public/course-seller.js');
const html=read('public/course-center.html');
const migration=read('migrations/0038_vision5_payout_profiles_nonblocking.sql');

assert.doesNotMatch(payment,/normalizedName|ชื่อบัญชีธนาคารต้องตรงกับชื่อ/);
assert.match(payment,/seller_payment_status='approved'/);
assert.match(payment,/status:'approved'/);
assert.doesNotMatch(review,/seller_payment_status!=='approved'/);
assert.match(ui,/<strong>พร้อมรับเงิน<\/strong>/);
assert.match(html,/ชื่อบัญชีไม่จำเป็นต้องตรงกับชื่อสมัคร/);
assert.match(html,/course-seller\.js\?v=014137/);
assert.match(migration,/seller_payment_status IN \('pending','rejected'\)/);
assert.equal(read('VERSION.txt').trim(),'v0.14.137');
console.log('v0.14.137 nonblocking Vision5 payout profile PASS');
