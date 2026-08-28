import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.455');assert.match(read('public/index.html'),/WEB v0\.14\.455/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.455/);assert.match(html,/admin-courses\.js\?v=014455/);
const save=ui.slice(ui.indexOf('saveCourseDraft.onclick'),ui.indexOf('publishCompanyCourse.onclick'));
assert.match(save,/if\(currentLessonId\)await persistLesson\(currentCourseId\)/);assert.ok(save.indexOf('persistLesson(currentCourseId)')<save.indexOf('lessonForm.reset()'));assert.match(save,/lessonForm\.elements\.description\.value/);assert.match(save,/คลิป เอกสาร/);
console.log('PASS v0.14.455 save whole draft persists active EP media before resetting editor');
