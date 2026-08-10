import assert from 'node:assert/strict';
import fs from 'node:fs';

assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.82');
const handoff=fs.readFileSync('work-history/visiond/patch-history/PATCH-v0.14.82-B1-PRODUCT-DIALOG-EXIT.md','utf8');
assert.match(handoff,/V-Easy-v1\.0\.6-product-dialog-exit-source\.zip/);
assert.match(handoff,/V-Easy-v1\.0\.6-product-dialog-exit-debug\.apk/);
assert.match(handoff,/Android Back/);
assert.match(handoff,/ไม่มีการเปลี่ยน Contract/);
const ledger=JSON.parse(fs.readFileSync('requirements-ledger.json','utf8'));
const requirement=ledger.requirements.find(item=>item.id==='B1-PRODUCT-DIALOG-001');
assert.equal(requirement?.status,'DONE-VERIFIED');
assert.ok(requirement.evidence.every(file=>fs.existsSync(file)));
console.log('v0.14.82 B1 product-dialog handoff checks passed');
