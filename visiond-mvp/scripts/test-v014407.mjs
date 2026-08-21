import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const version=read('VERSION.txt').trim();
const protocol=read('VISIOND-PARTNER-API-PROTOCOL.md');
const guide=read('docs/PARTNER-API-WEB2-INTEGRATION.md');
const featureMap=read('FEATURE-MAP.md');

assert.equal(version,'v0.14.407');
assert.match(protocol,/Phase 9 Digital Product Commerce Contract \(Design Locked; Runtime Not Open\)/);
assert.match(protocol,/\/orders\/sync[^\n]+reconciliation[^\n]+ไม่สร้าง VisionD order/);
assert.match(protocol,/VisionD ต้องคำนวณราคาจากฐานข้อมูลตัวเอง/);
assert.match(protocol,/ค่าบริการ API 1 บาทไม่หักจากลูกค้า/);
assert.match(protocol,/one-time claim handoff อายุสั้น/);
assert.match(protocol,/cursor pagination ค่าเริ่มต้น 50 สูงสุด 100/);
assert.match(guide,/endpoint ใต้ `\/commerce\/\*` ยังเป็น contract ที่ยังไม่เปิด Production/);
assert.match(guide,/Web 2 ไม่มีสิทธิ์สั่งให้ออเดอร์เป็น `paid` หรือ `fulfilled` เอง/);
assert.match(featureMap,/Digital commerce boundary: v0\.14\.407/);
assert.doesNotMatch(read('functions/api/partner/v1/orders/sync.js'),/INSERT INTO entitlements|grantOrder|fulfilled/);
assert.doesNotMatch(read('functions/api/partner/v1/products/index.js'),/object_key|download_url|product_files/);

console.log('PASS v0.14.407 Web 2 digital product commerce contract boundary');
