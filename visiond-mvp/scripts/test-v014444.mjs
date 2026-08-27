import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const html=read('public/admin-courses.html'),adminUi=read('public/admin-courses.js'),learn=read('public/learn.js');
const create=read('functions/api/admin/courses/[id]/lessons.js'),update=read('functions/api/admin/courses/[id]/lessons/[lessonId].js'),courseApi=read('functions/api/courses/[id].js');

assert.equal(read('VERSION.txt').trim(),'v0.14.444');
assert.match(read('public/index.html'),/WEB v0\.14\.444/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.444/);
assert.match(html,/name="episode_label"/);assert.match(html,/เช่น 1, 1\.1 หรือ 1\.2/);assert.match(html,/admin-courses\.js\?v=014444/);
for(const api of [create,update]){assert.match(api,/episodeLabel/);assert.match(api,/\^\\d\+\(\?:\\\.\\d\+\)\*\$/);}
assert.match(create,/INSERT INTO course_lessons\(course_id,title,description,episode_label,sort_order/);
assert.match(update,/SET title=\?,description=\?,episode_label=\?/);
assert.match(courseApi,/l\.episode_label/);assert.match(adminUi,/l\.episode_label \|\| i \+ 1/);assert.match(learn,/episode_label\|\|String/);
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE course_lessons(id INTEGER PRIMARY KEY,course_id INTEGER,title TEXT,sort_order INTEGER);');db.exec(read('migrations/0070_course_lesson_episode_label.sql'));db.prepare('INSERT INTO course_lessons(id,course_id,title,episode_label,sort_order) VALUES(1,1,?,?,10)').run('เริ่มต้น','1.1');assert.equal(db.prepare('SELECT episode_label FROM course_lessons WHERE id=1').get().episode_label,'1.1');
console.log('PASS v0.14.444 custom company-course EP labels');
