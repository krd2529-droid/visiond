import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [version,index,admin,page,ui,imageInfo]=await Promise.all([read('VERSION.txt'),read('public/index.html'),read('public/admin.html'),read('public/v12-connect.html'),read('public/v12-sales-assistant.js'),stat(new URL('../public/assets/v12-course-plans-014250.jpg',import.meta.url))]);
assert.equal(version.trim(),'v0.14.250');assert.match(index,/WEB v0\.14\.250/);assert.match(admin,/ADMIN v0\.14\.250/);assert.match(page,/v0\.14\.250/);assert.match(page,/build 014250/);
for(const token of['v12UseCourseOffer','แนบรูปแพ็กเกจคอร์ส + บทขายสั้น'])assert.ok(page.includes(token),token);
for(const token of['v12-course-plans-014250.jpg','DataTransfer','visiond-course-plans.jpg','เริ่มขายฟรี','ซื้อสิทธิ์โปร 499 บาท','พาร์ตเนอร์ 50/50','กรุณาตรวจก่อนกดส่ง'])assert.ok(ui.includes(token),token);
assert.ok(imageInfo.size>100000&&imageInfo.size<1000000,`chat image ${imageInfo.size}`);
console.log('v0.14.250 V12 course offer attachment: PASS');
