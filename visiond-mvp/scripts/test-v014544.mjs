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
const endpoint = await read('functions/api/admin/tiktok-analyzer/index.js');

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
assert.match(provider, /30 สินค้าหลัก \+ 10 สินค้าแนะนำเกรด E/);
assert.match(provider, /ใส่ A ได้สูงสุด 20 รายการ/);
assert.match(provider, /กัน C ไว้ 5 รายการ/);
assert.match(provider, /ใช้ B เติมจำนวนที่เหลือให้ครบ 30/);
assert.match(provider, /หากยังไม่มีทั้งสินค้า A และ B ให้ใช้ C ทั้ง 30 รายการ/);
assert.match(provider, /ห้ามนำ D หรือ F เข้า 30 สินค้าหลัก/);
assert.match(provider, /ห้ามสร้างชื่อสินค้าซ้ำหรือชื่อปลอม/);
assert.match(provider, /สินค้า C สำหรับทดลองอาจคัดมาจากสินค้า C เดิม/);
assert.match(provider, /สินค้า D ที่ถึงจังหวะกระแส ฤดูกาล หรือโปรโมชั่น/);
assert.match(provider, /สินค้า E ที่ผู้ใช้เลือกนำมาทดลอง/);
assert.match(provider, /ต้องเปลี่ยน product_type ของรายการนั้นเป็น C/);
assert.match(provider, /ห้ามให้สินค้าเดียวกันซ้ำอยู่ใน D หรือ E/);
assert.match(provider, /ต้องหาสินค้า E แนะนำอื่นที่ไม่ซ้ำเติมให้กลุ่ม E ยังคงครบ 10 รายการ/);
assert.match(provider, /สินค้า C เป็นสินค้าเทส ให้ตรวจหลักฐานใหม่เมื่อครบ 3 วัน/);
assert.match(provider, /สินค้า A และ B ให้ประเมินผลตามยอดขายย้อนหลัง 7 วัน/);
assert.match(provider, /ห้ามใช้ข้อมูลก่อนถึงวันตรวจมาตัดสินว่าเป็นผลครบช่วง/);
assert.match(provider, /review_started_at TEXT,next_review_at TEXT,review_cycle_days INTEGER/);
assert.match(client, /A:'≥ 7 ชิ้น\/สัปดาห์'/);
assert.match(client, /B:'4–6 ชิ้น\/สัปดาห์'/);
assert.match(client, /C:'1–3 ชิ้น\/สัปดาห์'/);
assert.match(client, /F:'0 ชิ้น\/สัปดาห์ · คัดออก'/);
assert.match(page, /A ≥ 7 ชิ้น · B 4–6 ชิ้น · C 1–3 ชิ้น · F 0 ชิ้น/);
assert.match(provider, /inventory_status TEXT NOT NULL DEFAULT 'analyzed'/);
assert.match(endpoint, /action==='set_product_inventory'/);
assert.match(endpoint, /\['kept','discarded'\]\.includes\(status\)/);
assert.match(endpoint, /inventory_status=excluded\.inventory_status/);
assert.match(endpoint, /r\.created_at attachment_date/);
assert.match(endpoint, /cycle=type==='C'\?3:\['A','B'\]\.includes\(type\)\?7:0/);
assert.match(endpoint, /datetime\('now',\?\)/);
assert.match(endpoint, /result\.daily_product_list/);
assert.match(endpoint, /kind:'daily_ranking'/);
assert.match(client, /ลิสต์คัดสินค้า/);
assert.match(client, /data-inventory="kept"/);
assert.match(client, /data-inventory="discarded"/);
assert.match(client, /ประวัติสินค้าที่คัดออก/);
assert.match(client, /รอบตรวจสินค้า A\/B\/C/);
assert.match(client, /C ตรวจหลังแนบรูป 3 วัน · A และ B ตรวจทุก 7 วัน/);
assert.match(client, /review-reminder\$\{due\?' overdue':''\}/);
assert.match(page, /ลิสต์คัดสินค้า/);
assert.doesNotMatch(page, /ลิสต์สินค้าถาวร/);
assert.match(page, /A สูงสุด 20 · C จำนวน 5 · B เติมให้ครบ 30/);
assert.match(page, /ถ้ายังไม่มี A และ B ให้เป็น C ทั้ง 30/);
assert.match(page, /C สามารถคัดจาก D หรือ E มาทดลองได้และต้องเปลี่ยนเกรดเป็น C/);
assert.match(page, /id="productReviewSchedule"/);
assert.equal(version.trim(), 'v0.14.544');

console.log('v0.14.544 A/B/C review schedule checks passed');
