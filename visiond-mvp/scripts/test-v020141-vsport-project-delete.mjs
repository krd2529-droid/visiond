import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {onRequestDelete,onRequestPost} from '../functions/api/admin/vsport.js';

const require=createRequire(import.meta.url),sharp=require('sharp'),root=new URL('../',import.meta.url),text=relative=>readFile(new URL(relative,root),'utf8');
const [migration111,migration115,source]=await Promise.all(['migrations/0111_vsport.sql','migrations/0115_vsport_project_delete.sql','functions/api/admin/vsport.js'].map(text));
assert.match(migration115,/vsport_project_deletions/);assert.match(migration115,/vsport_object_cleanup_jobs/);assert.match(migration115,/object_key TEXT NOT NULL UNIQUE/);assert.match(migration115,/idx_vsport_cleanup_state_due/);assert.match(migration115,/ingest_fence/);assert.match(source,/export async function onRequestDelete/);assert.doesNotMatch(source,/FILES\.(?:list|delete)\([^)]*vsport\//);assert.match(source,/head\(objectKey\)[\s\S]*delete\(objectKey\)[\s\S]*head\(objectKey\)/);

class BoundStatement{
  constructor(owner,sql,bindings=[]){this.owner=owner;this.sql=sql;this.bindings=bindings}
  bind(...bindings){return new BoundStatement(this.owner,this.sql,bindings)}
  async first(){return this.owner.db.prepare(this.sql).get(...this.bindings)||null}
  async all(){return{success:true,results:this.owner.db.prepare(this.sql).all(...this.bindings)}}
  async run(){const result=this.owner.db.prepare(this.sql).run(...this.bindings);return{success:true,meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid||0)},results:[]}}
}
class D1Mock{
  constructor(db){this.db=db;this.queries=[];this.failNextBatch=false;this.beforeBatch=null}
  prepare(sql){this.queries.push(sql);return new BoundStatement(this,sql)}
  async batch(statements){if(this.beforeBatch){const hook=this.beforeBatch,consumed=await hook(statements);if(consumed!==false)this.beforeBatch=null}if(this.failNextBatch){this.failNextBatch=false;throw new Error('synthetic pre-commit failure')}this.db.exec('BEGIN IMMEDIATE');try{const results=[];for(const statement of statements)results.push(await statement.run());this.db.exec('COMMIT');return results}catch(error){try{this.db.exec('ROLLBACK')}catch{}throw error}}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}};
class R2Mock{
  constructor(){this.objects=new Map();this.headCalls=[];this.deleteCalls=[];this.putCalls=[];this.deleteFailures=new Set();this.putGate=null}
  seed(key,value=new Uint8Array([1,2,3])){this.objects.set(key,new Uint8Array(value))}
  async put(key,value){this.putCalls.push(key);if(this.putGate){const gate=this.putGate;gate.seen.resolve(key);await gate.release.promise}this.objects.set(key,new Uint8Array(value))}
  async head(key){this.headCalls.push(key);return this.objects.has(key)?{size:this.objects.get(key).byteLength}:null}
  async delete(key){this.deleteCalls.push(key);if(this.deleteFailures.has(key))throw new Error('synthetic delete failure');this.objects.delete(key)}
}

