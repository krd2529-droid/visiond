import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [version,index,admin,v12,protocol,roadmap,ledger]=await Promise.all([read('VERSION.txt'),read('public/index.html'),read('public/admin.html'),read('public/v12-connect.html'),read('JARVIS-PATCH-PROTOCOL.md'),read('VISIOND-ROADMAP.md'),read('patch-ledgers/v0.14.207.json')]);
assert.equal(version.trim(),'v0.14.207');assert.match(index,/WEB v0\.14\.207/);assert.match(admin,/ADMIN v0\.14\.207/);assert.match(v12,/v0\.14\.207/);
for(const token of ['full-stack whenever an interaction reaches the server','authorization/role boundary','idempotency or duplicate protection','database/file mutation','allowed path and the important denied/invalid path','`UI-ONLY`'])assert.ok(protocol.includes(token),token);
for(const token of ['Full-stack Button/Event Coverage','API, สิทธิ์, validation','เส้นทางที่อนุญาต','UI-ONLY'])assert.ok(roadmap.includes(token),token);
assert.equal(JSON.parse(ledger).tasks.every(task=>task.status==='DONE-VERIFIED'),true);
console.log('v0.14.207 full-stack Button/Event coverage protocol: PASS');
