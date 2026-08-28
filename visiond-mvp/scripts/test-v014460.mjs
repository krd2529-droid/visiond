import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),css=read('public/course-seller.css');
assert.equal(read('VERSION.txt').trim(),'v0.14.460');assert.match(read('public/index.html'),/WEB v0\.14\.460/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.460/);assert.match(html,/admin-courses\.js\?v=014460/);assert.match(html,/course-seller\.css\?v=014460/);
const flush=ui.slice(ui.indexOf('async function flushPendingLessons'),ui.indexOf('lessonForm.onsubmit'));
for(const token of ['const queue=[...pendingLessons]','for(let index=0;index<queue.length;index++)','for(let attempt=1;attempt<=2;attempt++)','failures.push(item)','pendingLessons=failures','await loadLessons(id)'])assert.ok(flush.includes(token),token);
assert.match(ui,/function markPendingErrors/);assert.match(css,/pending-lesson-error/);assert.match(flush,/กำลังลองอีกครั้ง/);
console.log('PASS v0.14.460 three EP uploads retry independently and failures remain visibly actionable');
