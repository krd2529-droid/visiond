import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {onRequestGet,onRequestPost,onRequestPatch,onRequestDelete} from '../functions/api/admin/work-links/index.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [migration73,migration92,client,html,version,indexHtml,adminHtml]=await Promise.all([
  'migrations/0073_work_links_platform.sql','migrations/0092_work_links_keyset.sql','public/work-links.js','public/work-links.html','VERSION.txt','public/index.html','public/admin.html'
].map(read));

function makeDb(mode='ready'){
  const sqlite=new DatabaseSync(':memory:'),seen=[];
  sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
INSERT INTO users VALUES(1,'boss@example.com','boss','Boss','', 'boss','2026-01-01 00:00:00');
INSERT INTO users VALUES(2,'member@example.com','member','Member','', 'member','2026-01-01 00:00:00');
INSERT INTO sessions VALUES('sid',1,'2099-01-01 00:00:00');
INSERT INTO sessions VALUES('member-sid',2,'2099-01-01 00:00:00');`);
  if(mode==='ready')sqlite.exec(migration73);
  if(mode==='legacy')sqlite.exec(`CREATE TABLE admin_work_links(id INTEGER PRIMARY KEY AUTOINCREMENT,label TEXT NOT NULL,url TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',created_by INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);INSERT INTO admin_work_links(label,url,note) VALUES('legacy','https://example.com','keep');`);
  class Bound{
    constructor(sql){this.sql=sql;this.args=[];seen.push(sql)}
    bind(...args){this.args=args;return this}
    async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
    async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}
    async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
    execute(){
      if(/^\s*(?:SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(this.sql))return{results:sqlite.prepare(this.sql).all(...this.args)};
      const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}
    }
  }
  const DB={
    prepare(sql){return new Bound(sql)},
    async batch(statements){
      sqlite.exec('BEGIN');
      try{const results=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}
    }
  };
  return{sqlite,seen,DB};
}

function context(DB,{method='GET',url='https://example.com/api/admin/work-links',body,cookie=true,session='sid'}={}){
  const init={method,headers:{}};
  if(cookie)init.headers.cookie=`vd_session=${session}`;
  if(body!==undefined){init.headers['content-type']='application/json';init.body=JSON.stringify(body)}
  return{request:new Request(url,init),env:{DB}}
}
async function payload(response){return{status:response.status,cache:response.headers.get('cache-control'),body:await response.json()}}

// Fresh and replayed migrations preserve every row and add the exact keyset index.
const ready=makeDb();
for(let id=1;id<=75;id++)ready.sqlite.prepare(`INSERT INTO admin_work_links(id,label,url,platform,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`).run(id,`Link ${id}`,`https://example.com/${id}`,'Web','', '2026-09-09 10:00:00','2026-09-09 10:00:00');
ready.sqlite.exec(migration92);ready.sqlite.exec(migration92);
assert.equal(ready.sqlite.prepare('SELECT COUNT(*) count FROM admin_work_links').get().count,75);
assert.deepEqual(ready.sqlite.prepare("PRAGMA index_info('idx_admin_work_links_updated_id')").all().map(row=>row.name),['updated_at','id']);
const firstPlan=ready.sqlite.prepare('EXPLAIN QUERY PLAN SELECT id,label,url,platform,note,created_at,updated_at FROM admin_work_links ORDER BY updated_at DESC,id DESC LIMIT ?').all(25).map(row=>row.detail).join('\n');
const cursorPlan=ready.sqlite.prepare('EXPLAIN QUERY PLAN SELECT id,label,url,platform,note,created_at,updated_at FROM admin_work_links WHERE (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT ?').all('2026-09-09 10:00:00',52,25).map(row=>row.detail).join('\n');
assert.match(firstPlan,/USING INDEX idx_admin_work_links_updated_id/);assert.doesNotMatch(firstPlan,/TEMP B-TREE/);
assert.match(cursorPlan,/SEARCH admin_work_links USING INDEX idx_admin_work_links_updated_id/);assert.doesNotMatch(cursorPlan,/TEMP B-TREE/);

// Actual handler paginates a full timestamp tie without duplicates or omissions.
const paged=[];let cursor='';
do{
  const url=`https://example.com/api/admin/work-links?limit=24${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`;
  const result=await payload(await onRequestGet(context(ready.DB,{url})));
  assert.equal(result.status,200);assert.equal(result.cache,'private, no-store');assert.ok(result.body.items.length<=24);
  paged.push(...result.body.items.map(item=>item.id));cursor=result.body.pagination.next_cursor||'';
}while(cursor);
assert.deepEqual(paged,Array.from({length:75},(_,index)=>75-index));
assert.equal(new Set(paged).size,75);
assert.ok(ready.seen.every(sql=>!/CREATE TABLE|ALTER TABLE|PRAGMA table_info/i.test(sql)),'request path must contain no schema DDL/scan');

