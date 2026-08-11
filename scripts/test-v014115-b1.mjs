import fs from 'node:fs';import assert from 'node:assert/strict';
const read=file=>fs.readFileSync(file,'utf8'),html=read('public/veasy/login.html'),hosted=read('public/veasy/login.js');
assert.equal(read('VERSION.txt').trim(),'v0.14.115');
assert.match(html,/name="shop_name"/);assert.match(html,/login\.js\?v=014115/);
assert.match(hosted,/veasy-activation-request-v1/);assert.match(hosted,/\/api\/vision7\/auth\/veasy-activate/);assert.match(hosted,/credentials:'same-origin'/);assert.match(hosted,/window\.name=''/);assert.match(hosted,/handoff\.returnState!==params\.get\('state'\)/);assert.match(hosted,/history\.back\(\)/);
assert.doesNotMatch(hosted,/location\.(?:href|search).*(?:password|key)/);
console.log('v0.14.115 hosted activation handoff contract passed');
