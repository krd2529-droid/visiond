import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const html=read('public/admin-courses.html');
const ui=read('public/admin-courses.js');

assert.equal(read('VERSION.txt').trim(),'v0.14.443');
assert.match(read('public/index.html'),/WEB v0\.14\.443/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.443/);
assert.doesNotMatch(html,/คำอธิบายสั้น/);
assert.match(html,/<input name="short_description" type="hidden" \/>/);
assert.match(html,/ช่องทางติดต่อ<input name="contact_info"/);
assert.match(ui,/short_description:course\.short_description\|\|''/);
console.log('PASS v0.14.443 hide only short description field');
