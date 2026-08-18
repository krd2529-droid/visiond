import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
const r=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const[v,i,a,p1,p2,t,road,ledger]=await Promise.all([r('VERSION.txt'),r('public/index.html'),r('public/admin.html'),r('JARVIS-PATCH-PROTOCOL.md'),r('work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md'),r('work-history/visiond/protocols/PATCH-HANDOFF-TEMPLATE.md'),r('work-history/visiond/roadmap/VISIOND-ROADMAP.md'),r('patch-ledgers/v0.14.186.json')]);
assert.equal(v.trim(),'v0.14.186');assert.match(i,/WEB v0\.14\.186/);assert.match(a,/ADMIN v0\.14\.186/);
for(const source of[p1,p2])for(const rule of['one Event Case','EVENT CASE: ยังไม่เสร็จ — ต้องทำต่อให้จบ','PAUSED BY BOSS','Before starting an unrelated new Event Case'])assert.ok(source.includes(rule),rule);
for(const rule of['EVENT CASE ID','Completion condition','Remaining items','Next required action','EVENT CASE: ยังไม่เสร็จ — ต้องทำต่อให้จบ'])assert.ok(t.includes(rule),rule);
assert.match(road,/v0\.14\.186/);const d=JSON.parse(ledger);assert.equal(d.parent_commit,'ac38c51');assert.deepEqual(d.remaining_items,[]);
console.log('v0.14.186 one request one Event Case completion guard: PASS');
