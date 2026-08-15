import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [adminJs,api]=await Promise.all([
  read('public/admin.js'),read('functions/api/admin/products/index.js')
]);
assert.match(api,/p\.slug='course-selling-rights' OR/,'หลังบ้านต้องรวมสิทธิ์ Vision 5 ให้ยอดเท่าหน้าบ้าน');
assert.match(api,/p\.status='draft'/,'คิวร่าง Vision 4 ต้องยังแยกตามสถานะ');
assert.match(adminJs,/p\.status === "published"/,'ห้ามนับ draft เป็นสินค้าวางจำหน่าย');
assert.match(adminJs,/vision5Rights=p\.slug==="course-selling-rights"/);
assert.match(adminJs,/รวมในยอดหน้าบ้านเพื่อให้จำนวนตรงกัน/);
assert.match(adminJs,/ดูหน้าสินค้า/);
assert.doesNotMatch(adminJs,/data-edit-product="\$\{p\.id\}"[^]*vision5Rights\?'/);
console.log('admin/public published count parity: PASS');
