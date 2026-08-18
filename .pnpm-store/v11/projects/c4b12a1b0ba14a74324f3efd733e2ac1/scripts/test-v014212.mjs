import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [version,index,admin,v12,ui,backend,roadmap]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/v12-connect.html','public/admin.js','functions/api/admin/products/[id].js','VISIOND-ROADMAP.md'].map(read));
assert.equal(version.trim(),'v0.14.212');assert.match(index,/WEB v0\.14\.212/);assert.match(admin,/ADMIN v0\.14\.212/);assert.match(v12,/v0\.14\.212/);assert.match(admin,/admin\.js\?v=014212/);
for(const token of['originalCategory.startsWith("set-")','originalOption + generatedOptions','· หมวดเดิม','productEditor.elements.category.value = p.category'])assert.ok(ui.includes(token),token);
for(const token of['form.get("status") === "published" ? "published" : "draft"','status=\?',"source='bundle'"])assert.ok(backend.includes(token),token);
assert.match(roadmap,/Draft Bundle Publish Category Recovery/);
console.log('v0.14.212 draft bundle category recovery and publish validation: PASS');
