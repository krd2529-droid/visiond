import assert from 'node:assert/strict';import fs from 'node:fs';
const activation=fs.readFileSync('functions/api/vision7/auth/veasy-activate.js','utf8'),device=fs.readFileSync('functions/api/vision7/auth/veasy-device.js','utf8'),admin=fs.readFileSync('public/vision7-admin.html','utf8'),adminJs=fs.readFileSync('public/vision7-admin.js','utf8'),licenses=fs.readFileSync('functions/api/admin/vision7/licenses.js','utf8');
assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.84');
assert.match(admin,/คีย์สร้างแยกจากไฟล์ติดตั้ง/);assert.match(admin,/แยกจากการออกคีย์/);assert.match(adminJs,/ลูกค้านำไปกรอกใน Settings/);
assert.doesNotMatch(licenses,/vision7_releases|file_name|object_key/,'issuing a key must not require an installer release');
assert.match(activation,/verifyPassword/);assert.match(activation,/p\.platform_type='veasy'/);assert.match(activation,/l\.user_id=\?/);assert.match(activation,/ownedShopByLicense/);assert.match(activation,/binding_state='bound'/);assert.match(activation,/VEASY_DEVICE_LIMIT/);assert.match(activation,/issueVision7AppSession/);
assert.match(device,/device_hash=\?/);assert.match(device,/p\.platform_type='veasy'/);assert.match(device,/revokeVision7Session/);
const ledger=JSON.parse(fs.readFileSync('requirements-ledger.json','utf8'));assert.equal(ledger.requirements.find(x=>x.id==='B1-GENERIC-APK-001')?.status,'DONE-VERIFIED');
console.log('v0.14.84 generic APK and in-app activation checks passed');
