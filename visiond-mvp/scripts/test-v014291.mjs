import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.291');
const draft=read('public/course-draft-first-ep.js');
const seller=read('public/course-seller.js');
const html=read('public/course-seller.html');
for(const [name,source] of [['draft',draft],['seller',seller]]){
  const compact=source.replace(/\s+/g,'');
  for(const token of ['videoWidth','videoHeight','URL.createObjectURL','URL.revokeObjectURL','width>1280','height>720','width>720','height>1280','สูงเกิน720p'])assert.ok(compact.includes(token),`${name} resolution contract: ${token}`);
}
assert.match(draft,/const fileError=await validateFiles\(\)/);
assert.ok(draft.indexOf('const fileError=await validateFiles()')<draft.indexOf("fetch('/api/course-seller'"),'draft must validate resolution before creating a course draft');
assert.ok(seller.indexOf('await validateLessonVideoResolution(video)')<seller.indexOf('lessonData = new FormData'),'lesson editor must validate resolution before saving/uploading');
assert.ok(html.includes('รับไม่เกิน 720p'));
assert.ok(draft.includes('สูงสุด 2 GB'),'keep the 2 GB multipart limit');
for(const route of ['lesson-video-multipart/init','lesson-video-multipart/part','lesson-video-multipart/complete','lesson-video-multipart/abort'])assert.ok(draft.includes(route)&&seller.includes(route),`keep multipart route ${route}`);
assert.equal(existsSync(new URL('../functions/_stream.js',import.meta.url)),false,'abandoned Stream adapter must not remain');
assert.equal(existsSync(new URL('../migrations/0065_course_stream_video.sql',import.meta.url)),false,'abandoned Stream migration must not remain');
console.log('v0.14.291 real video resolution 720p gate: PASS');
