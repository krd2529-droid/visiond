import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.459');assert.match(read('public/index.html'),/WEB v0\.14\.459/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.459/);assert.match(html,/admin-courses\.js\?v=014459/);
for(const token of ['verifyLessonSaved','document&&!saved.has_pdf','video&&!saved.has_video','item.savedLessonId=Number(data.id)','item.savedLessonId?','pendingLessons.shift()'])assert.ok(ui.includes(token),token);
const persist=ui.indexOf('await persistPendingLesson(id,pendingLessons[0],saved)'),shift=ui.indexOf('pendingLessons.shift()',persist);assert.ok(persist>0&&shift>persist,'queue shifts only after persist and verification');assert.match(ui,/cache:'no-store'/);assert.match(ui,/บล็อกนี้จะไม่ถูกล้าง/);
console.log('PASS v0.14.459 each queued EP upload is verified before removal and retries reuse its lesson id');
