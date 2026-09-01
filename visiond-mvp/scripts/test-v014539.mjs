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

assert.match(provider, /สินค้าเกรด A และ B เป็นสินค้าที่ต้องทำคอนเทนต์ลงต่อเนื่อง/);
assert.match(provider, /เลื่อน B เป็น A เมื่อมีหลักฐานว่ายอดขาย วิว และทราฟฟิกดีขึ้นอย่างต่อเนื่อง/);
assert.match(provider, /สินค้า A ผลงานลดลงแต่ยังขายได้บ้างให้ลดเป็น B/);
assert.match(provider, /สินค้า A วิวหรือทราฟฟิกไม่ดีพร้อมขายไม่ได้ ให้ลดเป็น F/);
assert.match(provider, /ห้ามเลื่อนหรือลดเกรดจากความรู้สึก ข้อมูลเพียงครั้งเดียว หรือคลิปเดียว/);
assert.match(provider, /A=ขายได้อย่างน้อย 7 ชิ้นต่อ 7 วัน/);
assert.match(provider, /B=ขายได้ 4-6 ชิ้นต่อ 7 วัน/);
assert.match(provider, /C=ขายได้ 1-3 ชิ้นต่อ 7 วัน/);
assert.match(provider, /F=ขายได้ 0 ชิ้นต่อ 7 วัน/);
assert.match(provider, /ห้ามคาดคะเนเป็นยอดต่อสัปดาห์/);
assert.match(provider, /ให้ใช้แทนกฎ C แบบ 72 ชั่วโมงก่อนหน้า/);
assert.match(client, /A:'≥ 7 ชิ้น\/สัปดาห์'/);
assert.match(client, /B:'4–6 ชิ้น\/สัปดาห์'/);
assert.match(client, /C:'1–3 ชิ้น\/สัปดาห์'/);
assert.match(client, /F:'0 ชิ้น\/สัปดาห์ · คัดออก'/);
assert.match(page, /A ≥ 7 ชิ้น · B 4–6 ชิ้น · C 1–3 ชิ้น · F 0 ชิ้น/);
assert.equal(version.trim(), 'v0.14.539');

console.log('v0.14.539 weekly sales thresholds passed');
