import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const endpoint=read('functions/api/partner/v1/products/[id].js');
const client=read('integrations/web2/visiond-partner-client.mjs');

assert.equal(read('VERSION.txt').trim(),'v0.14.408');
assert.match(read('public/index.html'),/WEB v0\.14\.408/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.408/);
assert.match(endpoint,/requirePartnerScope\(ctx,'products:read'\)/);
assert.match(endpoint,/p\.id=\?/);
assert.match(endpoint,/p\.status='published'/);
assert.match(endpoint,/p\.deleted_at IS NULL/);
assert.match(endpoint,/p\.category<>'resale-rights'/);
assert.match(endpoint,/LIMIT 1/);
assert.match(endpoint,/PRODUCT_ID_INVALID/);
assert.match(endpoint,/PRODUCT_NOT_FOUND/);
assert.doesNotMatch(endpoint,/product_files|object_key|download_url|entitlements|orders/);
assert.match(client,/product\(id\).*\/products\/\$\{Number\(id\)\}/);
assert.match(read('docs/examples/partner-api-web2.http'),/GET \{\{baseUrl\}\}\/products\/1/);
assert.match(read('FEATURE-MAP.md'),/point query หนึ่งครั้ง/);

console.log('PASS v0.14.408 Web 2 product detail metadata boundary');
