import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [version,index,admin,adminJs,api]=await Promise.all([
  read('VERSION.txt'),read('public/index.html'),read('public/admin.html'),
  read('public/admin.js'),read('functions/api/admin/products/index.js')
]);
assert.equal(version.trim(),'v0.14.188');
assert.match(index,/WEB v0\.14\.188/);
assert.match(admin,/ADMIN v0\.14\.188/);
assert.match(admin,/admin\.js\?v=014188/);
assert.match(api,/p\.slug='course-selling-rights' OR/,'หลังบ้านต้องรวมสิทธิ์ Vision 5 ให้ยอดเท่าหน้าบ้าน');
assert.match(api,/p\.status='draft'/,'คิวร่าง Vision 4 ต้องยังแยกตามสถานะ');
assert.match(adminJs,/p\.status === "published"/,'ห้ามนับ draft เป็นสินค้าวางจำหน่าย');
assert.match(adminJs,/vision5Rights=p\.slug==="course-selling-rights"/);
assert.match(adminJs,/รวมในยอดหน้าบ้านเพื่อให้จำนวนตรงกัน/);
assert.match(adminJs,/ดูหน้าสินค้า/);
assert.doesNotMatch(adminJs,/data-edit-product="\$\{p\.id\}"[^]*vision5Rights\?'/);
console.log('v0.14.188 admin/public published count parity: PASS');
