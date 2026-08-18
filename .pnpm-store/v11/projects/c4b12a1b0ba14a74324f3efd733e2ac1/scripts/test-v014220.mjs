import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(file)=>fs.readFileSync(file,'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.220');

const migration=read('migrations/0051_paper_doll_category.sql');
for(const token of ["'paper-doll'","'ตุ๊กตากระดาษ'","'PDF'",'active=1','sort_order=excluded.sort_order'])assert.ok(migration.includes(token),`migration: ${token}`);

const schema=read('functions/_schema.js');
assert.match(schema,/UPDATE categories SET name='ตุ๊กตากระดาษ'.*active=1.*sort_order=27 WHERE slug='paper-doll'/);

const admin=read('public/admin.js');
assert.doesNotMatch(admin,/starterCategorySlugs = new Set\([^\n]*paper-doll/);
assert.ok(admin.includes('productCategoryOptions()'));

const catalog=read('public/catalog-sync.js');
for(const token of ['/paper-doll|ตุ๊กตากระดาษ/','"paper-doll": 0','data-category="paper-doll"','ตุ๊กตากระดาษ ${categoryCounts["paper-doll"]}'])assert.ok(catalog.includes(token),`catalog: ${token}`);
assert.match(catalog,/initialCategory = \[[^\]]*"paper-doll"/);

assert.match(read('public/product.js'),/'paper-doll':'ตุ๊กตากระดาษ'/);
assert.match(read('functions/_elon.js'),/ตุ๊กตากระดาษ.*paper-doll/);
console.log('v0.14.220 paper-doll digital product category admin storefront filter and search: PASS');
