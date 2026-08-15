import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('web patch 0.14.171 exposes the current VisionD version and keeps optional three-level product paths',()=>{
  assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.171');
  assert.match(fs.readFileSync('public/index.html','utf8'),/WEB v0\.14\.171/);
  const api=fs.readFileSync('functions/_veasy_shop.js','utf8');
  assert.match(api,/veasy_categories/);
  assert.match(api,/veasy_products/);
  assert.match(api,/UNIQUE\(shop_id,slug\)/);
});
