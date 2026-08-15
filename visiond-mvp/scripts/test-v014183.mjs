import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version, index, admin, adminJs, adminCss, mobileCss, ledger] = await Promise.all([
  read('VERSION.txt'), read('public/index.html'), read('public/admin.html'),
  read('public/admin.js'), read('public/admin-products.css'),
  read('public/mobile-storefront.css'), read('patch-ledgers/v0.14.183.json'),
]);
assert.equal(version.trim(), 'v0.14.183');
assert.match(index, /WEB v0\.14\.183/);
assert.match(admin, /ADMIN v0\.14\.183/);
assert.match(index, /mobile-storefront\.css\?v=014183/);
assert.match(admin, /admin\.js\?v=014183/);
assert.match(admin, /admin-products\.css\?v=014183/);
assert.match(mobileCss, /\.mobile-nav-toggle\{position:absolute;left:12px;right:12px;bottom:8px/);
assert.match(mobileCss, /height:118px!important/);
assert.match(admin, /id="publishedProductList"/);
assert.match(admin, /id="draftProductList"/);
assert.match(adminJs, /PUBLISHED_PRODUCTS_PER_PAGE = 10/);
assert.match(adminJs, /DRAFT_PRODUCTS_PER_PAGE = 5/);
assert.match(adminJs, /product\.status === "published"/);
assert.match(adminCss, /\.product-status-lists/);
assert.equal(JSON.parse(ledger).patch, 'v0.14.183');
console.log('v0.14.183 mobile menu and separated product management: PASS');
