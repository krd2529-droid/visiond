import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const version=(await readFile(new URL('VERSION.txt',root),'utf8')).trim();
const html=await readFile(new URL('public/admin.html',root),'utf8');
const js=await readFile(new URL('public/product-sample-archive.js',root),'utf8');
const css=await readFile(new URL('public/product-sample-archive.css',root),'utf8');
const api=await readFile(new URL('functions/api/admin/product-sample-sources/[id].js',root),'utf8');

assert.equal(version,'v0.14.320');
assert.match(html,/id="productSampleGrid"[^>]+role="listbox"/,'ต้องมีพื้นที่การ์ดสำหรับเลือกตะกร้า');
assert.doesNotMatch(html,/id="productSampleProduct"/,'ต้องเอา Dropdown เดิมออกทั้งหมด');
assert.doesNotMatch(html,/<select[^>]+productSample/i,'ห้ามมี Dropdown เลือกตะกร้า');
assert.match(html,/product-sample-archive\.js\?v=014320/);
assert.match(html,/product-sample-archive\.css\?v=014320/);
assert.match(js,/class="product-sample-card/,'ต้องสร้างการ์ดสินค้า');
assert.match(js,/item\.cover_url/,'การ์ดต้องแสดงรูปปกสินค้า');
assert.match(js,/data-product-sample-id/,'การ์ดต้องผูกเลขสินค้าที่เลือก');
assert.match(js,/classList\.toggle\('is-selected'/,'ต้องแสดงสถานะเลือกชัดเจน');
assert.match(js,/selectedId=id/,'ต้องเก็บตะกร้าที่เลือกจากการ์ด');
assert.match(css,/\.product-sample-grid/);
assert.match(css,/\.product-sample-card\.is-selected/);
assert.match(js,/for\(let pageNumber=1;pageNumber<=pdf\.numPages;pageNumber\+\+\)/,'ต้องแปลงทุกหน้า PDF');
assert.match(js,/fillText\('SAMPLE'/,'ทุกหน้าต้องมี SAMPLE');
assert.match(js,/application\/zip/);
assert.match(js,/manifest\.files/,'ต้องใช้ไฟล์ตรงของตะกร้าที่เลือก');
assert.doesNotMatch(js,/\/api\/admin\/products\/[${]/,'Frontend ห้ามแก้ข้อมูลตะกร้า');
assert.match(api,/requireAdmin/);
assert.match(api,/COALESCE\(p\.source,''\)<>'bundle'/);
assert.match(api,/NOT EXISTS\(SELECT 1 FROM product_bundle_items b WHERE b\.bundle_product_id=p\.id\)/);
assert.match(api,/NOT EXISTS\(SELECT 1 FROM courses c WHERE c\.product_id=p\.id\)/);
assert.doesNotMatch(api,/\b(?:INSERT|UPDATE|DELETE)\b/i,'API manifest ต้องอ่านอย่างเดียว');

console.log('v0.14.320 catalog card basket selector: PASS');
