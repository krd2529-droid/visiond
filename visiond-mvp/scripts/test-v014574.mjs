import fs from'node:fs';import assert from'node:assert/strict';
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const helper=read('functions/_toys_center.js'),item=read('functions/api/admin/toys-center/[id].js'),list=read('functions/api/admin/toys-center/index.js'),html=read('public/toys-center-admin.html'),ui=read('public/toys-center-admin.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.574');assert.match(read('public/index.html'),/WEB v0\.14\.574/);assert.match(read('public/admin.html'),/ADMIN v0\.14\.574/);
for(const token of['storeToyImage','toyProductFields'])assert.ok(helper.includes(token)&&item.includes(token)&&list.includes(token),token);
assert.match(item,/export async function onRequestPut/);assert.match(item,/required:false/);assert.match(item,/image1\|\|old\.image_1_key/);assert.match(item,/image2\|\|old\.image_2_key/);assert.match(item,/Promise\.allSettled/);
for(const token of['แก้ไข','startEdit(item)','method:id?\'PUT\':\'POST\'','ยกเลิกแก้ไข','ไม่ต้องเลือกรูปใหม่'])assert.ok((ui+html).includes(token),token);
assert.match(html,/toys-center-admin\.js\?v=014574/);assert.match(html,/v0\.14\.574/);
console.log('v0.14.574 Toys Center edit product checks passed');
