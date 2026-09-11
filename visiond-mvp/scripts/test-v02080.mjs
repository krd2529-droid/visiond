import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {fixture} from './test-v02072.mjs';
const server=readFileSync('functions/_browser_launcher.js','utf8'),sql=server.match(/`(SELECT c.id command_id[\s\S]+?WHERE c.id=\? AND c.user_id=\? AND c.session_id=\?)`/)[1];
const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE browser_launcher_commands(id TEXT PRIMARY KEY,helper_id TEXT,user_id INTEGER,session_id TEXT,status TEXT,expires_at TEXT,intent TEXT,handoff_id TEXT);
CREATE TABLE browser_launcher_helpers(id TEXT PRIMARY KEY,user_id INTEGER,status TEXT,port INTEGER);
CREATE TABLE tiktok_oauth_handoffs(id TEXT PRIMARY KEY,slot_id TEXT,status TEXT,provider TEXT,continuation TEXT);
CREATE TABLE tiktok_browser_profile_bindings(slot_id TEXT,user_id INTEGER,channel_id TEXT);
CREATE INDEX binding_test ON tiktok_browser_profile_bindings(slot_id,user_id);
INSERT INTO browser_launcher_helpers VALUES('helper',1,'active',55000);
INSERT INTO tiktok_oauth_handoffs VALUES('flow','slot','redeemed','tiktok','shop');
INSERT INTO browser_launcher_commands VALUES('command','helper',1,'session','process_started','2099-01-01','oauth','flow');`);
db.exec(readFileSync('migrations/0103_browser_launcher_capability.sql','utf8'));
const read=()=>db.prepare(sql).get('command',1,'session');
assert.equal(read().oauth_provider,'tiktok','actual status SELECT must identify LoginKit prerequisite');
assert.equal(read().oauth_continuation,'shop');
assert.equal(db.prepare(sql).get('command',2,'session'),undefined);assert.equal(db.prepare(sql).get('command',1,'foreign'),undefined);
for(const provider of ['shop','invalid']){db.prepare('UPDATE tiktok_oauth_handoffs SET provider=?,continuation=?').run(provider,provider==='shop'?'':'invalid');const row=read();assert.equal(row.oauth_provider,provider==='shop'?'shop':null);assert.equal(row.oauth_continuation,provider==='shop'?'':null)}
db.exec("UPDATE browser_launcher_commands SET handoff_id=NULL");assert.equal(read().oauth_provider,null);assert.equal(read().oauth_continuation,null);
assert.ok(Object.keys(read()).every(k=>!['ticket','nonce','state','token','open_id','provider_open_id','secret'].includes(k)));
assert.match(db.prepare('EXPLAIN QUERY PLAN '+sql).all('command',1,'session').map(x=>x.detail).join('\n'),/SEARCH c USING INDEX sqlite_autoindex_browser_launcher_commands/);db.close();
for(const [provider,continuation,expected]of [['tiktok','shop',/Login Kit.*TikTok Shop/],['shop','',/TikTok Shop/],[null,null,/Chrome/]]){
 const f=fixture(),run=f.s.run('shop');await new Promise(r=>setImmediate(r));f.reply(f.pending[0],{status:'process_started',oauth_provider:provider,oauth_continuation:continuation});await run;assert.match(f.statuses.at(-1)[0],expected,'actual click status must use authoritative provider');
}
// Execute the actual GET route prefix: missing command remains safe null categories.
const routeSource=server.slice(server.indexOf('export async function launcherRoute'),server.indexOf(" if(request.method!=='POST'",server.indexOf('export async function launcherRoute'))).replace('export ','')+'}\nreturn launcherRoute;';
let reads=0;const route=new Function('requireUser','uuid','session','reply','fail',routeSource)(async()=>({user:{id:1}}),()=>true,()=> 'session',body=>Response.json(body),()=>Response.json({error:true}));
const waiting=await route({params:{action:'status'},request:new Request('https://visiondonline.com/api/launcher/status?command_id=fixture'),env:{DB:{prepare:()=>({bind:()=>({first:async()=>{reads++;return null}})})}}});assert.deepEqual(await waiting.json(),{status:'waiting',oauth_provider:null,oauth_continuation:null});assert.equal(reads,1);
const client=readFileSync('public/tiktok-analyzer.js','utf8'),stageSource=client.slice(client.indexOf('function launcherOAuthStage('),client.indexOf('async function reconcileProfileCommand('));const stage=new Function(stageSource+';return launcherOAuthStage')();
assert.match(stage({status:'process_started',expired:true,oauth_provider:'tiktok',oauth_continuation:'shop'}),/หมดอายุ/);
assert.doesNotMatch(stage({status:'process_started',expired:true,oauth_provider:'tiktok',oauth_continuation:'shop'}),/ขั้นแรก/);
assert.match(stage({oauth_status:'complete',expired:true}),/บันทึกการอนุญาตแล้ว/);assert.match(stage({status:'waiting'}),/ยังไม่มีขั้น OAuth/);assert.match(stage({status:'cancelled'}),/สิ้นสุด/);
for(const [status,expired,expected]of [['pending',true,/หมดอายุ/],['process_started',true,/หมดอายุ/],['failed',false,/สิ้นสุด/],['unknown',false,/ไม่แน่นอน/]]){const f=fixture(),run=f.s.run('shop');await new Promise(r=>setImmediate(r));f.reply(f.pending[0],{status,expired,oauth_provider:'tiktok',oauth_continuation:'shop'});await run;assert.match(f.statuses.at(-1)[0],expected);assert.doesNotMatch(f.statuses.at(-1)[0],/ขั้นแรก/)}
for(const provider of ['tiktok','shop']){const f=fixture(),run=f.s.run('shop');await new Promise(r=>setImmediate(r));f.reply(f.pending[0],{status:'process_started',oauth_status:'complete',oauth_provider:provider,oauth_continuation:''});await run;assert.match(f.statuses.at(-1)[0],provider==='shop'?/TikTok Shop แล้ว/:/TikTok Login Kit แล้ว/);assert.doesNotMatch(f.statuses.at(-1)[0],/ขั้นแรก|จากนั้นจะไป/)}
for(const stale of ['channel','owner']){const f=fixture(),run=f.s.run('shop');await new Promise(r=>setImmediate(r));const count=f.statuses.length;if(stale==='channel'){f.s.selected='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';f.s.rev++}else f.s.pageViewerId='foreign';f.reply(f.pending[0],{status:'process_started',oauth_provider:'shop'});await run;assert.equal(f.statuses.length,count,'stale result must not render authoritative stage on another owner/channel')}
{const f=fixture(),run=f.s.run('shop');await new Promise(r=>setImmediate(r));f.reply(f.pending[0]);await run;const check=f.s.run('shop');await new Promise(r=>setImmediate(r));f.reply(f.pending[1],{status:'process_started',oauth_provider:'tiktok',oauth_continuation:'shop'});await check;assert.match(f.statuses.at(-1)[0],/Login Kit.*TikTok Shop/);
 f.s.state={selected:f.s.selected};f.s.loadChannels=async()=>{};f.s.browserProfileUuid=/^[a-f0-9-]+$/;vm.runInContext('let profileRefreshRequest=null;'+client.slice(client.indexOf('const refreshProfileStatus='),client.indexOf('$("[data-refresh-profile]")?.addEventListener'))+';this.refresh=refreshProfileStatus;',f.s);const refresh=f.s.refresh();await new Promise(r=>setImmediate(r));f.reply(f.pending[2],{status:'process_started',oauth_provider:'shop',oauth_continuation:''});await refresh;assert.match(f.statuses.at(-1)[0],/TikTok Shop Creator/);
}
for(const stale of ['channel','owner'])for(const outcome of ['started','complete','error']){
 const f=fixture(),run=f.s.run('shop');await new Promise(r=>setImmediate(r));f.reply(f.pending[0]);await run;
 f.s.state={selected:f.s.selected};let loads=0;f.s.loadChannels=async()=>{loads++};f.s.browserProfileUuid=/^[a-f0-9-]+$/;
 vm.runInContext('let profileRefreshRequest=null;'+client.slice(client.indexOf('const refreshProfileStatus='),client.indexOf('$("[data-refresh-profile]")?.addEventListener'))+';this.refresh=refreshProfileStatus;',f.s);
 const refresh=f.s.refresh();await new Promise(r=>setImmediate(r));const count=f.statuses.length,request=f.s.requests.values().next().value;
 if(stale==='channel'){f.s.selected='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';f.s.state.selected=f.s.selected;f.s.rev++}else f.s.pageViewerId='foreign';
 f.reply(f.pending[1],{status:'process_started',oauth_status:outcome==='complete'?'complete':'redeemed',oauth_provider:'tiktok',oauth_continuation:'shop',channel_id:request.key},outcome!=='error');await refresh;
 assert.equal(f.statuses.length,count,'actual refresh late '+stale+'/'+outcome+' must not write another context');assert.equal(loads,0);assert.equal(f.s.requests.get(request.key),request,'stale refresh retains exact pending lifecycle');
}
{
 const f=fixture(),run=f.s.run('tiktok_new');await new Promise(r=>setImmediate(r));f.reply(f.pending[0]);await run;
 f.s.state={selected:f.s.selected};f.s.browserLauncher=null;let finishLoad,loads=0;f.s.loadChannels=()=>{loads++;return new Promise(resolve=>{finishLoad=resolve})};f.s.browserProfileUuid=/^[a-f0-9-]+$/;
 vm.runInContext('let profileRefreshRequest=null;'+client.slice(client.indexOf('const refreshProfileStatus='),client.indexOf('$("[data-refresh-profile]")?.addEventListener'))+';this.refresh=refreshProfileStatus;',f.s);
 const refresh=f.s.refresh();await new Promise(r=>setImmediate(r));const bound='cccccccc-cccc-4ccc-8ccc-cccccccccccc';f.reply(f.pending[1],{status:'process_started',oauth_status:'complete',oauth_provider:'tiktok',channel_id:bound});await new Promise(r=>setImmediate(r));
 assert.equal(f.s.state.selected,bound,'new-channel completion still selects authoritative bound channel');assert.equal(loads,1);assert.equal(f.s.requests.has('new'),false);assert.match(f.statuses.at(-1)[0],/TikTok Login Kit แล้ว/);
 const count=f.statuses.length;f.s.state.selected='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';f.s.rev++;finishLoad();await refresh;assert.equal(f.statuses.length,count,'no late stage write after completion channel load');
}
console.log('PASS v80 actual status SQL categorical projection/owner/session/index and actual click-stage rendering');
