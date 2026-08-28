import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),rules=read('functions/_course_rules.js');
const create=read('functions/api/admin/courses/[id]/lessons.js'),update=read('functions/api/admin/courses/[id]/lessons/[lessonId].js');
assert.equal(read('VERSION.txt').trim(),'v0.14.446');assert.match(read('public/index.html'),/WEB v0\.14\.446/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.446/);
assert.match(rules,/MAX_COURSE_VIDEO_BYTES = 2 \* 1024 \* 1024 \* 1024/);assert.match(html,/MP4\/WEBM ไม่เกิน 2 GB/);assert.doesNotMatch(html,/MP4\/WEBM ไม่เกิน 200 MB/);assert.match(html,/admin-courses\.js\?v=014446/);
for(const token of ['lesson-video-multipart/init','lesson-video-multipart/part?','lesson-video-multipart/complete','lesson-video-multipart/abort','file.slice(offset,end)','2*1024*1024*1024','response.status===413'])assert.ok(ui.includes(token),token);
for(const api of [create,update]){assert.match(api,/MAX_COURSE_VIDEO_BYTES/);assert.doesNotMatch(api,/video\.size>200\*1024\*1024/)}
for(const endpoint of ['init','part','complete','abort']){const api=read(`functions/api/admin/courses/[id]/lesson-video-multipart/${endpoint}.js`);assert.match(api,/requireAdmin/);assert.match(api,/owner_user_id IS NULL/);assert.match(api,/course_origin,'company'/)}
assert.match(read('functions/api/admin/courses/[id]/lesson-video-multipart/init.js'),/MAX_COURSE_VIDEO_BYTES/);assert.match(read('functions/api/admin/courses/[id]/lesson-video-multipart/part.js'),/COURSE_VIDEO_CHUNK_BYTES/);assert.match(read('functions/api/admin/courses/[id]/lesson-video-multipart/complete.js'),/resumeMultipartUpload\(key,uploadId\)\.complete/);
console.log('PASS v0.14.446 company-course 2 GB multipart video upload');
