import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [version,index,admin,v12,ui,create,update,roadmap]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/v12-connect.html','public/admin.js','functions/api/admin/products/index.js','functions/api/admin/products/[id].js','VISIOND-ROADMAP.md'].map(read));
assert.equal(version.trim(),'v0.14.213');assert.match(index,/WEB v0\.14\.213/);assert.match(admin,/ADMIN v0\.14\.213/);assert.match(v12,/v0\.14\.213/);assert.match(admin,/admin\.js\?v=014213/);
assert.ok(!ui.includes('fd.set("file_type", "ชุด PDF")'));assert.match(ui,/productEditor\.elements\.file_type\.value = p\.file_type \|\| "PDF"/);
for(const source of[create,update])for(const token of['requestedFileType','ชุดรวมหลายประเภท','JPG/PNG','fileType'])assert.ok(source.includes(token),`${token} missing`);
assert.ok(!create.includes("bundle?'ชุด PDF'"));assert.match(update,/pages=\?,file_type=\?,status=\?/);assert.match(roadmap,/Bundle File Type Persistence/);
console.log('v0.14.213 bundle file type create/edit/reopen persistence: PASS');
