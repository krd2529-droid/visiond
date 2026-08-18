import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {onRequest as rootMiddleware} from '../functions/_middleware.js';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
let reached=false;
const trusted=await rootMiddleware({
  request:new Request('https://visiondonline.com/api/vision7/shops/shop-1',{method:'PATCH',headers:{origin:'null'}}),
  next:async()=>{reached=true;return new Response('{}',{status:401,headers:{'content-type':'application/json'}})}
});
assert.equal(reached,true);assert.equal(trusted.status,401);
reached=false;
const evil=await rootMiddleware({
  request:new Request('https://visiondonline.com/api/vision7/shops/shop-1',{method:'PATCH',headers:{origin:'https://evil.example'}}),
  next:async()=>{reached=true;return new Response('{}')}
});
assert.equal(reached,false);assert.equal(evil.status,403);
const api=read('functions/api/admin/vision7/licenses.js'),ui=read('public/vision7-admin.js'),css=read('public/vision7.css'),shop=read('functions/api/vision7/shops/[shopId]/index.js');
const resetBlock=api.slice(api.indexOf('action === "reset_devices"'),api.indexOf('action === "status"'));
assert.match(resetBlock,/UPDATE vision7_license_devices SET revoked_at=CURRENT_TIMESTAMP/);assert.match(resetBlock,/device_slots_reset_by_operator/);assert.match(resetBlock,/shop_preserved: true/);assert.doesNotMatch(resetBlock,/DELETE FROM vision7_licenses/);
assert.match(ui,/ล้างสล็อตคีย์/);assert.match(ui,/data-reset-slots/);assert.match(css,/overflow:visible/);assert.doesNotMatch(css,/min-width:1120px/);assert.match(shop,/VEASY_SHOP_PROFILE_SAVE_FAILED/);
assert.match(read('public/vision7-admin.html'),/vision7\.css\?v=014118/);assert.match(read('public/vision7-admin.html'),/vision7-admin\.js\?v=014118/);
console.log('v0.14.118 B1 slug, slot reset and responsive key history passed');
