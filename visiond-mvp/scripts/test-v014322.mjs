import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [version,home,admin,js,packageText]=await Promise.all([
  readFile(new URL('VERSION.txt',root),'utf8'),
  readFile(new URL('public/index.html',root),'utf8'),
  readFile(new URL('public/admin.html',root),'utf8'),
  readFile(new URL('public/product-sample-archive.js',root),'utf8'),
  readFile(new URL('package.json',root),'utf8'),
]);

assert.equal(version.trim(),'v0.14.322');
assert.match(home,/WEB v0\.14\.322/);
assert.match(admin,/ADMIN v0\.14\.322/);
assert.match(admin,/product-sample-archive\.js\?v=014322/);
assert.match(js,/safeArchiveName\(manifest\.product\.title\)/,'ชื่อ ZIP ต้องเริ่มจากชื่อตะกร้า');
assert.match(js,/safeArchiveName\(manifest\.product\.slug\)/,'ต้องมี Slug เป็นชื่อสำรอง');
assert.match(js,/anchor\.download=`\$\{basketName\}\.zip`/,'ต้องดาวน์โหลดเป็นชื่อตะกร้า.zip');
assert.doesNotMatch(js,/-sample-all-pages\.zip/,'ห้ามใช้ชื่อ ZIP แบบ Slug เดิม');
assert.match(js,/normalize\('NFC'\)/,'ต้องรักษาชื่อ Unicode และภาษาไทย');
assert.equal(JSON.parse(packageText).scripts['test:v014322'],'node scripts/test-v014322.mjs');

console.log('v0.14.322 basket-title ZIP filename: PASS');
