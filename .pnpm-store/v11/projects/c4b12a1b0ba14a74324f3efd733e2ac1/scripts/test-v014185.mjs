import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version,index,admin,safe,protocol,archivedProtocol,template,roadmap,ledger,note] = await Promise.all([
  read('VERSION.txt'),read('public/index.html'),read('public/admin.html'),read('SAFE-BASELINE.md'),
  read('JARVIS-PATCH-PROTOCOL.md'),read('work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md'),
  read('work-history/visiond/protocols/PATCH-HANDOFF-TEMPLATE.md'),read('work-history/visiond/roadmap/VISIOND-ROADMAP.md'),
  read('patch-ledgers/v0.14.185.json'),read('work-history/visiond/patch-history/PATCH-v0.14.185-MANDATORY-HANDOFF-SAFE-ROLLBACK.md'),
]);
assert.equal(version.trim(),'v0.14.185');assert.match(index,/WEB v0\.14\.185/);assert.match(admin,/ADMIN v0\.14\.185/);
for(const source of [protocol,archivedProtocol])for(const rule of ['What changed','Changed files','Tests','Commit identity','Rollback','PRODUCTION_VALIDATED','git revert'])assert.ok(source.includes(rule),rule);
assert.match(safe,/v0\.14\.182/);assert.match(safe,/5ea8741/);assert.match(safe,/288cd0f/);
for(const heading of ['1. แก้อะไร','2. แก้ไฟล์ใด','3. ทดสอบอะไร','4. Commit identity','5. วิธีย้อนกลับ'])assert.ok(template.includes(heading),heading);
assert.match(roadmap,/v0\.14\.185/);assert.match(note,/Parent commit: `288cd0f`/);
const data=JSON.parse(ledger);assert.equal(data.commit_id,'SELF');assert.equal(data.parent_commit,'288cd0f');assert.equal(data.safe_rollback_commit,'5ea8741');
console.log('v0.14.185 mandatory patch handoff and safe rollback: PASS');
