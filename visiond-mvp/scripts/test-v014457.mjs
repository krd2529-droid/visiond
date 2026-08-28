import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.457');assert.match(read('public/index.html'),/WEB v0\.14\.457/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.457/);assert.match(html,/admin-courses\.js\?v=014457/);
assert.doesNotMatch(html,/name="expected_episodes"/);assert.doesNotMatch(ui,/\$\{lessons\} EP/);assert.doesNotMatch(ui,/\$\{items\.length\} EP/);assert.match(ui,/coursePublishSummary\.innerHTML = `<b>เนื้อหาในตะกร้า<\/b>/);assert.match(ui,/\$\{money\(c\.price\)\} · \$\{Number\(c\.total_minutes\)/);
console.log('PASS v0.14.457 aggregate EP count is hidden because custom sub-EP labels make it cluttered');
