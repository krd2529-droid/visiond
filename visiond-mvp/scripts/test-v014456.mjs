import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.456');assert.match(read('public/index.html'),/WEB v0\.14\.456/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.456/);assert.match(html,/admin-courses\.js\?v=014456/);
assert.doesNotMatch(html,/name="expected_episodes"/);assert.doesNotMatch(html,/จำนวนบทเรียน \(EP\)/);assert.doesNotMatch(ui,/expected_episodes/);assert.match(ui,/\$\{lessons\} EP/);assert.match(ui,/\$\{items\.length\} EP/);assert.doesNotMatch(ui,/\$\{items\.length\}\/\$\{expected\}/);
console.log('PASS v0.14.456 EP count input removed and UI derives actual lesson count');
