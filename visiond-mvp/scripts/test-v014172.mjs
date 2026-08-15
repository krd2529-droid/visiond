import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [schema,createApi,updateApi,adminHtml,adminJs,ledger]=await Promise.all([
  read('functions/_schema.js'),read('functions/api/admin/products/index.js'),
  read('functions/api/admin/products/[id].js'),read('public/admin.html'),
  read('public/admin.js'),read('patch-ledgers/v0.14.172.json')
]);

assert.match(schema,/bundle-deals','โปรยกชุด'/);
for(const size of [10,20,30,50])assert.match(adminHtml,new RegExp(`bundle_size" value="${size}"`));
assert.match(createApi,/\[10,20,30,50\]/);
assert.match(updateApi,/\[10, 20, 30, 50\]/);
assert.match(createApi,/items\.map\(item=>item\.cover_url\)/);
assert.match(updateApi,/orderedItems\.map\(item=>item\.cover_url\)/);
assert.match(createApi,/item\.title.*รูป/);
assert.match(adminJs,/totalFiles.*totalPages/s);
assert.equal(JSON.parse(ledger).version,'0.14.172');
console.log('v0.14.172 bundle-deals contract: PASS');
