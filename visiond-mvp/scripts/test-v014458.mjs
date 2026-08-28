import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),css=read('public/course-seller.css'),api=read('functions/api/admin/courses/[id]/lessons.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.458');assert.match(read('public/index.html'),/WEB v0\.14\.458/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.458/);assert.match(html,/admin-courses\.js\?v=014458/);assert.match(html,/course-seller\.css\?v=014458/);
for(const token of ['lessonVideoSavedStatus','lessonDocumentSavedStatus','resetSavedUploadStatuses','showSavedUploadStatuses','ไม่เลือกใหม่จะใช้คลิปเดิม','ไม่เลือกใหม่จะใช้ไฟล์เดิม'])assert.ok(html.includes(token)||ui.includes(token),token);
assert.match(api,/duration_seconds,video_mime,pdf_mime,document_name/);assert.match(css,/saved-upload-status/);assert.match(ui,/showSavedUploadStatuses\(lesson\)/);
console.log('PASS v0.14.458 saved EP media state remains visible while browser file inputs stay blank');
