import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),css=read('public/course-seller.css');
assert.equal(read('VERSION.txt').trim(),'v0.14.452');assert.match(read('public/index.html'),/WEB v0\.14\.452/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.452/);assert.match(html,/admin-courses\.js\?v=014452/);assert.match(html,/course-seller\.css\?v=014452/);
for(const token of ['company-pending-lesson-full','pending-lesson-heading','รายละเอียดเนื้อหา','อัปโหลดคลิป MP4/WEBM ไม่เกิน 2 GB','อัปโหลดเอกสาร PDF, JPEG หรือ PNG','pending-lesson-preview','previewUrl','URL.revokeObjectURL(removed.previewUrl)'])assert.ok(ui.includes(token)||css.includes(token),token);
assert.ok(!ui.includes('company-lesson-block company-lesson-block--pending'));
console.log('PASS v0.14.452 pending EP remains a full visible block with all fields and preview');
