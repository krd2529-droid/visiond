import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),css=read('public/course-seller.css');
assert.equal(read('VERSION.txt').trim(),'v0.14.447');assert.match(read('public/index.html'),/WEB v0\.14\.447/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.447/);
for(const id of ['companyCoverPreview','lessonDocumentPreview'])assert.match(html,new RegExp(`id="${id}"`));assert.match(html,/course-seller\.css\?v=014447/);assert.match(html,/admin-courses\.js\?v=014447/);
for(const token of ['URL.createObjectURL','URL.revokeObjectURL','courseForm.elements.cover.addEventListener','lessonForm.elements.pdf.addEventListener','image/jpeg','image/png','PDF ไม่มีรูปตัวอย่าง','/api/courses/${currentCourseId}/lesson/${lesson.id}/document'])assert.ok(ui.includes(token),token);
assert.match(ui,/course\.cover_url/);assert.match(ui,/lesson\.pdf_mime/);assert.match(css,/\.upload-image-preview/);assert.match(css,/object-fit: contain/);assert.match(css,/upload-image-preview--document/);
console.log('PASS v0.14.447 company-course image upload previews');
