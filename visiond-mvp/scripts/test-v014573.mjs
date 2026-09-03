import fs from'node:fs';import assert from'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const js=read('public/toys-center-admin.js'),html=read('public/toys-center-admin.html');
assert.equal(read('VERSION.txt').trim(),'v0.14.573');assert.match(read('public/index.html'),/WEB v0\.14\.573/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.573/);
assert.match(js,/const form=event\.currentTarget,button=/);assert.match(js,/new FormData\(form\)/);assert.match(js,/form\.reset\(\)/);assert.doesNotMatch(js,/event\.currentTarget\.reset\(\)/);
assert.match(html,/toys-center-admin\.js\?v=014573/);
console.log('v0.14.573 Toys Center submit reset checks passed');