const db=new DatabaseSync(':memory:');db.exec(`
  PRAGMA foreign_keys=ON;
  CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
  CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
  CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT);
  CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,active INTEGER);
  CREATE TABLE courses(id INTEGER PRIMARY KEY,product_id INTEGER,course_type TEXT);
  CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER);
  INSERT INTO users VALUES(1,'admin@example.com','admin','Admin','','admin','2026-01-01');
  INSERT INTO users VALUES(2,'other@example.com','other','Other','','admin','2026-01-01');
  INSERT INTO users VALUES(3,'member@example.com','member','Member','','member','2026-01-01');
  INSERT INTO sessions VALUES('admin-session',1,'2099-01-01');
  INSERT INTO sessions VALUES('other-session',2,'2099-01-01');
  INSERT INTO sessions VALUES('member-session',3,'2099-01-01');
`);db.exec(migration111);db.exec(migration115);
const d1=new D1Mock(db),r2=new R2Mock(),env={DB:d1,FILES:r2},waits=[];
const context=(method,{session='admin-session',body,headers={}}={})=>{const requestHeaders=new Headers(headers);if(session)requestHeaders.set('cookie',`vd_session=${session}`);let payload;if(body!==undefined){payload=typeof body==='string'?body:JSON.stringify(body);requestHeaders.set('content-type','application/json')}return{request:new Request('https://visiondonline.com/api/admin/vsport',{method,headers:requestHeaders,body:payload}),env,waitUntil(promise){waits.push(promise)}}};
const bodyOf=async response=>({status:response.status,headers:response.headers,json:await response.json()});
const makeProject=(owner,title)=>Number(db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(?,?,?,'specific_team','Manchester United',30) RETURNING id").get(owner,title,'2026-09-29').id);
const seedStory=projectId=>Number(db.prepare("INSERT INTO vsport_stories(project_id,headline,team_name,publisher,source_url,published_at,retrieved_at,fingerprint) VALUES(?,'Story','Manchester United','Fixture','https://example.invalid/story','2026-09-29','2026-09-29',?) RETURNING id").get(projectId,`story-${projectId}`).id);
const seedCandidate=(projectId,storyId,state='candidate')=>Number(db.prepare("INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher,state) VALUES(?,?,'https://example.invalid/image.png','https://example.invalid/story','Fixture',?) RETURNING id").get(projectId,storyId,state).id);
const seedAsset=(projectId,storyId,key,index)=>{db.prepare("INSERT INTO vsport_assets(project_id,story_id,owner_id,object_key,source_url,source_page_url,publisher,mime_type,file_size,width,height) VALUES(?,?,1,?,'https://example.invalid/image.png','https://example.invalid/story','Fixture','image/png',3,320,180)").run(projectId,storyId,key);r2.seed(key,new Uint8Array([index,2,3]))};
const del=(projectId,title,key,session='admin-session')=>onRequestDelete(context('DELETE',{session,headers:{'Idempotency-Key':key},body:{project_id:projectId,expected_title:title}}));

let response=await bodyOf(await onRequestDelete(context('DELETE',{session:'',body:'not-json'})));assert.equal(response.status,401,'authentication happens before body parsing');assert.match(response.headers.get('cache-control'),/private, no-store/);
response=await bodyOf(await onRequestDelete(context('DELETE',{body:{project_id:'bad',expected_title:'x'},headers:{'Idempotency-Key':'delete.bad.0001'}})));assert.equal(response.status,400);
response=await bodyOf(await onRequestDelete(context('DELETE',{body:{project_id:1,expected_title:'x',owner_id:2},headers:{'Idempotency-Key':'delete.bad.0002'}})));assert.equal(response.status,400,'client ownership fields fail closed');

const otherProject=makeProject(2,'Other owner');response=await bodyOf(await del(otherProject,'Other owner','delete.other.0001'));assert.equal(response.status,404);
const activeProject=makeProject(1,'Active job');db.prepare("INSERT INTO vsport_jobs(id,owner_id,project_id,job_type,idempotency_key,status) VALUES('active-job',1,?,'discover','active-job-key','running')").run(activeProject);response=await bodyOf(await del(activeProject,'Active job','delete.active.0001'));assert.equal(response.status,409);assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_project_deletions WHERE project_id=?').get(activeProject).count,0);assert.equal(r2.deleteCalls.length,0);

const target=makeProject(1,'Delete 26 assets'),targetStory=seedStory(target);db.prepare("INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher) VALUES(?,?,'https://example.invalid/target.png','https://example.invalid/story','Fixture')").run(target,targetStory);for(let index=0;index<26;index++)seedAsset(target,targetStory,`vsport/1/${target}/asset-${index}.png`,index);const sibling=makeProject(1,'Keep sibling'),siblingStory=seedStory(sibling);seedAsset(sibling,siblingStory,`vsport/1/${sibling}/keep.png`,99);
response=await bodyOf(await del(target,'Delete 26 assets','delete.target.0001'));assert.equal(response.status,202);assert.equal(response.json.deleted,true);assert.equal(response.json.cleanup_pending,true);assert.equal(response.json.cleanup_processed,24);assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_projects WHERE id=?').get(target).count,0);for(const table of['vsport_stories','vsport_image_candidates','vsport_assets','vsport_jobs'])assert.equal(db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE project_id=?`).get(target).count,0,table);assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_projects WHERE id=?').get(sibling).count,1);assert.equal(r2.objects.has(`vsport/1/${sibling}/keep.png`),true);assert.equal(new Set(r2.deleteCalls.slice(-24)).size,24,'only exact keys are deleted');
response=await bodyOf(await del(target,'Delete 26 assets','delete.target.0001'));assert.equal(response.status,200);assert.equal(response.json.replayed,true);assert.equal(response.json.cleanup_pending,false);assert.equal(response.json.cleanup_processed,2);assert.equal(db.prepare("SELECT cleanup_state FROM vsport_project_deletions WHERE project_id=?").get(target).cleanup_state,'complete');assert.equal(db.prepare("SELECT COUNT(*) count FROM vsport_object_cleanup_jobs WHERE project_id=? AND status<>'done'").get(target).count,0);assert.equal(r2.headCalls.length,52,'each of 26 objects receives exact head-before/head-after');
response=await bodyOf(await del(target,'Different title','delete.target.0001'));assert.equal(response.status,409);response=await bodyOf(await del(target,'Delete 26 assets','delete.target.0002'));assert.equal(response.status,409);

