import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js'),css=read('public/course-seller.css');
assert.equal(read('VERSION.txt').trim(),'v0.14.454');assert.match(read('public/index.html'),/WEB v0\.14\.454/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.454/);assert.match(html,/admin-courses\.js\?v=014454/);assert.match(html,/course-seller\.css\?v=014454/);
for(const token of ['data-pending-field="episode_label"','data-pending-field="title"','data-pending-field="description"','data-pending-video','data-pending-document',"item.form.set(input.dataset.pendingField,input.value)",'item.video=file','item.documentFile=file'])assert.ok(ui.includes(token),token);
assert.match(css,/pending-lesson-field input/);assert.match(css,/pending-lesson-field textarea/);
console.log('PASS v0.14.454 pending EP blocks are directly editable including file replacement');
