import fs from 'node:fs';import assert from 'node:assert/strict';const read=path=>fs.readFileSync(path,'utf8');
assert.ok(Number(read('VERSION.txt').trim().split('.').pop())>=76);const login=read('public/veasy/login.js');
for(const value of ['/api/vision7/auth/veasy-activate','veasy-auth-v1','accountScope','deviceId','returnState'])assert.ok(login.includes(value),value);
assert.match(login,/credentials:'same-origin'/);assert.match(login,/window\.name=''/);assert.doesNotMatch(login,/location\.(?:href|search).*(?:password|key)/i);
assert.equal(JSON.parse(read('requirements-ledger.json')).requirements.find(item=>item.id==='B1-DELIVERY-001')?.status,'DONE-VERIFIED');console.log('v0.14.76 compatible hosted session delivery passed');
