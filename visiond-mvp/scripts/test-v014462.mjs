import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),rules=read('functions/_course_rules.js'),list=read('functions/api/admin/courses/[id]/lessons.js'),edit=read('functions/api/admin/courses/[id]/lessons/[lessonId].js');
assert.equal(read('VERSION.txt').trim(),'v0.14.462');assert.match(read('public/index.html'),/WEB v0\.14\.462/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.462/);assert.match(html,/admin-courses\.js\?v=014462/);assert.match(html,/course-seller\.css\?v=014462/);
for(const token of ['PRAGMA table_info(course_lessons)','ALTER TABLE course_lessons ADD COLUMN episode_label TEXT','ALTER TABLE course_lessons ADD COLUMN document_name TEXT','lessonSchemaReadyByDatabase'])assert.ok(rules.includes(token),token);
for(const source of [list,edit])assert.ok(source.indexOf('if(auth.error)return auth.error')<source.indexOf('await ensureCourseLessonSchema(ctx.env)'),'schema repair must require admin first');
assert.match(ui,/โหลด EP ในฉบับร่างไม่สำเร็จ/);assert.match(ui,/companyCourseCreate[^]*scrollIntoView/);
console.log('PASS v0.14.462 repairs missing company lesson columns and exposes draft-load failures');
