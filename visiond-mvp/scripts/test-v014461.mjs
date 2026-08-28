import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.461');assert.match(read('public/index.html'),/WEB v0\.14\.461/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.461/);assert.match(html,/admin-courses\.js\?v=014461/);assert.match(html,/course-seller\.css\?v=014461/);
const save=ui.slice(ui.indexOf('async function saveWholeCourseDraft'),ui.indexOf('saveCourseDraft.onclick')),publish=ui.slice(ui.indexOf('publishCompanyCourse.onclick'),ui.indexOf('(async () =>'));
for(const token of ['createDraft({allowPartial:true})','/payment`','persistLesson(currentCourseId)','pendingLessons.push(pendingLessonFromForm())','flushPendingLessons(currentCourseId)'])assert.ok(save.includes(token),token);
assert.ok(publish.indexOf('await saveWholeCourseDraft()')<publish.indexOf('/publish`'),'queued EP must be saved before publish endpoint');
console.log('PASS v0.14.461 publish saves course, payment and every queued EP before opening sale');
