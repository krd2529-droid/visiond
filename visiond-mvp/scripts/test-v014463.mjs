import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const js=read('public/home-course-catalog.js');
const css=read('public/home-modern-ai.css');
const html=read('public/index.html');

assert.equal(read('VERSION.txt').trim(),'v0.14.463');
assert.match(html,/WEB v0\.14\.463/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.463/);
assert.match(html,/home-course-catalog\.js\?v=014463/);
assert.match(html,/home-modern-ai\.css\?v=014463/);
assert.match(js,/data-course-add/);
assert.match(js,/ใส่รถเข็น/);
assert.match(js,/อยู่ในรถเข็นแล้ว ✓/);
assert.match(js,/product_kind:'course'/);
assert.match(js,/category:'online-course'/);
assert.match(js,/course_id:Number\(course\.id\)/);
assert.match(js,/localStorage\.setItem\('vd_cart'/);
assert.match(js,/course\.owned\?[^]*เข้าเรียน[^]*data-course-add/);
assert.match(css,/home-course-buttons\{[^}]*grid-template-columns:1fr 1fr/);

console.log('PASS v0.14.463 adds functional course cart buttons to the home catalog');
