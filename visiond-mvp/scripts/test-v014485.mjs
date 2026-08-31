import fs from'node:fs';import assert from'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('public/tiktok-analyzer.html'),client=read('public/tiktok-analyzer.js'),provider=read('functions/_tiktok_analyzer.js'),api=read('functions/api/admin/tiktok-analyzer/index.js');
assert.match(html,/name="clips_per_day"/);for(const count of[10,20,30])assert.match(html,new RegExp(`value="${count}"`));
assert.match(html,/แผนคลิปภายใน 1 วัน \(สูงสุด 30 คลิป\)/);assert.match(client,/คลิปที่/);assert.match(client,/x\.clip_number/);assert.match(client,/เกณฑ์ผ่าน/);
assert.match(provider,/posting_plan ต้องเป็นแผนภายใน 1 วัน/);assert.match(provider,/ห้ามใส่สินค้า F ในแผน/);assert.match(provider,/ครบ \$\{clipsPerDay\} คลิป/);assert.match(provider,/max_output_tokens:7000/);assert.match(provider,/maxOutputTokens:7000/);
assert.match(api,/clipsPerDay=\[10,20,30\]/);assert.match(api,/clipsPerDay,images/);assert.match(read('VERSION.txt').trim(),/^v0\.14\.\d+$/);
console.log('v0.14.485 one-day 30-clip plan: PASS');
