import fs from'node:fs';import assert from'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),dashboard=read('public/dashboard.html');
assert.equal(read('VERSION.txt').trim(),'v0.14.576');assert.match(read('public/index.html'),/WEB v0\.14\.576/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.576/);
assert.match(dashboard,/header-shell\.css\?v=014576/);assert.match(dashboard,/header-shell\.js\?v=014576/);assert.match(dashboard,/<header class="topbar">/);
console.log('v0.14.576 dashboard header checks passed');
