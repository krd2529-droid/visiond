import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),css=read('public/course-seller.css');
assert.equal(read('VERSION.txt').trim(),'v0.14.449');assert.match(read('public/index.html'),/WEB v0\.14\.449/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.449/);
assert.ok(html.indexOf('id="lessonList"')<html.indexOf('id="lessonForm"'),'saved EP blocks must render above next editor');assert.match(html,/id="lessonEditorHeading"/);assert.match(html,/course-seller\.css\?v=014449/);assert.match(html,/admin-courses\.js\?v=014449/);assert.doesNotMatch(html,/ความยาว EP \(นาที\)/);
for(const token of ['company-lesson-block','company-lesson-block__body','company-lesson-block__actions','company-lesson-file-mark','เพิ่ม EP ${items.length+1}','episode_label.value=String(items.length+1)','data-edit','data-delete'])assert.ok(ui.includes(token),token);
assert.match(ui,/image\/jpeg/);assert.match(ui,/image\/png/);assert.match(ui,/\/document/);for(const selector of ['.company-lesson-blocks','.company-lesson-block {','.company-lesson-block__actions'])assert.ok(css.includes(selector),selector);assert.match(css,/grid-template-columns: 90px minmax\(0, 1fr\)/);
console.log('PASS v0.14.449 persistent EP blocks and next editor');
