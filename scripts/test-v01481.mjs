import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('public/admin.html','utf8'),css=fs.readFileSync('public/elon-controls.css','utf8'),js=fs.readFileSync('public/admin.js','utf8');
assert.match(html,/elon-control-grid/);assert.match(html,/elonWebControl/);assert.match(html,/elonV7Control/);assert.match(html,/elon-controls\.css\?v=01481/);
assert.match(css,/\.elon-toggle input[^{]*\{[^}]*width:1px!important/);assert.match(css,/input:checked\+span/);assert.match(css,/data-state="on"/);assert.match(css,/@media\(max-width:520px\)/);
assert.match(js,/function paintElonControl/);assert.match(js,/เปิดใช้งานอยู่/);assert.match(js,/ปิดใช้งานอยู่/);assert.match(js,/ยังไม่ได้ตั้งฐาน/);
assert.doesNotMatch(html,/<label><input id="elonWebEnabled"/,'old unstyled checkbox returned');
console.log('v0.14.81 ELON control-card switch UI checks passed');
