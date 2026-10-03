import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet,onRequestPost,onRequestPut} from '../functions/api/admin/vsport-video.js';
import {onRequestGet as readVideo,onRequestHead as headVideo} from '../functions/api/admin/vsport-video/[id].js';
import {isSilentVideoWebm} from '../functions/_vsport-video.js';

const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
 CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
 CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT);
 CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,active INTEGER);
 CREATE TABLE courses(id INTEGER PRIMARY KEY,product_id INTEGER,course_type TEXT);
 CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER);
 INSERT INTO users VALUES(1,'one@example.test','one','One','','admin','2026-01-01');
 INSERT INTO users VALUES(2,'two@example.test','two','Two','','admin','2026-01-01');
 INSERT INTO sessions VALUES('one',1,'2099-01-01');INSERT INTO sessions VALUES('two',2,'2099-01-01');`);
for(const migration of ['0111_vsport.sql','0115_vsport_project_delete.sql','0121_vsport_silent_video.sql'])db.exec(readFileSync(new URL(`../migrations/${migration}`,import.meta.url),'utf8'));
db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(1,'One','2026-10-03','specific_team','City',30)").run();
db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(2,'Two','2026-10-03','specific_team','City',30)").run();
class Statement{constructor(d,sql,args=[]){this.d=d;this.sql=sql;this.args=args}bind(...args){return new Statement(this.d,this.sql,args)}async first(){return this.d.prepare(this.sql).get(...this.args)||null}async all(){return{results:this.d.prepare(this.sql).all(...this.args)}}async run(){const r=this.d.prepare(this.sql).run(...this.args);return{meta:{changes:Number(r.changes)}}}}
const DB={prepare:sql=>new Statement(db,sql),async batch(statements){db.exec('BEGIN IMMEDIATE');try{const out=[];for(const s of statements)out.push(await s.run());db.exec('COMMIT');return out}catch(error){db.exec('ROLLBACK');throw error}}};
class R2{
  constructor(){this.objects=new Map();this.uploads=new Map();this.failComplete=false}
  async createMultipartUpload(key){const id=crypto.randomUUID();this.uploads.set(id,{key,parts:new Map(),aborted:false});return{uploadId:id,abort:()=>this.resumeMultipartUpload(key,id).abort()}}
  resumeMultipartUpload(key,id){const row=this.uploads.get(id);if(!row||row.key!==key)throw Error('missing multipart');return{uploadPart:async(n,bytes)=>{if(row.aborted)throw Error('aborted');row.parts.set(n,new Uint8Array(bytes));return{partNumber:n,etag:`part-${n}-${row.parts.get(n).byteLength}`}},complete:async parts=>{if(this.failComplete)throw Error('synthetic complete failure');if(row.aborted)throw Error('aborted');for(const part of parts)assert.equal(part.etag,`part-${part.partNumber}-${row.parts.get(part.partNumber)?.byteLength}`);const bytes=new Uint8Array(parts.reduce((sum,p)=>sum+row.parts.get(p.partNumber).length,0));let at=0;for(const part of parts){const data=row.parts.get(part.partNumber);bytes.set(data,at);at+=data.length}this.objects.set(key,bytes);return{size:bytes.length}},abort:async()=>{row.aborted=true}}}
  async head(key){const data=this.objects.get(key);return data?{size:data.length}:null}
  async get(key,options){const data=this.objects.get(key);if(!data)return null;const range=options?.range;return{body:new Blob([range?data.subarray(range.offset,range.offset+range.length):data]).stream(),size:data.length}}
  async delete(key){this.objects.delete(key)}
}
const FILES=new R2(),env={DB,FILES};
const context=(method,{session='one',url='/api/admin/vsport-video',body,headers={},params={}}={})=>{const h=new Headers(headers);if(session)h.set('cookie',`vd_session=${session}`);const request=new Request(`https://visiondonline.com${url}`,{method,headers:h,body:body===undefined?undefined:typeof body==='string'||body instanceof Blob||body instanceof Uint8Array?body:JSON.stringify(body),duplex:'half'});return{request,env,params}};
const json=async response=>({status:response.status,body:await response.json()});
const begin=(key,size=600,session='one',projectId=1)=>onRequestPost(context('POST',{session,body:{action:'begin',project_id:projectId,file_size:size,duration_seconds:2,mime_type:'video/webm'},headers:{'content-type':'application/json','Idempotency-Key':key}}));
const put=(id,bytes,part=1,session='one')=>onRequestPut(context('PUT',{session,url:`/api/admin/vsport-video?upload_id=${id}&part=${part}`,body:bytes,headers:{'content-type':'application/octet-stream','content-length':String(bytes.length)}}));
const complete=(id,session='one')=>onRequestPost(context('POST',{session,body:{action:'complete',upload_id:id},headers:{'content-type':'application/json'}}));
const header=Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d42878104428581021853806701ffffffffffffff1549a966992ad7b1830f42404d80864368726f6d655741864368726f6d651654ae6bbeaebcd7810173c58779f6c69bfb34a283810155ee81018685565f565039e09fb0820500ba8202d053c0810155b09055b1810155b9810255ba810d55bb81011f43b67501ffffffffffffffe78100a32175bb8100008082498342004ff02cf41608400001807000007cc55ffe5be1e2665910ceeffff97107ff62cb58da2fbd1dcd4a142db81974ddfa94d63d263a1027843f4462ed8339e2170fe0abeaf39fe819abbe257ad8960401f9c939ad96','hex');
const valid=new Uint8Array(600);valid.set(header);assert.equal(isSilentVideoWebm(valid),true);
const audio=valid.slice(),trackTypeAt=audio.findIndex((byte,index)=>byte===0x83&&audio[index+1]===0x81&&audio[index+2]===0x01);assert.ok(trackTypeAt>0);audio[trackTypeAt+2]=0x02;assert.equal(isSilentVideoWebm(audio),false,'audio-only WebM cannot be promoted');
let out=await json(await begin('video.noauth.1',600,''));assert.equal(out.status,401);
out=await json(await begin('video.foreign.1',600,'two',1));assert.equal(out.status,404);
out=await json(await begin('video.oversize.1',1536*1024*1024+1));assert.equal(out.status,422);
out=await json(await begin('video.first.1'));assert.equal(out.status,200);const a=out.body.upload_id;
out=await json(await put(a,valid,1,'two'));assert.equal(out.status,404);
out=await json(await put(a,audio));assert.equal(out.status,415);
out=await json(await complete(a));assert.equal(out.status,409,'no trusted part receipt');
out=await json(await put(a,valid));assert.equal(out.status,200);
out=await json(await complete(a));assert.equal(out.status,200);assert.equal(out.body.video.project_id,1);
out=await json(await complete(a));assert.equal(out.status,200);assert.equal(out.body.replayed,true);
out=await json(await onRequestGet(context('GET',{url:'/api/admin/vsport-video?project_id=1'})));assert.equal(out.body.video.file_size,600);
const range=await readVideo(context('GET',{url:'/api/admin/vsport-video/1',params:{id:'1'},headers:{range:'bytes=10-19'}}));assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 10-19/600');assert.equal((await range.arrayBuffer()).byteLength,10);
assert.equal((await headVideo(context('HEAD',{url:'/api/admin/vsport-video/1',params:{id:'1'}}))).status,200);
assert.equal((await readVideo(context('GET',{url:'/api/admin/vsport-video/1',params:{id:'1'},session:'two'}))).status,404);
assert.equal((await readVideo(context('GET',{url:'/api/admin/vsport-video/1',params:{id:'1'},headers:{range:'bytes=900-'}}))).status,416);
out=await json(await begin('video.second.1'));const b=out.body.upload_id;await put(b,valid);FILES.failComplete=true;out=await json(await complete(b));assert.equal(out.status,503);assert.equal((await json(await onRequestGet(context('GET',{url:'/api/admin/vsport-video?project_id=1'})))).body.video.file_size,600,'prior durable clip survives failed completion');FILES.failComplete=false;
out=await json(await complete(b));assert.equal(out.status,200);assert.equal(db.prepare('SELECT COUNT(*) n FROM vsport_silent_videos WHERE project_id=1').get().n,1);
out=await json(await begin('video.stale.A'));const stale=out.body.upload_id;db.prepare("UPDATE vsport_video_uploads SET updated_at=datetime('now','-5 minutes') WHERE id=?").run(stale);out=await json(await begin('video.stale.B'));assert.equal(out.status,200);assert.equal((await json(await complete(stale))).status,409,'stale A cannot replace B');await put(out.body.upload_id,valid);assert.equal((await json(await complete(out.body.upload_id))).status,200);
const large=new Uint8Array(8*1024*1024);large.set(header);out=await json(await begin('video.multipart.1',large.length+9));const multi=out.body.upload_id;assert.equal((await json(await put(multi,large))).status,200);assert.equal((await json(await complete(multi))).status,409,'missing final part');assert.equal((await json(await put(multi,new Uint8Array(8),2))).status,422,'wrong final part length');assert.equal((await json(await put(multi,new Uint8Array(9),2))).status,200);assert.equal((await json(await complete(multi))).status,200);assert.equal((await json(await onRequestGet(context('GET',{url:'/api/admin/vsport-video?project_id=1'})))).body.video.file_size,large.length+9);
const plan=db.prepare('EXPLAIN QUERY PLAN SELECT project_id FROM vsport_silent_videos WHERE owner_id=? AND project_id=? LIMIT 1').all(1,1).map(x=>x.detail).join(' ');assert.match(plan,/idx_vsport_silent_videos_owner_project|INTEGER PRIMARY KEY/);
db.close();console.log('PASS v0.20.157 private silent WebM multipart owner/size/audio/range/retry/stale fence/index');
