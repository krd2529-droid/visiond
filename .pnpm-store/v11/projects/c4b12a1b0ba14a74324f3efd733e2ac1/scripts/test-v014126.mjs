import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const html = read('public/course-center.html');
const js = read('public/course-seller.js');
const api = read('functions/api/course-seller/index.js');
const publishApi = read('functions/api/course-seller/[id]/publish.js');
const roadmap = read('work-history/visiond/roadmap/VISIOND-ROADMAP.md');

assert.equal(read('VERSION.txt').trim(), 'v0.14.126');
assert.match(html, />ตะกร้าคอร์สของฉัน</);
assert.match(html, />กรอกข้อมูลตะกร้าคอร์ส</);
assert.match(html, />ใช้ 1 เครดิตและสร้างตะกร้าคอร์ส</);
assert.match(js, /กรอกข้อมูลตะกร้า/);
assert.match(js, /จัดการบทเรียนและ EP/);
assert.match(js, /แก้ไขตะกร้า/);
assert.match(js, /ส่งตรวจ/);
assert.match(html, /header-shell\.css\?v=014126/);
assert.match(html, /shared-nav\.js\?v=014126/);
assert.match(html, /course-seller\.js\?v=014126/);
assert.match(js, /vision5-flow\.css\?v=014126/);
for (const source of [html, js, api, publishApi]) {
  assert.doesNotMatch(source, /ร่างตะกร้า/);
}
assert.match(roadmap, /v0\.14\.126.*Vision 5/i);
console.log('v0.14.126 Vision 5 navigation and wording cleanup PASS');
