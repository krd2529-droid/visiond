import assert from'node:assert/strict';import fs from'node:fs';
const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8'),html=read('public/service-receipt.html'),js=read('public/service-receipt.js'),css=read('public/service-receipt.css'),admin=read('public/admin.html'),map=read('FEATURE-MAP.md');
assert.equal(read('VERSION.txt').trim(),'v0.14.413');assert.match(read('public/index.html'),/WEB v0\.14\.413/);assert.match(admin,/ADMIN v0\.14\.413/);
for(const token of['SERVICE-RECEIPT-001','รายการบริการ','ยอดชำระ (บาท)','ใบเสร็จรับเงิน','ไม่ใช่ใบกำกับภาษี','ไม่มีภาษีมูลค่าเพิ่ม'])assert.ok(html.includes(token),token);
assert.match(admin,/href="\/service-receipt\.html"[^>]*data-feature="SERVICE-RECEIPT-001"/);assert.match(js,/fetch\('\/api\/auth\/me'/);assert.match(js,/\['boss','admin'\]/);assert.match(js,/window\.print\(\)/);assert.match(js,/VD-RC-/);assert.match(js,/crypto\.randomUUID/);assert.match(js,/textContent=service/);assert.doesNotMatch(js,/innerHTML\s*=\s*service/);
for(const variant of['vds-btn--primary','vds-btn--secondary','vds-btn--text'])assert.ok(html.includes(variant),variant);assert.doesNotMatch(css,/\.vds-btn(?:--|\s*\{)/);assert.match(css,/@media print/);assert.match(css,/@media\(max-width:800px\)/);
assert.match(map,/## SERVICE-RECEIPT-001/);assert.match(map,/ไม่บันทึกรายการบริการหรือยอดเงินลงฐานข้อมูล/);assert.doesNotMatch(html+js,/VAT\s*7|ภาษีมูลค่าเพิ่ม\s*7|ใบกำกับภาษีเต็มรูป/);
console.log('PASS v0.14.413 VisionD Service Receipt');