const failedProject=makeProject(1,'Rollback target'),failedStory=seedStory(failedProject);seedAsset(failedProject,failedStory,`vsport/1/${failedProject}/rollback.png`,1);const deletesBefore=r2.deleteCalls.length;d1.failNextBatch=true;response=await bodyOf(await del(failedProject,'Rollback target','delete.rollback.0001'));assert.equal(response.status,500);assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_projects WHERE id=?').get(failedProject).count,1);assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_project_deletions WHERE project_id=?').get(failedProject).count,0);assert.equal(r2.deleteCalls.length,deletesBefore,'R2 is untouched before failed D1 commit');

const partialProject=makeProject(1,'Partial cleanup'),partialStory=seedStory(partialProject),partialKey=`vsport/1/${partialProject}/partial.png`;seedAsset(partialProject,partialStory,partialKey,1);r2.deleteFailures.add(partialKey);response=await bodyOf(await del(partialProject,'Partial cleanup','delete.partial.0001'));assert.equal(response.status,202);assert.equal(response.json.cleanup_pending,true);assert.equal(db.prepare('SELECT status FROM vsport_object_cleanup_jobs WHERE object_key=?').get(partialKey).status,'error');r2.deleteFailures.clear();db.prepare("UPDATE vsport_object_cleanup_jobs SET next_attempt_at=datetime('now','-1 minute') WHERE object_key=?").run(partialKey);response=await bodyOf(await del(partialProject,'Partial cleanup','delete.partial.0001'));assert.equal(response.status,200);assert.equal(r2.objects.has(partialKey),false);

