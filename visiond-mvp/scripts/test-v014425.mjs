import fs from 'node:fs';import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),api=read('functions/api/admin/courses/[id]/payment.js'),orders=read('functions/api/orders/index.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.425');assert.match(read('public/index.html'),/WEB v0\.14\.425/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.425/);
assert.match(html,/สลับบัญชีรับเงินของคอร์สนี้ได้ตลอด/);assert.match(html,/id="coursePaymentForm"/);assert.match(html,/admin-courses\.js\?v=014425/);assert.match(html,/course\.css\?v=014425/);
assert.match(ui,/\/payment`/);assert.match(ui,/ออเดอร์ใหม่จะใช้บัญชีนี้/);assert.match(ui,/4441181181/);assert.match(api,/requireAdmin\(ctx\)/);assert.match(api,/owner_user_id IS NULL/);assert.match(api,/boss_krungsri/);assert.match(api,/profiles\.company/);assert.match(api,/444-118-1181/);
assert.match(orders,/payment_bank_name/);assert.match(orders,/paymentTarget\.bank_name/);assert.match(orders,/companyCourseItems/);
console.log('PASS v0.14.425 switch company course payment account anytime');
