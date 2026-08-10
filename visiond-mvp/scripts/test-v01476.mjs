import fs from 'node:fs';import assert from 'node:assert/strict';
const read=path=>fs.readFileSync(path,'utf8');
assert.ok(Number(read('VERSION.txt').trim().split('.').pop())>=76);
const login=read('public/veasy/login.js');
for(const value of ['/api/vision7/auth/login','/api/vision7/activate','/api/vision7/auth/context','/api/vision7/shops/bind','/api/vision7/auth/logout','veasy-auth-v1','accountScope','deviceId'])assert.match(login,new RegExp(value.replaceAll('/','\\/')));
assert.doesNotMatch(login.match(/window\.name=JSON\.stringify\((\{[^;]+\})\)/)?.[1]||'',/password|key:/i);
const bind=read('functions/api/vision7/shops/bind.js');assert.match(bind,/ownedVEasyLicense/);assert.match(bind,/ownedShopByLicense/);
assert.equal(JSON.parse(read('requirements-ledger.json')).requirements.find(item=>item.id==='B1-DELIVERY-001')?.status,'DONE-VERIFIED');
console.log('v0.14.76 B1 login session delivery passed');
