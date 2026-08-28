import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8'),html=read('public/admin-courses.html'),ui=read('public/admin-courses.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.450');assert.match(read('public/index.html'),/WEB v0\.14\.450/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.450/);assert.match(html,/admin-courses\.js\?v=014450/);
for(const token of ['browserVideoDuration','mp4Box','mp4DurationSeconds',"box.type==='moov'","box.type==='mvhd'",'file.slice(offset','getBigUint64','duration/timescale',"file.type==='video/mp4'",'return mp4DurationSeconds(file)'])assert.ok(ui.includes(token),token);
assert.match(ui,/setTimeout\(\(\)=>done\(new Error\('metadata timeout'\)\),30000\)/);assert.doesNotMatch(ui,/await file\.arrayBuffer\(\)/);assert.match(ui,/await file\.slice\(/);assert.match(ui,/await videoDurationSeconds\(video\)/);assert.match(ui,/uploadLessonVideo\(id,data\.id,video\)/);
console.log('PASS v0.14.450 MP4 duration box fallback before multipart upload');
