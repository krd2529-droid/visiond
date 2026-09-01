import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [provider, client, page, version] = await Promise.all([
  read('functions/_tiktok_analyzer.js'),
  read('public/tiktok-analyzer.js'),
  read('public/tiktok-analyzer.html'),
  read('VERSION.txt'),
]);

assert.match(provider, /C=สินค้าอยู่ในช่วงทดสอบ 72 ชั่วโมงแรก/);
assert.match(provider, /มีหลักฐานว่าขายได้ให้เลื่อนเป็น B/);
assert.match(provider, /ให้เปลี่ยนเป็น F ทันทีโดยไม่ต้องรอ 7 วัน/);
assert.match(provider, /ครบ 72 ชั่วโมงแล้ววิวหรือทราฟฟิกต่ำและไม่มีการขาย/);
assert.match(provider, /สินค้าเกรด A และ B เป็นสินค้าที่ต้องทำคอนเทนต์ลงต่อเนื่อง/);
assert.match(provider, /เลื่อน B เป็น A เมื่อมีหลักฐานว่ายอดขาย วิว และทราฟฟิกดีขึ้นอย่างต่อเนื่อง/);
assert.match(provider, /สินค้า A ผลงานลดลงแต่ยังขายได้บ้างให้ลดเป็น B/);
assert.match(provider, /สินค้า A วิวหรือทราฟฟิกไม่ดีพร้อมขายไม่ได้ ให้ลดเป็น F/);
assert.match(provider, /ห้ามเลื่อนหรือลดเกรดจากความรู้สึก ข้อมูลเพียงครั้งเดียว หรือคลิปเดียว/);
assert.match(client, /C:'ทดสอบ 3 วัน · ขายได้ไป B · ไม่เวิร์กไป F'/);
assert.match(client, /B:'สินค้ารอง · ทำต่อเนื่อง · ดีขึ้นไป A'/);
assert.match(client, /A:'ขายดี · ทำต่อเนื่อง · ผลตกไป B\/F'/);
assert.match(page, /C ทดสอบ 3 วัน ขายได้ไป B ไม่เวิร์กไป F/);
assert.match(page, /B สินค้ารอง ทำต่อเนื่องและเลื่อนเป็น A เมื่อผลงานดีขึ้น/);
assert.match(page, /หากผลงานลดลงให้ไป B หรือ F ตามหลักฐาน/);
assert.equal(version.trim(), 'v0.14.538');

console.log('v0.14.538 bidirectional A/B/F checks passed');
