import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.445');
assert.match(read('public/index.html'),/WEB v0\.14\.445/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.445/);
assert.match(html,/<span id="lessonFormTitle">ชื่อ EP<\/span>/);assert.doesNotMatch(html,/lessonFormTitle">EP 1/);assert.match(html,/admin-courses\.js\?v=014445/);
assert.equal((ui.match(/lessonFormTitle\.textContent\s*=\s*["']ชื่อ EP["']/g)||[]).length,2);
assert.doesNotMatch(ui,/lessonFormTitle\.textContent\s*=\s*`(?:EP|แก้ไข EP)/);
console.log('PASS v0.14.445 simple EP title field label');