const png=new Uint8Array(await sharp({create:{width:320,height:180,channels:4,background:{r:200,g:20,b:20,alpha:1}}}).png().toBuffer()),originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(png,{status:200,headers:{'content-type':'image/png','content-length':String(png.byteLength)}});
try{
  const ingestProject=makeProject(1,'Guarded ingest'),ingestStory=seedStory(ingestProject),candidate=seedCandidate(ingestProject,ingestStory),gate={seen:deferred(),release:deferred()};r2.putGate=gate;const ingestPromise=onRequestPost(context('POST',{body:{action:'ingest_image',project_id:ingestProject,candidate_id:candidate}}));const guardedKey=await gate.seen.promise;const guard=db.prepare("SELECT status,writer_fence,lease_expires_at FROM vsport_object_cleanup_jobs WHERE object_key=?").get(guardedKey);assert.equal(guard.status,'reserved');assert.ok(guard.writer_fence);response=await bodyOf(await del(ingestProject,'Guarded ingest','delete.ingest.0001'));assert.equal(response.status,409,'unexpired pre-put guard blocks project delete');gate.release.resolve();response=await bodyOf(await ingestPromise);assert.equal(response.status,201);assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_object_cleanup_jobs WHERE object_key=?').get(guardedKey).count,0);assert.equal(db.prepare("SELECT state,ingest_fence FROM vsport_image_candidates WHERE id=?").get(candidate).state,'ready');r2.putGate=null;

  const lateProject=makeProject(1,'Late writer'),lateStory=seedStory(lateProject),lateCandidate=seedCandidate(lateProject,lateStory),lateGate={seen:deferred(),release:deferred()};r2.putGate=lateGate;const latePromise=onRequestPost(context('POST',{body:{action:'ingest_image',project_id:lateProject,candidate_id:lateCandidate}}));const lateKey=await lateGate.seen.promise;db.prepare("UPDATE vsport_image_candidates SET ingest_lease_expires_at=datetime('now','-1 minute') WHERE id=?").run(lateCandidate);db.prepare("UPDATE vsport_object_cleanup_jobs SET lease_expires_at=datetime('now','-1 minute'),next_attempt_at=datetime('now','-1 minute') WHERE object_key=?").run(lateKey);response=await bodyOf(await del(lateProject,'Late writer','delete.late.0001'));assert.equal(response.status,200,'expired guard can be captured by delete after its fixed deadline');lateGate.release.resolve();response=await bodyOf(await latePromise);assert.equal(response.status,422,'lost fence never reports asset success');assert.equal(r2.objects.has(lateKey),false,'writer catch force-cleans an object that arrives after delete cleanup observed absence');assert.equal(db.prepare('SELECT status FROM vsport_object_cleanup_jobs WHERE object_key=?').get(lateKey).status,'done');r2.putGate=null;

  const finalProject=makeProject(1,'Finalize failure'),finalStory=seedStory(finalProject),finalCandidate=seedCandidate(finalProject,finalStory);d1.beforeBatch=async statements=>{if(!statements.some(statement=>statement.sql.startsWith('INSERT INTO vsport_assets')))return false;db.prepare("UPDATE vsport_object_cleanup_jobs SET status='pending',lease_expires_at=datetime('now','-1 minute') WHERE project_id=? AND reason='orphan_guard'").run(finalProject)};response=await bodyOf(await onRequestPost(context('POST',{body:{action:'ingest_image',project_id:finalProject,candidate_id:finalCandidate}})));assert.equal(response.status,422);const failedGuard=db.prepare('SELECT object_key,status FROM vsport_object_cleanup_jobs WHERE project_id=?').get(finalProject);assert.equal(failedGuard.status,'done');assert.equal(r2.objects.has(failedGuard.object_key),false);assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_assets WHERE project_id=?').get(finalProject).count,0);
}finally{globalThis.fetch=originalFetch;r2.putGate=null}

for(const [sql,args,index] of[
  ['SELECT id FROM vsport_projects WHERE id=? AND owner_id=?',[sibling,1],'INTEGER PRIMARY KEY'],
  ["SELECT id FROM vsport_jobs WHERE project_id=? AND status IN ('queued','running')",[sibling],'idx_vsport_jobs_project_status'],
  ["SELECT id FROM vsport_image_candidates WHERE project_id=? AND state='ingesting' AND ingest_lease_expires_at>?",[sibling,'2026-01-01'],'idx_vsport_candidates_project_ingest'],
  ["SELECT id FROM vsport_object_cleanup_jobs WHERE owner_id=? AND project_id=? AND status='pending'",[1,target],'idx_vsport_cleanup_owner_project'],
  ["SELECT id FROM vsport_object_cleanup_jobs WHERE status IN ('pending','error') AND next_attempt_at>?",['2026-01-01'],'idx_vsport_cleanup_state_due'],
]){const plan=db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>row.detail).join(' | ');assert.match(plan,new RegExp(index.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),`${index}: ${plan}`)}
assert.equal(d1.queries.some(sql=>/FILES|prefix|list\(/i.test(sql)),false);db.close();
console.log('PASS v0.20.141 V Sport owner-scoped receipt delete, indexed cascades, exact R2 cleanup and pre-put orphan guard');
