import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),create=read('functions/api/admin/courses/[id]/lessons.js'),update=read('functions/api/admin/courses/[id]/lessons/[lessonId].js');
assert.equal(read('VERSION.txt').trim(),'v0.14.448');assert.match(read('public/index.html'),/WEB v0\.14\.448/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.448/);
assert.doesNotMatch(html,/ความยาว EP \(นาที\)/);assert.match(html,/name="duration_minutes" type="hidden" value="0"/);assert.match(html,/admin-courses\.js\?v=014448/);
for(const token of ["document.createElement('video')",'video.onloadedmetadata','video.duration','URL.createObjectURL(file)','URL.revokeObjectURL(url)','setTimeout(','กำลังอ่านความยาวคลิป','/60'])assert.ok(ui.includes(token),token);
assert.match(create,/Math\.round\(rawDuration\*60\)/);assert.match(update,/durationProvided=form\.has\('duration_minutes'\)/);assert.match(update,/Number\(lesson\.duration_seconds\)\/60/);assert.match(update,/Number\(lesson\.duration_seconds\)\|\|0/);
console.log('PASS v0.14.448 automatic EP video duration');
