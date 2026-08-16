import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const[version,index,admin,v12,ui,create,update,roadmap]=await Promise.all([read('VERSION.txt'),read('public/index.html'),read('public/admin.html'),read('public/v12-connect.html'),read('public/admin.js'),read('functions/api/admin/products/index.js'),read('functions/api/admin/products/[id].js'),read('VISIOND-ROADMAP.md')]);
assert.equal(version.trim(),'v0.14.209');assert.match(index,/WEB v0\.14\.209/);assert.match(admin,/ADMIN v0\.14\.209/);assert.match(admin,/admin\.js\?v=014209/);assert.match(v12,/v0\.14\.209/);
for(const token of ['promotionSourceCategories','bundle-deals','โปรยกชุด (แบบฝึกหัด + ระบายสี + เกมเสริมพัฒนาการ)','promotionBundleCategories.has(p.category)'])assert.ok(ui.includes(token),token);
for(const source of[create,update])for(const token of ['bundle-deals','worksheet','coloring','development-game'])assert.ok(source.includes(token),`backend missing ${token}`);
assert.ok(create.includes('หมวดโปรยกชุดยังไม่เปิดใช้งาน'));assert.ok(update.includes('promotionBundle'));
assert.match(roadmap,/Mixed Promotion Bundle/);console.log('v0.14.209 mixed promotion bundle frontend/backend events: PASS');
