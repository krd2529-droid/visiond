import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [version,index,admin,ui,api,editApi,schema,migration,protocol,roadmap]=await Promise.all([
  read('VERSION.txt'),read('public/index.html'),read('public/admin.html'),read('public/admin.js'),
  read('functions/api/admin/products/index.js'),read('functions/api/admin/products/[id].js'),read('functions/_schema.js'),
  read('migrations/0040_bundle_source_allocations.sql'),read('JARVIS-PATCH-PROTOCOL.md'),read('VISIOND-ROADMAP.md')
]);
assert.match(version.trim(),/^v0\.14\.\d+$/);
assert.match(index,/WEB v0\.14\.\d+/);assert.match(admin,/ADMIN v0\.14\.\d+/);
assert.match(admin,/id="newProductButton"[\s\S]*id="newBundleButton"[\s\S]*สร้างชุดรวมตะกร้า/);
for(const token of ['bundleSummary','bundleSizeMinus','bundleSizePlus','bundle_preview_count','ราคาปกติรวม','changeBundleSize','newBundleButton.onclick = openBundleBuilder'])assert.ok(admin.includes(token)||ui.includes(token),token);
assert.match(ui,/sort\(\(a,b\)=>Number\(a\.id\)-Number\(b\.id\)\)/);
assert.match(ui,/!p\.bundled_into_id/);assert.match(ui,/normalPrice=selected\.reduce/);assert.match(ui,/totalPages=selected\.reduce/);
for(const source of[api,editApi,schema,migration])assert.ok(source.includes('bundle_source_allocations'),'allocation guard');
assert.match(api,/onRequestPost\(ctx\)\{await ensureDatabase/);assert.match(editApi,/onRequestPut\(ctx\) \{[\s\S]*await ensureDatabase/);
assert.match(api,/size<2\|\|size>30/);assert.match(api,/item\.cover_url/);assert.match(api,/bundle\.pages/);
assert.match(editApi,/size < 2 \|\| size > 30/);assert.match(editApi,/a\.bundle_product_id<>\?/);
assert.match(migration,/source_product_id INTEGER PRIMARY KEY/);
assert.match(ui,/elements\.status\.value = "draft"/);assert.match(ui,/รายการตะกร้าในชุด/);
assert.match(ui,/p\.category === "tattoo"[\s\S]*p\.category === "coloring"/);assert.match(api,/sourceCategory=category==='set-tattoo'\?'tattoo':'coloring'/);
assert.ok(protocol.includes('ตรวจโค้ด → แก้ → รันทดสอบ → เจอข้อผิดพลาด → แก้อีก → ทดสอบใหม่'));
assert.match(roadmap,/v0\.14\.191[\s\S]*สร้างชุดรวมตะกร้า/);
console.log('v0.14.191 basket bundle builder: PASS');
