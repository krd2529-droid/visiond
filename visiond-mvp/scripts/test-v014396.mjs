import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.396');
assert.match(read('public/index.html'),/WEB v0\.14\.396/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.396/);

const products=read('functions/api/products/index.js');
assert.match(products,/const CACHE_SECONDS=60/);
assert.ok(products.indexOf('cache.match(key)')<products.indexOf('ensureDatabase(ctx.env)'),'catalog cache hit must precede D1');
assert.match(products,/view_totals AS \(SELECT product_id,SUM\(views\)/);
assert.match(products,/legacy_views AS \(SELECT product_id,COUNT\(\*\)/);
assert.match(products,/bundle_totals AS \(SELECT b\.bundle_product_id product_id,SUM\(source\.pages\)/);
assert.doesNotMatch(products,/SELECT SUM\(a\.views\) FROM analytics_daily a WHERE a\.product_id=p\.id/);
assert.doesNotMatch(products,/purgeExpiredTrash/,'public catalog must not run trash maintenance');
assert.match(products,/json\(\{items:applyPromotion\(results,promotion\),promotion\}/,'catalog response contract must remain');

const retention=read('functions/api/internal/analytics-retention.js');
assert.match(retention,/import \{purgeExpiredTrash\}/);
assert.match(retention,/trash=await purgeExpiredTrash\(ctx\.env\)/);
assert.match(read('functions/_trash.js'),/return \{trash_items_removed:items\.length,products_processed:products\.length\}/);
assert.match(read('FEATURE-MAP.md'),/CATALOG-STOREFRONT-001[\s\S]*?aggregate CTE รอบเดียวและ cache response 60 วินาที/);

console.log('PASS v0.14.396 catalog read optimization');
