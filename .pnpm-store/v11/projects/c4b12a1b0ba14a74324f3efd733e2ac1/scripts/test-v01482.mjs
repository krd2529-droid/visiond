import assert from 'node:assert/strict';
import fs from 'node:fs';

const [,major,minor,patch]=fs.readFileSync('VERSION.txt','utf8').trim().match(/^v(\d+)\.(\d+)\.(\d+)$/)||[];
assert.ok(Number(major)===0&&Number(minor)===14&&Number(patch)>=82,'v0.14.82 capability must remain in later patches');
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