// Auth and strict request parsing happen before work-link business SQL or writes.
ready.seen.length=0;
const unauthorized=await payload(await onRequestGet(context(ready.DB,{cookie:false})));
assert.equal(unauthorized.status,401);assert.equal(unauthorized.cache,'private, no-store');assert.equal(ready.seen.length,0);
ready.seen.length=0;
const forbidden=await payload(await onRequestGet(context(ready.DB,{session:'member-sid'})));
assert.equal(forbidden.status,403);assert.equal(forbidden.cache,'private, no-store');assert.ok(ready.seen.every(sql=>!sql.includes('admin_work_links')));
for(const query of ['limit=0','limit=25','limit=2.5','limit=abc','cursor=bad','cursor=2026-99-99%2010%3A00%3A00%7C2','cursor=2026-02-30%2010%3A00%3A00%7C2','cursor=2026-09-09%2010%3A00%3A00%7C0']){
  const result=await payload(await onRequestGet(context(ready.DB,{url:`https://example.com/api/admin/work-links?${query}`})));
  assert.equal(result.status,400,query);assert.equal(result.cache,'private, no-store');
}
const beforeInvalidMutation=ready.sqlite.prepare('SELECT COUNT(*) count FROM admin_work_links').get().count;
const invalidMutation=await payload(await onRequestPost(context(ready.DB,{method:'POST',url:'https://example.com/api/admin/work-links?cursor=bad',body:{label:'No write',url:'https://example.com/no',platform:'Web'}})));
assert.equal(invalidMutation.status,400);assert.equal(ready.sqlite.prepare('SELECT COUNT(*) count FROM admin_work_links').get().count,beforeInvalidMutation);
for(const handler of [onRequestPatch,onRequestDelete]){
  const invalidId=await payload(await handler(context(ready.DB,{method:handler===onRequestPatch?'PATCH':'DELETE',body:{id:Number.MAX_SAFE_INTEGER+1,label:'Bad',url:'https://example.com/bad',platform:'Web'}})));
  assert.equal(invalidId.status,400);
}

// CRUD remains atomic and always returns the bounded first page.
let result=await payload(await onRequestPost(context(ready.DB,{method:'POST',body:{label:'Created',url:'https://example.com/raw?a=1%2B2',platform:'Web',note:'note'}})));
assert.equal(result.status,201);assert.equal(result.body.items.length,24);assert.equal(result.body.pagination.limit,24);
const created=ready.sqlite.prepare("SELECT * FROM admin_work_links WHERE label='Created'").get();assert.ok(created);assert.equal(created.url,'https://example.com/raw?a=1%2B2');
result=await payload(await onRequestPatch(context(ready.DB,{method:'PATCH',body:{id:created.id,label:'Updated',url:'https://example.com/updated',platform:'Site',note:'changed'}})));
assert.equal(result.status,200);assert.equal(result.body.items.length,24);assert.equal(ready.sqlite.prepare('SELECT label FROM admin_work_links WHERE id=?').get(created.id).label,'Updated');
result=await payload(await onRequestDelete(context(ready.DB,{method:'DELETE',body:{id:created.id}})));
assert.equal(result.status,200);assert.equal(result.body.items.length,24);assert.equal(ready.sqlite.prepare('SELECT COUNT(*) count FROM admin_work_links WHERE id=?').get(created.id).count,0);

// Missing or legacy-incomplete schema is explicit/private and transactional: no partial insert/delete.
const missing=makeDb('missing');
result=await payload(await onRequestGet(context(missing.DB)));
assert.equal(result.status,503);assert.equal(result.cache,'private, no-store');assert.equal(result.body.code,'WORK_LINKS_SCHEMA_REQUIRED');assert.doesNotMatch(JSON.stringify(result.body),/SELECT|no such table/i);
const legacy=makeDb('legacy');
result=await payload(await onRequestPost(context(legacy.DB,{method:'POST',body:{label:'Blocked',url:'https://example.com/new',platform:'Web'}})));
assert.equal(result.status,503);assert.equal(legacy.sqlite.prepare('SELECT COUNT(*) count FROM admin_work_links').get().count,1);
result=await payload(await onRequestDelete(context(legacy.DB,{method:'DELETE',body:{id:1}})));
assert.equal(result.status,503);assert.equal(legacy.sqlite.prepare('SELECT COUNT(*) count FROM admin_work_links').get().count,1,'failed response-page select must roll back delete');
const failingDb={...ready.DB,prepare(sql){if(sql.includes('FROM admin_work_links'))throw new Error('secret SQL SELECT admin_work_links');return ready.DB.prepare(sql)}};
result=await payload(await onRequestGet(context(failingDb)));
assert.equal(result.status,500);assert.equal(result.cache,'private, no-store');assert.equal(result.body.code,'WORK_LINKS_FAILED');assert.doesNotMatch(JSON.stringify(result.body),/secret|SELECT|admin_work_links/);

