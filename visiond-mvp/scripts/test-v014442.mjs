import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const html=read('public/admin-courses.html');
const ui=read('public/admin-courses.js');

assert.equal(read('VERSION.txt').trim(),'v0.14.442');
assert.match(read('public/index.html'),/WEB v0\.14\.442/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.442/);
assert.equal((html.match(/บัญชีรับเงินของคอร์สนี้/g)||[]).length,1);
assert.match(ui,/coursePublishSummary\.innerHTML = `<b>\$\{items\.length\}\/\$\{expected\} EP<\/b><span>เวลาเนื้อหา/);
assert.doesNotMatch(ui,/coursePublishSummary\.innerHTML[^;]*บัญชีรับเงิน/);
console.log('PASS v0.14.442 payment account belongs to course basket only');
