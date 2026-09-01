import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('public/tiktok-analyzer.html');
const css=read('public/tiktok-analyzer.css');
const client=read('public/tiktok-analyzer.js');
const api=read('functions/api/admin/tiktok-analyzer/index.js');

assert.match(html,/แนบภาพเพื่อวิเคราะห์ร่วมกับข้อมูล API/);
assert.match(html,/ใช้ได้ทั้งก่อน TikTok อนุญาต API และใช้เสริมข้อมูลจาก API/);
assert.match(html,/id="screenshots"[^>]+multiple/);
assert.match(html,/id="previews"/);
assert.match(html,/id="analyze"/);
assert.doesNotMatch(css,/\.api-focused-form \.upload[^\n]*display:none/);
assert.doesNotMatch(css,/\.api-focused-form #previews[^\n]*display:none/);
assert.doesNotMatch(css,/\.api-focused-form #analyze[^\n]*display:none/);
assert.match(client,/\$\('#screenshots'\)\.addEventListener\('change'/);
assert.match(client,/body:new FormData\(form\)/);
assert.match(api,/form\.getAll\('screenshots'\)/);
assert.match(api,/!files\.length&&!notes/);
assert.equal(read('VERSION.txt').trim(),'v0.14.520');
console.log('TikTok manual image input regression: PASS');
