import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [version,index,admin,digital,cart,cartJs,catalogJs,featureMap]=await Promise.all([
  'VERSION.txt','public/index.html','public/admin.html','public/digital-products.html','public/cart.html','public/cart.js','public/catalog-sync.js','FEATURE-MAP.md'
].map(read));
assert.match(index,/catalog-sync\.js\?v=014418/);
assert.match(digital,/catalog-sync\.js\?v=014418/);
assert.match(cart,/cart\.js\?v=014418/);
assert.doesNotMatch(`${index}\n${digital}`,/catalog-sync\.js\?v=014407/);
assert.doesNotMatch(cart,/cart\.js\?v=014407/);
for(const source of [cartJs,catalogJs])for(const token of ['? 75','? 50','? 25','? 15'])assert.ok(source.includes(token),token);
assert.match(featureMap,/Cache contract/);
assert.equal(version.trim(),'v0.14.418');
assert.match(index,/WEB v0\.14\.418/);
assert.match(admin,/ADMIN v0\.14\.418/);
console.log('PASS v0.14.418 cart discount scripts use fresh cache keys');
