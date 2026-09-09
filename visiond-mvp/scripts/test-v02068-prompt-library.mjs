import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {onRequestGet as listPrompts,onRequestPost as createPrompt} from '../functions/api/admin/prompt-library/index.js';
import {onRequestGet as getPrompt,onRequestPatch as updatePrompt,onRequestDelete as deletePrompt} from '../functions/api/admin/prompt-library/[id].js';
import {copyPromptExactly,createPromptLibraryStore,importedPromptState,promptValueForSave} from '../public/prompt-library.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [migration,client,html,css,admin,version,indexHtml]=await Promise.all(['migrations/0093_prompt_library.sql','public/prompt-library.js','public/prompt-library.html','public/prompt-library.css','public/admin.html','VERSION.txt','public/index.html'].map(read));

function makeDb({ready=true}={}){
  const sqlite=new DatabaseSync(':memory:'),seen=[];
  sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
INSERT INTO users VALUES(1,'boss@example.com','boss','Boss','', 'boss','2026-01-01 00:00:00');
INSERT INTO users VALUES(2,'admin@example.com','admin','Admin','', 'admin','2026-01-01 00:00:00');
INSERT INTO users VALUES(3,'member@example.com','member','Member','', 'member','2026-01-01 00:00:00');
INSERT INTO sessions VALUES('boss-sid',1,'2099-01-01 00:00:00');
INSERT INTO sessions VALUES('admin-sid',2,'2099-01-01 00:00:00');
INSERT INTO sessions VALUES('member-sid',3,'2099-01-01 00:00:00');`);
  if(ready){sqlite.exec(migration);sqlite.exec(migration)}
  class Bound{
    constructor(sql){this.sql=sql;this.args=[];seen.push(sql)}bind(...args){this.args=args;return this}
    async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
    async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}
    async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
  }
  return{sqlite,seen,DB:{prepare:sql=>new Bound(sql)}}
}
function ctx(DB,{method='GET',url='https://example.com/api/admin/prompt-library',body,session='boss-sid',id}={}){const init={method,headers:{}};if(session)init.headers.cookie=`vd_session=${session}`;if(body!==undefined){init.headers['content-type']='application/json';init.body=JSON.stringify(body)}return{request:new Request(url,init),env:{DB},params:id===undefined?{}:{id:String(id)}}}
async function result(response){return{status:response.status,cache:response.headers.get('cache-control'),body:await response.json()}}
const payload=(overrides={})=>({expected_viewer_id:1,title:'Synthetic Prompt',model_label:'Seedance',source_platform:'Migoo',source_note:'closed source',notes:'',prompt_text:'intro\r\n---\r\n{"synthetic":true}\r\n',example_url:'',example_note:'ตัวอย่างอยู่ในกลุ่มปิด',...overrides});

// Migration is replay-safe; the two owner-first query shapes are indexed and never temp-sort.
const ready=makeDb();
assert.deepEqual(ready.sqlite.prepare("PRAGMA index_info('idx_prompt_library_owner_updated')").all().map(row=>row.name),['created_by','updated_at','id']);
assert.deepEqual(ready.sqlite.prepare("PRAGMA index_info('idx_prompt_library_owner_title')").all().map(row=>row.name),['created_by','title_key','id']);
const recentPlan=ready.sqlite.prepare('EXPLAIN QUERY PLAN SELECT id,title,title_key,model_label,source_platform,prompt_chars,created_at,updated_at FROM admin_prompt_library WHERE created_by=? AND (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT ?').all(1,'2026-09-09 10:00:00',50,25).map(row=>row.detail).join('\n');
const titlePlan=ready.sqlite.prepare('EXPLAIN QUERY PLAN SELECT id,title,title_key FROM admin_prompt_library WHERE created_by=? AND title_key>=? AND title_key<? ORDER BY title_key ASC,id DESC LIMIT ?').all(1,'seedance','seedancf',25).map(row=>row.detail).join('\n');
assert.match(recentPlan,/idx_prompt_library_owner_updated/);assert.doesNotMatch(recentPlan,/TEMP B-TREE/);
assert.match(titlePlan,/idx_prompt_library_owner_title/);assert.doesNotMatch(titlePlan,/TEMP B-TREE/);

// 73 equal-timestamp owner rows paginate completely; another owner's rows never leak.
const insert=ready.sqlite.prepare(`INSERT INTO admin_prompt_library(title,title_key,model_label,source_platform,prompt_text,prompt_sha256,prompt_chars,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
for(let id=1;id<=73;id++){const title=id<=30?'Seedance Tie':`Seedance ${String(id).padStart(3,'0')}`;insert.run(title,title.toLowerCase(),'Seedance','Synthetic',`body-${id}`,String(id).padStart(64,'0'),7,1,'2026-09-09 10:00:00','2026-09-09 10:00:00')}
insert.run('Seedance Other','seedance other','Seedance','Synthetic','private-other','f'.repeat(64),13,2,'2026-09-09 10:00:00','2026-09-09 10:00:00');
const ids=[];let cursor='';do{const response=await result(await listPrompts(ctx(ready.DB,{url:`https://example.com/api/admin/prompt-library?limit=24${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`})));assert.equal(response.status,200);assert.equal(response.cache,'private, no-store');assert.ok(response.body.items.length<=24);assert.ok(response.body.items.every(item=>!('prompt_text'in item)&&!('example_url'in item)&&!('title_key'in item)));ids.push(...response.body.items.map(item=>item.id));cursor=response.body.pagination.next_cursor||''}while(cursor);
assert.equal(ids.length,73);assert.equal(new Set(ids).size,73);assert.deepEqual(ids,Array.from({length:73},(_,index)=>73-index));
const titleIds=[];cursor='';do{const response=await result(await listPrompts(ctx(ready.DB,{url:`https://example.com/api/admin/prompt-library?limit=7&q=Seedance%20Tie${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`})));assert.equal(response.status,200);titleIds.push(...response.body.items.map(item=>item.id));cursor=response.body.pagination.next_cursor||''}while(cursor);assert.equal(titleIds.length,30);assert.equal(new Set(titleIds).size,30);
const longThai='ก'.repeat(160);for(let id=80;id<88;id++)insert.run(longThai,longThai,'Seedance','Synthetic',`thai-${id}`,String(id).padStart(64,'a'),7,1,'2026-09-09 11:00:00','2026-09-09 11:00:00');
let first=await result(await listPrompts(ctx(ready.DB,{url:`https://example.com/api/admin/prompt-library?limit=7&q=${encodeURIComponent(longThai)}`})));assert.equal(first.status,200);assert.ok(first.body.pagination.next_cursor.length>1024);const thaiNext=await result(await listPrompts(ctx(ready.DB,{url:`https://example.com/api/admin/prompt-library?limit=7&q=${encodeURIComponent(longThai)}&cursor=${encodeURIComponent(first.body.pagination.next_cursor)}`})));assert.equal(thaiNext.status,200);assert.equal(thaiNext.body.items.length,1);

// Strict parsing binds title cursors to the exact normalized query and canonical route ids.
first=await result(await listPrompts(ctx(ready.DB,{url:'https://example.com/api/admin/prompt-library?limit=7&q=Seedance'})));assert.ok(first.body.pagination.next_cursor);
for(const url of [`https://example.com/api/admin/prompt-library?limit=0`,`https://example.com/api/admin/prompt-library?limit=25`,`https://example.com/api/admin/prompt-library?q=Seedance%20Tie&cursor=${encodeURIComponent(first.body.pagination.next_cursor)}`])assert.equal((await result(await listPrompts(ctx(ready.DB,{url})))).status,400);
for(const id of ['1e1','0x10',' 1','01',String(Number.MAX_SAFE_INTEGER+1)])assert.equal((await result(await getPrompt(ctx(ready.DB,{id})))).status,400,id);

// Authentication happens before library work and failures are private.
ready.seen.length=0;let response=await result(await listPrompts(ctx(ready.DB,{session:null})));assert.equal(response.status,401);assert.equal(response.cache,'private, no-store');assert.ok(ready.seen.every(sql=>!sql.includes('admin_prompt_library')));
ready.seen.length=0;response=await result(await listPrompts(ctx(ready.DB,{session:'member-sid'})));assert.equal(response.status,403);assert.equal(response.cache,'private, no-store');assert.ok(ready.seen.every(sql=>!sql.includes('admin_prompt_library')));
const missing=makeDb({ready:false});response=await result(await listPrompts(ctx(missing.DB)));assert.equal(response.status,503);assert.equal(response.cache,'private, no-store');assert.equal(response.body.code,'PROMPT_LIBRARY_SCHEMA_REQUIRED');assert.doesNotMatch(JSON.stringify(response.body),/SELECT|no such table/i);

// Exact raw text round-trips, retries deduplicate per owner, metadata conflicts never overwrite.
const exact='synthetic heading\r\n-----\r\n{"line":"หนึ่ง"}\r\n';
response=await result(await createPrompt(ctx(ready.DB,{method:'POST',body:payload({prompt_text:exact,title:'Exact CRLF'})})));assert.equal(response.status,201);const exactId=response.body.id,exactHash=response.body.prompt_sha256;
response=await result(await createPrompt(ctx(ready.DB,{method:'POST',body:payload({prompt_text:exact,title:'Exact CRLF'})})));assert.equal(response.status,200);assert.equal(response.body.id,exactId);assert.equal(response.body.deduplicated,true);assert.equal(response.body.prompt_sha256,exactHash);
response=await result(await getPrompt(ctx(ready.DB,{id:exactId})));assert.equal(response.status,200);assert.equal(response.body.item.prompt_text,exact);assert.equal(response.body.item.prompt_sha256,exactHash);
response=await result(await createPrompt(ctx(ready.DB,{method:'POST',body:payload({prompt_text:exact,title:'Different metadata'})})));assert.equal(response.status,409);assert.equal(ready.sqlite.prepare('SELECT title FROM admin_prompt_library WHERE id=?').get(exactId).title,'Exact CRLF');
response=await result(await createPrompt(ctx(ready.DB,{method:'POST',session:'admin-sid',body:payload({expected_viewer_id:2,prompt_text:exact,title:'Other owner exact'})})));assert.equal(response.status,201);assert.notEqual(response.body.id,exactId);

// Owner-scoped ids are indistinguishable from missing, and stale account mutations write nothing.
for(const handler of [getPrompt,updatePrompt,deletePrompt]){const method=handler===getPrompt?'GET':handler===updatePrompt?'PATCH':'DELETE',body=method==='GET'?undefined:method==='DELETE'?{expected_viewer_id:2}:payload({expected_viewer_id:2});response=await result(await handler(ctx(ready.DB,{method,session:'admin-sid',id:exactId,body})));assert.equal(response.status,404)}
const beforeTitle=ready.sqlite.prepare('SELECT title FROM admin_prompt_library WHERE id=?').get(exactId).title;
response=await result(await updatePrompt(ctx(ready.DB,{method:'PATCH',id:exactId,body:payload({expected_viewer_id:2,title:'Must not write',prompt_text:exact})})));assert.equal(response.status,409);assert.equal(response.body.code,'PROMPT_LIBRARY_IDENTITY_CHANGED');assert.equal(ready.sqlite.prepare('SELECT title FROM admin_prompt_library WHERE id=?').get(exactId).title,beforeTitle);

// Invalid metadata/URLs/types and oversized bodies reject without truncation or writes.
for(const bad of [payload({title:{bad:true}}),payload({notes:['bad']}),payload({example_url:'http://example.com'}),payload({example_url:'javascript:alert(1)'})])assert.equal((await result(await createPrompt(ctx(ready.DB,{method:'POST',body:bad})))).status,400);
response=await result(await createPrompt(ctx(ready.DB,{method:'POST',body:payload({prompt_text:'x'.repeat(60001)})})));assert.equal(response.status,413);
response=await result(await createPrompt(ctx(ready.DB,{method:'POST',body:payload({title:'ﬃ'.repeat(160),prompt_text:'unicode boundary'})})));assert.equal(response.status,400);

// Store joins requests, uses owner-keyed TTL, injects expected viewer, invalidates details, and ignores stale owner responses.
let calls=0,now=1000,resolveFirst;const fetcher=(url,options)=>{calls++;if(resolveFirst)return new Promise(resolve=>resolveFirst=resolve);return Promise.resolve({ok:true,status:200,json:async()=>({viewer_id:1,items:[],pagination:{},item:{id:9,prompt_text:'x'}})})};
const store=createPromptLibraryStore({fetcher,now:()=>now});const joinedA=store.loadList(),joinedB=store.loadList();await Promise.all([joinedA,joinedB]);assert.equal(calls,1);await store.loadList();assert.equal(calls,1);now+=15001;await store.loadList();assert.equal(calls,2);
let mutationBody;const mutating=createPromptLibraryStore({fetcher:async(url,options)=>{calls++;mutationBody=JSON.parse(options.body);return{ok:true,status:200,json:async()=>({viewer_id:12,ok:true})}}});await assert.rejects(()=>mutating.mutate('/api/admin/prompt-library',{method:'POST',body:'{}'}),/ตรวจสอบบัญชี/);assert.equal(mutationBody,undefined);const establish=createPromptLibraryStore({fetcher:async(url,options)=>options?({ok:true,status:200,json:async()=>({viewer_id:12,ok:true})}):({ok:true,status:200,json:async()=>({viewer_id:12,items:[],pagination:{}})})});await establish.loadList();await establish.mutate('/api/admin/prompt-library',{method:'POST',body:JSON.stringify({title:'x'})});
let injected;const injection=createPromptLibraryStore({fetcher:async(url,options)=>{if(options)injected=JSON.parse(options.body);return{ok:true,status:200,json:async()=>options?({viewer_id:12,ok:true}):({viewer_id:12,items:[],pagination:{}})}}});await injection.loadList();await injection.mutate('/api/admin/prompt-library',{method:'POST',body:JSON.stringify({title:'x'})});assert.equal(injected.expected_viewer_id,12);
let oldResolve,phase='establish';
const race=createPromptLibraryStore({
  fetcher:async()=>{
    if(phase==='establish')return{ok:true,status:200,json:async()=>({viewer_id:1,items:[],pagination:{}})};
    if(phase==='old')return new Promise(resolve=>{oldResolve=resolve});
    return{ok:true,status:200,json:async()=>({viewer_id:2,items:[],pagination:{}})}
  }
});
await race.loadList();phase='old';const old=race.loadList({fresh:true});race.invalidate({all:true});phase='new';await race.loadList({fresh:true});oldResolve({ok:true,status:200,json:async()=>({viewer_id:1,items:[],pagination:{}})});await old;assert.equal(race.viewerId,2);

// File shadow and clipboard preserve exact CRLF; failure is honest and performs no network.
const shadow=importedPromptState(exact);assert.equal(promptValueForSave(exact.replaceAll('\r\n','\n'),shadow),exact);shadow.dirty=true;assert.equal(promptValueForSave(exact.replaceAll('\r\n','\n'),shadow),exact.replaceAll('\r\n','\n'));
let copied='';assert.equal(await copyPromptExactly(exact,{writeText:async value=>{copied=value}}),true);assert.equal(copied,exact);assert.equal(await copyPromptExactly(exact,{writeText:async()=>{throw new Error('denied')}}),false);assert.equal(await copyPromptExactly(exact,null),false);

// Public assets contain no seeded prompt, media embed/provider fetch, or public cache; UI remains responsive and explicit.
for(const token of ['Mink — ฝ่าวงล้อมกลางห้องประชุม 30 วินาที','BAC7C398F0FCA22CFC4C551EC7DB7EAA0A5561ECAA6AD817900486BBEE52CF29'])assert.doesNotMatch(client+html,new RegExp(token));
assert.doesNotMatch(client+html,/<(?:img|video|iframe)|localStorage|sessionStorage/i);assert.match(html,/ค้นหาชื่อขึ้นต้น/);assert.match(html,/ยังไม่มีลิงก์ตัวอย่าง/);assert.match(html,/prompt-library\.js\?v=02068/);assert.match(html,/prompt-library\.css\?v=014591/);assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/\.prompt-detail \[hidden\]\{display:none!important\}/);assert.match(admin,/href="\/prompt-library\.html"[^>]+PROMPT-LIBRARY-001/);
assert.equal(version.trim(),'v0.20.71');assert.match(indexHtml,/WEB v0\.20\.71/);assert.match(admin,/ADMIN v0\.20\.71/);
console.log('PASS v0.20.68 owner-private prompt library, exact raw fidelity, indexed keysets, lazy caches and safe client workflow');
