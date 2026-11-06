import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {launcherRoute,launcherIssue} from '../functions/_browser_launcher.js';
import {launcherMac,launcherCanonical,sealLauncher,openLauncher,helperAAD} from '../functions/_browser_launcher_crypto.js';
import {sha256} from '../functions/_lib.js';
const schema=await readFile('functions/_tiktok_analyzer.js','utf8');
const migrations=await Promise.all(['0095_tiktok_browser_profile_bindings.sql','0096_tiktok_oauth_handoffs.sql','0097_tiktok_direct_profile_login.sql','0098_browser_launcher_transport.sql','0100_browser_launcher_replacement_proof.sql','0103_browser_launcher_capability.sql','0109_vx_boss_channel_operator.sql','0143_launcher_pair_intents.sql','0144_launcher_helper_owner_index.sql'].map(async f=>{let sql=await readFile('migrations/'+f,'utf8');if(f.startsWith('0109_'))sql=sql.replace(/^ALTER TABLE tiktok_connections ADD COLUMN avatar_.*;\r?$/gm,'');return sql}));
const channel='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',helper='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',secret='ab'.repeat(32),owner='cd'.repeat(32);
class DB{
 constructor(){this.raw=new DatabaseSync(':memory:');this.raw.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT,email TEXT,username TEXT,name TEXT,phone TEXT,created_at TEXT,is_test_user INTEGER);INSERT INTO users(id,role,email,is_test_user)VALUES(1,'boss','owner@example.test',0),(2,'boss','other@example.test',0);
 CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);INSERT INTO sessions VALUES('main',1,datetime('now','+1 day')),('other',2,datetime('now','+1 day'));
 CREATE TABLE entitlements(user_id INTEGER,product_id INTEGER,active INTEGER);CREATE TABLE products(id INTEGER,category TEXT);CREATE TABLE courses(product_id INTEGER,course_type TEXT);CREATE TABLE course_right_credits(user_id INTEGER);
 CREATE TABLE vx_access_grants(order_id INTEGER PRIMARY KEY,user_id INTEGER,starts_at TEXT,expires_at TEXT,account_limit INTEGER);CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT);CREATE TABLE vx_review_access_grants(id INTEGER PRIMARY KEY,user_id INTEGER,scope TEXT,account_limit INTEGER,starts_at TEXT,expires_at TEXT,revoked_at TEXT);
 CREATE TABLE security_rate_limits(rate_key TEXT PRIMARY KEY,hits INTEGER,window_start TEXT,blocked_until TEXT);`);
 for(const table of ['tiktok_channels','tiktok_connections','tiktok_shop_creator_connections','tiktok_oauth_states'])this.raw.exec(schema.match(new RegExp('CREATE TABLE IF NOT EXISTS '+table+'\\([\\s\\S]*?\\)(?=`)'))[0]);
 for(const sql of migrations)this.raw.exec(sql);this.raw.prepare("INSERT INTO tiktok_channels(id,name,created_by) VALUES(?,'Legacy',1)").run(channel);}
 prepare(sql){const db=this;return{sql,args:[],bind(...args){this.args=args;return this},async first(){return db.raw.prepare(sql).get(...this.args)||null},async all(){return{results:db.raw.prepare(sql).all(...this.args)}},async run(){return{meta:{changes:Number(db.raw.prepare(sql).run(...this.args).changes)}}}}}
 async batch(statements){if(this.beforeBatch){const fn=this.beforeBatch;this.beforeBatch=null;fn()}this.raw.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());this.raw.exec('COMMIT');return result}catch(e){this.raw.exec('ROLLBACK');throw e}}
}
const fixture=()=>({DB:new DB(),VISIOND_CHANNEL_ENCRYPTION_KEY:'fixture-only-not-a-real-encryption-key',TIKTOK_CLIENT_KEY:'fake',TIKTOK_CLIENT_SECRET:'fake',TIKTOK_SHOP_APP_KEY:'fake',TIKTOK_SHOP_APP_SECRET:'fake'});
const context=(env,action,body,session='main',native=false)=>({env,params:{action},request:new Request('https://visiondonline.com/api/launcher/'+action,{method:'POST',headers:{'content-type':'application/json',...(native?{}:{origin:'https://visiondonline.com',cookie:'vd_session='+session})},body:JSON.stringify(body)})});
const route=async(...args)=>{try{return await launcherRoute(context(...args))}catch{return new Response('{}',{status:409})}};
const strictRoute=(...args)=>launcherRoute(context(...args));
const command=(env,id=crypto.randomUUID(),intent='reconnect')=>launcherIssue(context(env,'issue',{helper_id:helper,command_id:id,provider:'shop',intent,channel_id:channel}));
async function pair(env,id=helper,replacement=''){
 const staged=await route(env,'pair-stage',{helper_id:id,owner_hash:owner,port:53179,secret,pair_code:'12ABCDEF'},'',true);assert.equal(staged.status,200);
 const response=await route(env,'pair-prepare',{pair_id:id});assert.equal(response.status,200);const p=await response.json();
 const confirmed=await route(env,'pair-confirm',{pair_id:id,confirm_nonce:p.confirm_nonce,pair_code:p.pair_code,replace_id:replacement});assert.equal(confirmed.status,200);return p;
}
async function signed(env,id,purpose='claim',payload=purpose==='claim'?'launcher/0.20.78;no-first-run=1':'',overrides={}){
 const r=await route(env,'challenge',{helper_id:helper,command_id:id,purpose},'',true);assert.equal(r.status,200);const n=await r.json();
 const body={helper_id:helper,key_version:1,command_id:id,nonce:n.nonce,expires_at:n.expires_at,payload,mac:await launcherMac(secret,launcherCanonical(purpose,helper,1,id,n.nonce,n.expires_at,await sha256(payload))),...overrides};
 return {body,response:await route(env,purpose,body,'',true)};
}
let passed=0;async function test(name,fn){await fn();console.log('PASS '+name);passed++}
await test('legacy signed claim fails update-required without ticket; forged capability cannot bypass MAC',async()=>{const e=fixture();await pair(e);const id=(await(await command(e)).json()).command_id;const legacy=await signed(e,id,'claim','');const body=await legacy.response.json();assert.deepEqual(body,{status:'failed',error_code:'HELPER_UPDATE_REQUIRED'});assert.equal(e.DB.raw.prepare('SELECT status,error_code FROM browser_launcher_commands WHERE id=?').get(id).error_code,'HELPER_UPDATE_REQUIRED');assert.equal((await route(e,'claim',{...legacy.body,payload:'launcher/0.20.78;no-first-run=1'},'',true)).status,403);assert.equal(e.DB.raw.prepare('SELECT status FROM tiktok_oauth_handoffs').get().status,'issued');const status=await launcherRoute({env:e,params:{action:'status'},request:new Request('https://visiondonline.com/api/launcher/status?command_id='+id,{headers:{cookie:'vd_session=main'}})});assert.equal((await status.json()).error_code,'HELPER_UPDATE_REQUIRED')});
await test('storage AAD prevents secret substitution and canonical purposes differ',async()=>{const e=fixture(),h={id:helper,user_id:1,key_version:1},cipher=await sealLauncher(e,secret,helperAAD(h));assert.equal(await openLauncher(e,cipher,helperAAD(h)),secret);await assert.rejects(openLauncher(e,cipher,helperAAD({...h,user_id:2})));assert.notEqual(await launcherMac(secret,launcherCanonical('claim',helper,1,channel,secret,'x','')),await launcherMac(secret,launcherCanonical('status',helper,1,channel,secret,'x','')))});
await test('explicit pairing binds session, consumes confirmation and does not disclose key',async()=>{const e=fixture(),p=await pair(e);assert.equal(e.DB.raw.prepare('SELECT confirm_nonce FROM browser_launcher_helpers').get().confirm_nonce,null);const replay=await route(e,'pair-confirm',{pair_id:helper,confirm_nonce:p.confirm_nonce,pair_code:p.pair_code,replace_id:''});assert.equal(replay.status,409);const wrong=await route(e,'pair-prepare',{pair_id:helper},'other');assert.notEqual(wrong.status,200);assert.ok(!JSON.stringify(p).includes(secret))});
await test('replacement requires exact old helper and revokes it atomically',async()=>{const e=fixture();await pair(e);const second='cccccccc-cccc-4ccc-8ccc-cccccccccccc';await route(e,'pair-stage',{helper_id:second,owner_hash:owner,port:53179,secret,pair_code:'12ABCDEF'},'',true);const p=await(await route(e,'pair-prepare',{pair_id:second})).json();assert.equal(p.replace_id,helper);const body={pair_id:second,confirm_nonce:p.confirm_nonce,pair_code:p.pair_code,replace_id:channel};assert.equal((await route(e,'pair-confirm',body)).status,409);assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(helper).status,'active');assert.equal((await route(e,'pair-confirm',{...body,replace_id:helper})).status,200);assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(helper).status,'revoked')});
await test('revoked local identity renews only through new intent and exact active replacement',async()=>{const e=fixture(),old='cccccccc-cccc-4ccc-8ccc-cccccccccccc',next='dddddddd-dddd-4ddd-8ddd-dddddddddddd',other='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';await pair(e,old);const separate=await route(e,'pair-stage',{helper_id:other,owner_hash:'fa'.repeat(32),port:60983,secret:'fb'.repeat(32),pair_code:'12ABCDEF'},'',true);assert.equal(separate.status,200);const independent=await(await route(e,'pair-prepare',{pair_id:other})).json();assert.equal(independent.replace_id,'');assert.equal((await route(e,'pair-confirm',{pair_id:other,pair_code:independent.pair_code,confirm_nonce:independent.confirm_nonce,replace_id:''})).status,200);await pair(e,helper,old);const intent=(await(await route(e,'pair-intent',{})).json()).intent_id;const blocked=await route(e,'pair-stage',{helper_id:old,owner_hash:owner,port:53179,secret,pair_code:'ABCDEF123456',intent_id:intent},'',true);assert.equal(blocked.status,409);assert.equal((await blocked.json()).error,'LAUNCHER_HELPER_REVOKED');const wrong=await route(e,'pair-stage',{helper_id:old,owner_hash:owner,port:53179,secret:'ee'.repeat(32),pair_code:'ABCDEF123456',intent_id:intent},'',true);assert.notEqual((await wrong.json()).error,'LAUNCHER_HELPER_REVOKED');e.DB.raw.exec('DELETE FROM security_rate_limits');const stage=await route(e,'pair-stage',{helper_id:next,owner_hash:owner,port:53179,secret:'ef'.repeat(32),pair_code:'ABCDEF123456',intent_id:intent},'',true);assert.equal(stage.status,200);const prepared=await(await route(e,'pair-prepare',{pair_id:next,intent_id:intent})).json();assert.equal(prepared.replace_id,helper);assert.equal(e.DB.raw.prepare('SELECT replaces_helper_id FROM browser_launcher_helpers WHERE id=?').get(next).replaces_helper_id,helper);const confirm={pair_id:next,pair_code:prepared.pair_code,confirm_nonce:prepared.confirm_nonce,replace_id:old,intent_id:intent};assert.equal((await route(e,'pair-confirm',confirm)).status,409);assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(helper).status,'active');assert.equal((await route(e,'pair-confirm',{...confirm,replace_id:helper})).status,200);assert.equal(e.DB.raw.prepare('SELECT replaces_helper_id FROM browser_launcher_helpers WHERE id=?').get(next).replaces_helper_id,helper);assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(helper).status,'revoked');assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(next).status,'active');assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(other).status,'active')});
await test('recovery denies foreign account and ambiguous same-owner replacement',async()=>{
 const e=fixture(),old='cccccccc-cccc-4ccc-8ccc-cccccccccccc',next='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 await pair(e,old);await pair(e,helper,old);
 const foreign=(await(await route(e,'pair-intent',{},'other')).json()).intent_id;
 const denied=await route(e,'pair-stage',{helper_id:old,owner_hash:owner,port:53179,secret,pair_code:'ABCDEF123456',intent_id:foreign},'',true);
 assert.equal(denied.status,409);assert.notEqual((await denied.json()).error,'LAUNCHER_HELPER_REVOKED');
 const intent=(await(await route(e,'pair-intent',{})).json()).intent_id;
 assert.equal((await route(e,'pair-stage',{helper_id:next,owner_hash:owner,port:53179,secret:'ef'.repeat(32),pair_code:'ABCDEF123456',intent_id:intent},'',true)).status,200);
 e.DB.raw.prepare("INSERT INTO browser_launcher_helpers(id,owner_hash,port,secret_cipher,pair_code,status,user_id,expires_at) SELECT ?,owner_hash,port,secret_cipher,pair_code,'active',user_id,expires_at FROM browser_launcher_helpers WHERE id=?").run('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',helper);
 assert.equal((await route(e,'pair-prepare',{pair_id:next,intent_id:intent})).status,409);
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(helper).status,'active');
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(next).status,'staged');
 const plan=e.DB.raw.prepare("EXPLAIN QUERY PLAN SELECT id FROM browser_launcher_helpers WHERE user_id=? AND owner_hash=? AND status='active' ORDER BY id LIMIT 2").all(1,owner);
 assert.ok(plan.some(row=>row.detail.includes('USING COVERING INDEX idx_launcher_helper_user_owner_status_id')&&row.detail.includes('owner_hash=?')),JSON.stringify(plan));
});
await test('renewed helper attests exact replacement after consumed intent',async()=>{
 const e=fixture(),old='cccccccc-cccc-4ccc-8ccc-cccccccccccc',next='dddddddd-dddd-4ddd-8ddd-dddddddddddd',renewedSecret='ef'.repeat(32);
 await pair(e,old);await pair(e,helper,old);
 const intent=(await(await route(e,'pair-intent',{})).json()).intent_id;
 assert.equal((await route(e,'pair-stage',{helper_id:next,owner_hash:owner,port:53179,secret:renewedSecret,pair_code:'ABCDEF123456',intent_id:intent},'',true)).status,200);
 const p=await(await route(e,'pair-prepare',{pair_id:next,intent_id:intent})).json();
 assert.equal((await route(e,'pair-confirm',{pair_id:next,pair_code:p.pair_code,confirm_nonce:p.confirm_nonce,replace_id:helper,intent_id:intent})).status,200);
 const challenge=await(await route(e,'challenge',{helper_id:next,command_id:next,purpose:'pair-state'},'',true)).json();
 const body={helper_id:next,key_version:1,command_id:next,nonce:challenge.nonce,expires_at:challenge.expires_at,payload:'',mac:await launcherMac(renewedSecret,launcherCanonical('pair-state',next,1,next,challenge.nonce,challenge.expires_at,await sha256('')))};
 const signedState=await(await route(e,'pair-state',body,'',true)).json();
 assert.deepEqual(signedState,{paired:true,replaces_helper_id:helper,helper_id:next});
 assert.deepEqual(await(await route(e,'pair-state',body,'',true)).json(),signedState);
 assert.equal((await route(e,'pair-stage',{helper_id:next,owner_hash:owner,port:53179,secret:renewedSecret,pair_code:'ABCDEF123456',intent_id:intent},'',true)).status,409);
});
await test('replacement changing after preparation blocks confirmation atomically',async()=>{
 const e=fixture(),next='dddddddd-dddd-4ddd-8ddd-dddddddddddd',other='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 await pair(e);
 assert.equal((await route(e,'pair-stage',{helper_id:next,owner_hash:owner,port:53179,secret:'ef'.repeat(32),pair_code:'12ABCDEF'},'',true)).status,200);
 const p=await(await route(e,'pair-prepare',{pair_id:next})).json();assert.equal(p.replace_id,helper);
 e.DB.raw.prepare("INSERT INTO browser_launcher_helpers(id,owner_hash,port,secret_cipher,pair_code,status,user_id,expires_at) SELECT ?,owner_hash,port,secret_cipher,pair_code,'active',user_id,expires_at FROM browser_launcher_helpers WHERE id=?").run(other,helper);
 assert.equal((await route(e,'pair-confirm',{pair_id:next,pair_code:p.pair_code,confirm_nonce:p.confirm_nonce,replace_id:helper})).status,409);
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(helper).status,'active');
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(other).status,'active');
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(next).status,'prepared');
});
await test('browser gets only command id; forged port cannot claim; authenticated replay gets same ticket',async()=>{const e=fixture();await pair(e);const r=await command(e),issued=await r.json();assert.equal(r.status,200);assert.equal('ticket'in issued,false);const bad=await signed(e,issued.command_id,'claim','',{mac:'00'.repeat(32)});assert.equal(bad.response.status,403);assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_commands').get().status,'pending');const first=await signed(e,issued.command_id);assert.equal(first.response.status,200);const a=await first.response.json(),again=await route(e,'claim',first.body,'',true);assert.deepEqual(await again.json(),a);assert.equal(e.DB.raw.prepare('SELECT status FROM tiktok_oauth_handoffs').get().status,'issued');assert.equal((await signed(e,issued.command_id,'status','process_started')).response.status,200);assert.equal((await signed(e,issued.command_id)).response.status,200)});
await test('View has no OAuth handoff, ticket or head and cannot block Connect',async()=>{const e=fixture();await pair(e);const view=await command(e,crypto.randomUUID(),'view'),v=await view.json();assert.equal(view.status,200);const claim=await(await signed(e,v.command_id)).response.json();assert.equal(claim.intent,'view');assert.equal(claim.ticket,'');assert.equal(claim.profile_kind,'channel');assert.equal(claim.slot_id,channel);assert.equal(e.DB.raw.prepare('SELECT count(*) n FROM tiktok_oauth_handoffs').get().n,0);assert.equal((await command(e)).status,200)});
await test('live session/grant/helper/head checks deny before ticket and inside batch',async()=>{for(const mutation of ["DELETE FROM sessions WHERE id='main'","UPDATE users SET role='user' WHERE id=1","UPDATE browser_launcher_helpers SET status='revoked'","UPDATE tiktok_channels SET archived_at=CURRENT_TIMESTAMP"]){const e=fixture();await pair(e);const id=(await(await command(e)).json()).command_id;const n=await(await route(e,'challenge',{helper_id:helper,command_id:id,purpose:'claim'},'',true)).json();const payload={helper_id:helper,key_version:1,command_id:id,nonce:n.nonce,expires_at:n.expires_at,payload:'',mac:await launcherMac(secret,launcherCanonical('claim',helper,1,id,n.nonce,n.expires_at,await sha256('')))};e.DB.beforeBatch=()=>e.DB.raw.exec(mutation);assert.equal((await route(e,'claim',payload,'',true)).status,409);assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_commands').get().status,'pending')}});
await test('active command blocks implicit supersession and status is owner/session private',async()=>{const e=fixture();await pair(e);const id=(await(await command(e)).json()).command_id;assert.equal((await command(e)).status,409);const r=await launcherRoute({env:e,params:{action:'status'},request:new Request('https://visiondonline.com/api/launcher/status?command_id='+id,{headers:{cookie:'vd_session=other'}})});assert.deepEqual(await r.json(),{status:'waiting',oauth_provider:null,oauth_continuation:null});assert.match(r.headers.get('cache-control'),/no-store/);for(const sql of ["SELECT id FROM browser_launcher_commands WHERE id='x' AND user_id=1 AND session_id='main'","SELECT id FROM browser_launcher_helpers WHERE user_id=1 AND status='active' AND id>'' ORDER BY id LIMIT 24","SELECT id FROM browser_launcher_nonces WHERE helper_id='h' AND command_id='c' AND purpose='claim'"]){const plan=e.DB.raw.prepare('EXPLAIN QUERY PLAN '+sql).all();assert.ok(plan.some(p=>p.detail.includes('SEARCH')),JSON.stringify(plan))}});
await test('same command id binds original intent and cancellation wins against delayed bootstrap',async()=>{const e=fixture();await pair(e);const id=crypto.randomUUID();assert.equal((await command(e,id,'view')).status,200);assert.equal((await command(e,id,'reconnect')).status,409);assert.equal((await command(e,id,'view')).status,200);const late=crypto.randomUUID();assert.equal((await route(e,'cancel',{command_id:late})).status,200);assert.equal((await command(e,late)).status,409);const active=(await(await command(e)).json()).command_id;assert.equal((await signed(e,active)).response.status,200);assert.equal((await route(e,'cancel',{command_id:active})).status,409);assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_commands WHERE id=?').get(active).status,'claimed')});
await test('same-tab intent pairs without typed code and resists wrong session, lost stage response, expiry and replay',async()=>{
 const e=fixture(),created=await strictRoute(e,'pair-intent',{});assert.equal(created.status,200);const {intent_id}=await created.json();assert.match(intent_id,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 const read=(action,id=intent_id,s='main')=>launcherRoute({env:e,params:{action},request:new Request('https://visiondonline.com/api/launcher/'+action+'?id='+id,{headers:{cookie:'vd_session='+s}})});
 const info=await read('pair-intent-info');assert.equal(info.status,200);const infoText=await info.text();assert.doesNotMatch(infoText,/owner@example\.test|other@example\.test/);const {account_code}=JSON.parse(infoText);assert.match(account_code,/^[A-F0-9]{8}$/);assert.equal((await read('pair-intent-status',intent_id,'other')).status,409);
 const body={helper_id:helper,owner_hash:owner,port:53179,secret,pair_code:'ABCDEF123456',intent_id};assert.equal((await strictRoute(e,'pair-stage',body,'',true)).status,200);
 const retry=await strictRoute(e,'pair-stage',{...body,pair_code:'654321FEDCBA'},'',true);assert.equal(retry.status,200);assert.equal((await retry.json()).pair_code,body.pair_code,'lost stage response retains original code');
 assert.deepEqual(await(await read('pair-intent-status')).json(),{status:'staged',pair_id:helper,account_code});
 assert.equal((await route(e,'pair-prepare',{pair_id:helper,intent_id},'other')).status,409);assert.equal((await route(e,'pair-prepare',{pair_id:helper})).status,409);
 const prepared=await strictRoute(e,'pair-prepare',{pair_id:helper,intent_id});assert.equal(prepared.status,200);const p=await prepared.json();assert.equal(p.pair_code,body.pair_code);
 const confirm={pair_id:helper,pair_code:p.pair_code,confirm_nonce:p.confirm_nonce,replace_id:'',intent_id};assert.equal((await route(e,'pair-confirm',confirm,'other')).status,409);
 assert.equal((await strictRoute(e,'pair-confirm',confirm)).status,200);assert.equal((await route(e,'pair-confirm',confirm)).status,409);assert.ok(e.DB.raw.prepare('SELECT consumed_at FROM browser_launcher_pair_intents WHERE id=?').get(intent_id).consumed_at);assert.deepEqual(await(await read('pair-intent-status')).json(),{status:'paired',pair_id:helper,account_code});
 const later=(await(await route(e,'pair-intent',{})).json()).intent_id;e.DB.raw.prepare("UPDATE browser_launcher_pair_intents SET expires_at=datetime('now','-1 second') WHERE id=?").run(later);assert.equal((await route(e,'pair-stage',{...body,intent_id:later},'',true)).status,409);assert.equal((await read('pair-intent-status',later)).status,409);
 const other=(await(await route(e,'pair-intent',{},'other')).json()).intent_id;assert.equal((await route(e,'pair-stage',{...body,intent_id:other},'',true)).status,409,'active helper cannot silently move to another account');
 const revoked=(await(await route(e,'pair-intent',{})).json()).intent_id;e.DB.raw.prepare("UPDATE sessions SET expires_at=datetime('now','-1 second') WHERE id='main'").run();assert.equal((await read('pair-intent-info',revoked)).status,409);assert.equal((await route(e,'pair-stage',{...body,intent_id:revoked},'',true)).status,409);
 assert.ok(e.DB.raw.prepare("EXPLAIN QUERY PLAN SELECT helper_id FROM browser_launcher_pair_intents WHERE id=? AND user_id=? AND session_id=?").all(intent_id,1,'main').some(x=>x.detail.includes('SEARCH')));
 assert.ok(e.DB.raw.prepare("EXPLAIN QUERY PLAN SELECT id FROM browser_launcher_pair_intents WHERE expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at,id LIMIT 24").all().some(x=>x.detail.includes('idx_launcher_pair_intent_expiry')));
});
await test('existing active helper cannot make a fresh unconfirmed intent appear paired',async()=>{
 const e=fixture();await pair(e);
 const {intent_id}=await(await strictRoute(e,'pair-intent',{})).json();
 const stage=await strictRoute(e,'pair-stage',{helper_id:helper,owner_hash:owner,port:53179,secret,pair_code:'ABCDEF123456',intent_id},'',true);
 assert.equal(stage.status,200);
 const state=await launcherRoute({env:e,params:{action:'pair-intent-status'},request:new Request('https://visiondonline.com/api/launcher/pair-intent-status?id='+intent_id,{headers:{cookie:'vd_session=main'}})});
 assert.equal(state.status,200);
 assert.equal((await state.json()).status,'waiting','an already-active helper does not bind or complete a fresh pairing intent');
 assert.equal(e.DB.raw.prepare('SELECT helper_id FROM browser_launcher_pair_intents WHERE id=?').get(intent_id).helper_id,null);
 assert.equal(e.DB.raw.prepare('SELECT consumed_at FROM browser_launcher_pair_intents WHERE id=?').get(intent_id).consumed_at,null);
});
await test('already-active helper cannot monopolize a new intent before revoked local recovery',async()=>{
 const e=fixture(),revoked='dddddddd-dddd-4ddd-8ddd-dddddddddddd';await pair(e,revoked);await pair(e,helper,revoked);
 const {intent_id}=await(await strictRoute(e,'pair-intent',{})).json();
 const active=await strictRoute(e,'pair-stage',{helper_id:helper,owner_hash:owner,port:53179,secret,pair_code:'ABCDEF123456',intent_id},'',true);
 assert.equal(active.status,200);
 assert.equal(e.DB.raw.prepare('SELECT helper_id FROM browser_launcher_pair_intents WHERE id=?').get(intent_id).helper_id,null,'existing active identity must not reserve a fresh recovery intent');
 const local=await strictRoute(e,'pair-stage',{helper_id:revoked,owner_hash:owner,port:53179,secret,pair_code:'ABCDEF123456',intent_id},'',true);
 assert.equal(local.status,409);assert.equal((await local.json()).error,'LAUNCHER_HELPER_REVOKED','local exact revoked identity must reach renewal path');
 const candidate='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
 const staged=await strictRoute(e,'pair-stage',{helper_id:candidate,owner_hash:owner,port:53179,secret:'ef'.repeat(32),pair_code:'ABCDEF123456',intent_id},'',true);
 assert.equal(staged.status,200);assert.equal(e.DB.raw.prepare('SELECT helper_id FROM browser_launcher_pair_intents WHERE id=?').get(intent_id).helper_id,candidate);
 const prepared=await(await strictRoute(e,'pair-prepare',{pair_id:candidate,intent_id})).json();assert.equal(prepared.replace_id,helper);
 assert.equal((await strictRoute(e,'pair-confirm',{pair_id:candidate,pair_code:prepared.pair_code,confirm_nonce:prepared.confirm_nonce,replace_id:helper,intent_id})).status,200);
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(helper).status,'revoked');
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(candidate).status,'active');
});
await test('new intent rejects foreign Origin and concurrent stage/confirm; replacement names exact old helper',async()=>{
 const e=fixture(),foreign=await launcherRoute({env:e,params:{action:'pair-intent'},request:new Request('https://visiondonline.com/api/launcher/pair-intent',{method:'POST',headers:{origin:'https://evil.example',cookie:'vd_session=main','content-type':'application/json'},body:'{}'})});assert.equal(foreign.status,403);
 const intent=(await(await strictRoute(e,'pair-intent',{})).json()).intent_id,second='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 const base={owner_hash:owner,port:53179,secret,pair_code:'ABCDEF123456',intent_id:intent};
 const stages=await Promise.all([route(e,'pair-stage',{...base,helper_id:helper},'',true),route(e,'pair-stage',{...base,helper_id:second},'',true)]);assert.deepEqual(stages.map(x=>x.status).sort(),[200,409]);
 const selected=e.DB.raw.prepare('SELECT helper_id FROM browser_launcher_pair_intents WHERE id=?').get(intent).helper_id;assert.ok([helper,second].includes(selected));
 const p=await(await strictRoute(e,'pair-prepare',{pair_id:selected,intent_id:intent})).json(),body={pair_id:selected,pair_code:p.pair_code,confirm_nonce:p.confirm_nonce,replace_id:'',intent_id:intent};
 const confirms=await Promise.all([route(e,'pair-confirm',body),route(e,'pair-confirm',body)]);assert.deepEqual(confirms.map(x=>x.status).sort(),[200,409]);assert.equal(e.DB.raw.prepare("SELECT COUNT(*) n FROM browser_launcher_helpers WHERE status='active'").get().n,1);
 const next=(await(await strictRoute(e,'pair-intent',{})).json()).intent_id,replace='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
 assert.equal((await strictRoute(e,'pair-stage',{...base,intent_id:next,helper_id:replace,replaces_helper_id:selected},'',true)).status,200);
 const prepared=await(await strictRoute(e,'pair-prepare',{pair_id:replace,intent_id:next})).json();assert.equal(prepared.replace_id,selected);
 const replacement={pair_id:replace,pair_code:prepared.pair_code,confirm_nonce:prepared.confirm_nonce,replace_id:selected,intent_id:next};assert.equal((await route(e,'pair-confirm',{...replacement,replace_id:helper===selected?second:helper})).status,409);assert.equal((await strictRoute(e,'pair-confirm',replacement)).status,200);
 assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(selected).status,'revoked');assert.equal(e.DB.raw.prepare('SELECT status FROM browser_launcher_helpers WHERE id=?').get(replace).status,'active');
});
console.log('Launcher transport cases: '+passed);
export {fixture,route,context,helper,secret,owner};
