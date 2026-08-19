import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const version=(await readFile(new URL('VERSION.txt',root),'utf8')).trim();
const html=await readFile(new URL('public/admin.html',root),'utf8');
const js=await readFile(new URL('public/product-sample-archive.js',root),'utf8');
const api=await readFile(new URL('functions/api/admin/product-sample-sources/[id].js',root),'utf8');

assert.equal(version,'v0.14.319');
assert.match(html,/id="productSampleArchiveButton"[^>]+data-feature="PROD-SAMPLE-001"/);
assert.match(html,/ตะกร้าเดี่ยวปกติ/);
assert.match(html,/product-sample-archive\.js\?v=014319/);
assert.match(js,/for\(let pageNumber=1;pageNumber<=pdf\.numPages;pageNumber\+\+\)/,'ต้องแปลงทุกหน้า PDF');
assert.match(js,/fillText\('SAMPLE'/,'ทุกหน้าต้องมี SAMPLE');
assert.match(js,/canvas\.toBlob\([\s\S]*'image\/jpeg'/,'ผลลัพธ์หน้าต้องเป็น JPEG');
assert.match(js,/\.jpg`/,'ชื่อไฟล์ภายใน ZIP ต้องเป็น JPG');
assert.match(js,/application\/zip/);
assert.match(js,/0x06054b50/,'ต้องอ่านสารบัญท้าย ZIP เพื่อรองรับไฟล์ ZIP ทั่วไป');
assert.match(js,/0x02014b50/,'ต้องอ่าน Central Directory ของ ZIP');
assert.doesNotMatch(js,/data descriptor ยังไม่รองรับ/,'ห้ามปฏิเสธ ZIP ที่ใช้ data descriptor');
assert.match(js,/manifest\.files/,'ต้องใช้ไฟล์ตรงของตะกร้าที่เลือก');
assert.doesNotMatch(js,/\/api\/admin\/products\/[${]/,'Frontend ห้ามแก้ข้อมูลตะกร้า');
assert.match(api,/requireAdmin/);
assert.match(api,/COALESCE\(p\.source,''\)<>'bundle'/);
assert.match(api,/NOT EXISTS\(SELECT 1 FROM product_bundle_items b WHERE b\.bundle_product_id=p\.id\)/);
assert.match(api,/NOT EXISTS\(SELECT 1 FROM courses c WHERE c\.product_id=p\.id\)/);
assert.doesNotMatch(api,/\b(?:INSERT|UPDATE|DELETE)\b/i,'API manifest ต้องอ่านอย่างเดียว');

console.log('v0.14.319 standalone basket SAMPLE JPEG ZIP: PASS');
