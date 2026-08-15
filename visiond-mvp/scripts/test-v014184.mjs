import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [version,index,admin,roadmap,marketing,analysis,patchNote,ledger] = await Promise.all([
  read('VERSION.txt'), read('public/index.html'), read('public/admin.html'),
  read('work-history/visiond/roadmap/VISIOND-ROADMAP.md'),
  read('work-history/visiond/roadmap/VISIOND-MARKETING-PLAN.md'),
  read('work-history/visiond/roadmap/CUSTOMER-DATA-ANALYSIS.md'),
  read('work-history/visiond/patch-history/PATCH-v0.14.184-ROADMAP-HISTORICAL-CONTINUITY.md'),
  read('patch-ledgers/v0.14.184.json'),
]);
assert.equal(version.trim(),'v0.14.184');
assert.match(index,/WEB v0\.14\.184/);assert.match(admin,/ADMIN v0\.14\.184/);
for(let patch=163;patch<=184;patch++)assert.match(roadmap,new RegExp(`v0\\.14\\.${patch}`));
assert.match(roadmap,/v0\.14\.180[\s\S]{0,120}REVERTED/);
assert.match(roadmap,/eddde97/);assert.match(marketing,/v0\.14\.180 failed rollout \(REVERTED\)/);
assert.match(analysis,/ไม่มี production customer dataset/);assert.match(patchNote,/Production tree คือ `visiond-mvp`/);
assert.equal(JSON.parse(ledger).patch,'v0.14.184');
console.log('v0.14.184 roadmap historical continuity: PASS');
