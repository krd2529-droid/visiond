import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const[version,index,admin,ui,css]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/course-seller.js','public/course-seller.css'].map(read));
assert.ok(Number(version.trim().split('.').pop())>=254);assert.match(index,/WEB v0\.14\.\d+/);assert.match(admin,/ADMIN v0\.14\.\d+/);
for(const label of['สร้างคอร์สแบบ 1','สร้างคอร์สแบบ 2','สร้างคอร์สแบบ 3'])assert.ok(ui.includes(label),label);
assert.ok(ui.indexOf('สร้างคอร์สแบบ 1')<ui.indexOf('สร้างคอร์สแบบ 2'));assert.ok(ui.indexOf('สร้างคอร์สแบบ 2')<ui.indexOf('สร้างคอร์สแบบ 3'));
assert.match(ui,/createCourseBasket\.hidden = true/);assert.match(css,/\.vision5-credit-grid button/);
console.log('v0.14.254 dedicated create button per course plan: PASS');
