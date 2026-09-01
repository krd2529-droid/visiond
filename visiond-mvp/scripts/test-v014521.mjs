import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('public/tiktok-analyzer.html');

assert.match(html,/แนบภาพเพื่อวิเคราะห์ <small>TikTok Analytics \/ Showcase \/ ผลงานคลิป/);
assert.doesNotMatch(html,/ใช้ได้ทั้งก่อน TikTok อนุญาต API และใช้เสริมข้อมูลจาก API/);
assert.match(html,/id="screenshots"[^>]+multiple/);
assert.equal(read('VERSION.txt').trim(),'v0.14.521');
console.log('TikTok concise upload copy regression: PASS');