// The actual page cache joins identical requests, reuses a short document-memory result and isolates generations.
const start=client.indexOf("const $=selector=>"),end=client.indexOf('function reset()');
assert.ok(start>=0&&end>start);
const elements=new Map(),element=()=>({textContent:'',value:'',classList:{toggle(){}},replaceChildren(){}});
const document={querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)}};
let fetchCalls=0,fetchImpl,now=1_000_000;
const sandbox=vm.createContext({document,URL,Date:{now:()=>now},fetch:(...args)=>{fetchCalls++;return fetchImpl(...args)}});
vm.runInContext(`${client.slice(start,end)};globalThis.listTest={request,listPage,invalidateList,listCache,listRequests}`,sandbox);
let resolveJoined;
fetchImpl=()=>new Promise(resolve=>{resolveJoined=resolve});
const joinedA=sandbox.listTest.listPage('tie'),joinedB=sandbox.listTest.listPage('tie');
assert.equal(fetchCalls,1);
resolveJoined({ok:true,json:async()=>({marker:'joined',items:[],pagination:{}})});
assert.equal((await joinedA).marker,'joined');assert.equal((await joinedB).marker,'joined');
assert.equal((await sandbox.listTest.listPage('tie')).marker,'joined');assert.equal(fetchCalls,1,'sequential request must reuse document-memory TTL');
now+=15001;
fetchImpl=async()=>({ok:true,status:200,json:async()=>({marker:'expired',items:[],pagination:{}})});
assert.equal((await sandbox.listTest.listPage('tie')).marker,'expired');assert.equal(fetchCalls,2,'expired TTL must perform one fresh request');

let resolveOld,resolveNew;
sandbox.listTest.invalidateList();
fetchImpl=()=>new Promise(resolve=>{resolveOld=resolve});
const old=sandbox.listTest.listPage('');
sandbox.listTest.invalidateList();
fetchImpl=()=>new Promise(resolve=>{resolveNew=resolve});
const fresh=sandbox.listTest.listPage('');
resolveNew({ok:true,json:async()=>({marker:'fresh',items:[],pagination:{}})});await fresh;
resolveOld({ok:true,json:async()=>({marker:'old',items:[],pagination:{}})});await old;
assert.equal(sandbox.listTest.listCache.get('').data.marker,'fresh','old generation must not repopulate cache');

sandbox.listTest.invalidateList();
fetchImpl=async()=>{throw new Error('temporary failure')};
await assert.rejects(sandbox.listTest.listPage('retry'),/temporary failure/);
fetchImpl=async()=>({ok:true,json:async()=>({marker:'recovered',items:[],pagination:{}})});
assert.equal((await sandbox.listTest.listPage('retry')).marker,'recovered','failed in-flight entry must clear');
sandbox.listTest.listCache.set('authorized',{data:{},expiresAt:now+1000});
fetchImpl=async()=>({ok:false,status:401,json:async()=>({error:'หมดอายุ'})});
await assert.rejects(sandbox.listTest.request(),/หมดอายุ/);assert.equal(sandbox.listTest.listCache.size,0,'known auth failure must clear stale authorized cache');
assert.doesNotMatch(client,/localStorage|sessionStorage/);
assert.match(client,/if\(!nextCursor\|\|mutationPending\)return Promise\.resolve/);
assert.match(client,/seen\.add\(item\.id\);items\.push\(item\)/);
assert.match(client,/if\(!shown\.length\)[\s\S]*if\(nextCursor\)/,'zero local matches must not hide Load more');
assert.match(html,/placeholder="ค้นหาในรายการที่โหลด"/);assert.match(html,/ค้นหาเฉพาะรายการที่โหลดแล้ว/);

assert.equal(version.trim(),'v0.20.70');assert.match(indexHtml,/WEB v0\.20\.70/);assert.match(adminHtml,/ADMIN v0\.20\.70/);
assert.match(html,/work-links\.js\?v=02067/);assert.match(html,/work-links\.css\?v=014590/);
console.log('PASS current work-links migration, indexed keyset, strict/atomic API and document-memory request races');
