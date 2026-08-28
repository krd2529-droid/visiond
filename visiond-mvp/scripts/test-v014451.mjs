import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.451');
assert.match(read('public/index.html'),/WEB v0\.14\.451/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.451/);assert.match(html,/admin-courses\.js\?v=014451/);
for(const token of ['pendingLessons = []','pendingLessonFromForm','renderPendingLessons','refreshNewLessonEditor','persistPendingLesson','flushPendingLessons','pendingLessons.push(pendingLessonFromForm())','pendingLessons.shift()'])assert.ok(ui.includes(token),token);
assert.match(html,/id="lessonEditorHeading"[^>]*>เพิ่ม EP 1</);
assert.match(ui,/lessonForm\.reset\(\);hideImagePreview\(lessonDocumentPreview,'document'\);renderPendingLessons\(\);refreshNewLessonEditor\(\)/);
assert.doesNotMatch(ui,/lessonForm\.onsubmit[\s\S]{0,250}createDraft/);
console.log('PASS v0.14.451 add EP creates repeatable client-side blocks before save/upload');
