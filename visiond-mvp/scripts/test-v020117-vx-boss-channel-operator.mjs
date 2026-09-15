import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {requireVxWorkspaceUser,vxWorkspaceOwnerId,isVxWorkspaceDelegate,denyActiveVxWorkspaceDelegate} from '../functions/_vx_workspace.js';
import {launcherIssue,launcherRoute} from '../functions/_browser_launcher.js';
import {issueHandoff} from '../functions/_tiktok_handoff.js';
import {onRequestGet as authMe} from '../functions/api/auth/me.js';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
db.exec(`
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,is_test_user INTEGER DEFAULT 0);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
CREATE TABLE entitlements(user_id INTEGER,product_id INTEGER,active INTEGER);CREATE TABLE products(id INTEGER,category TEXT);CREATE TABLE courses(product_id INTEGER,course_type TEXT);CREATE TABLE course_right_credits(user_id INTEGER);
CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT);CREATE TABLE vx_access_grants(order_id INTEGER PRIMARY KEY,user_id INTEGER,starts_at TEXT,expires_at TEXT,account_limit INTEGER);CREATE TABLE vx_review_access_grants(id INTEGER PRIMARY KEY,user_id INTEGER,scope TEXT,account_limit INTEGER,starts_at TEXT,expires_at TEXT,revoked_at TEXT);
CREATE TABLE tiktok_channels(id TEXT PRIMARY KEY,name TEXT DEFAULT '',created_by INTEGER,archived_at TEXT);
CREATE TABLE tiktok_connections(id TEXT PRIMARY KEY,user_id INTEGER,channel_id TEXT,open_id TEXT,status TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE tiktok_shop_creator_connections(id TEXT PRIMARY KEY,user_id INTEGER,channel_id TEXT,open_id TEXT,status TEXT);
CREATE TABLE tiktok_browser_profile_bindings(slot_id TEXT PRIMARY KEY,user_id INTEGER,channel_id TEXT UNIQUE);
INSERT INTO users(id,email,username,name,phone,role,is_test_user) VALUES
 (1,'boss@example.test','boss','Boss','','boss',0),(2,'admin@example.test','admin','Admin','','admin',0),
 (3,'user@example.test','user','User','','user',0),(10,'testervx@gmail.com','Testervx','Testervx','','user',0);
INSERT INTO sessions VALUES('boss-session',1,datetime('now','+1 day')),('admin-session',2,datetime('now','+1 day')),('user-session',3,datetime('now','+1 day')),('testervx-session',10,datetime('now','+1 day'));
INSERT INTO vx_review_access_grants VALUES(10,10,'tiktok_app_review',4,datetime('now','-1 day'),datetime('now','+1 day'),NULL);
`);
db.exec(await read('migrations/0096_tiktok_oauth_handoffs.sql'));
db.exec(await read('migrations/0097_tiktok_direct_profile_login.sql'));
db.exec(await read('migrations/0098_browser_launcher_transport.sql'));
db.exec(await read('migrations/0103_browser_launcher_capability.sql'));
const migration=await read('migrations/0109_vx_boss_channel_operator.sql');db.exec(migration);

const assignment=migration.match(/INSERT OR IGNORE INTO vx_workspace_delegations[\s\S]*?role='boss'\)=1;/)?.[0];assert.ok(assignment);db.exec(assignment);db.exec(assignment);
const delegation=db.prepare('SELECT * FROM vx_workspace_delegations').all();assert.equal(delegation.length,1);assert.equal(delegation[0].delegate_user_id,10);assert.equal(delegation[0].owner_user_id,1);assert.equal(delegation[0].scope,'boss_tiktok_channel_operator');
for(const column of['actor_user_id','workspace_owner_user_id']){assert.ok(db.prepare('PRAGMA table_info(tiktok_oauth_handoffs)').all().some(row=>row.name===column));assert.ok(db.prepare('PRAGMA table_info(browser_launcher_commands)').all().some(row=>row.name===column))}
const delegationPlan=db.prepare("EXPLAIN QUERY PLAN SELECT id FROM vx_workspace_delegations WHERE delegate_user_id=? AND scope='boss_tiktok_channel_operator' AND revoked_at IS NULL LIMIT 1").all(10).map(row=>row.detail).join(' ');assert.match(delegationPlan,/idx_vx_workspace_delegate_active/);

class Bound{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Bound(this.sql,args)}async first(){return db.prepare(this.sql).get(...this.args)||null}async all(){return{results:db.prepare(this.sql).all(...this.args)}}async run(){const result=db.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}}
const DB={prepare:sql=>new Bound(sql),async batch(statements){db.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());db.exec('COMMIT');return out}catch(error){db.exec('ROLLBACK');throw error}}};
const env={DB,TIKTOK_CLIENT_KEY:'fake-client',TIKTOK_CLIENT_SECRET:'fake-secret',TIKTOK_SHOP_APP_KEY:'fake-shop',TIKTOK_SHOP_APP_SECRET:'fake-shop-secret'};
const context=(session,path='/api/test',{method='GET',body,params={}}={})=>({env,params,request:new Request('https://visiondonline.com'+path,{method,headers:{...(session?{cookie:'vd_session='+session}:{}),...(body?{'content-type':'application/json',origin:'https://visiondonline.com'}:{})},body:body?JSON.stringify(body):undefined})});

let auth=await requireVxWorkspaceUser(context(null));assert.equal(auth.error.status,401);
auth=await requireVxWorkspaceUser(context('user-session'));assert.equal(auth.error.status,403);
auth=await requireVxWorkspaceUser(context('testervx-session'));assert.equal(isVxWorkspaceDelegate(auth),true);assert.equal(auth.user.id,10);assert.equal(vxWorkspaceOwnerId(auth),1);assert.equal(auth.user.role,'user');
for(const [session,id] of[['boss-session',1],['admin-session',2]]){auth=await requireVxWorkspaceUser(context(session));assert.equal(auth.error,undefined);assert.equal(isVxWorkspaceDelegate(auth),false);assert.equal(vxWorkspaceOwnerId(auth),id)}
const denied=await denyActiveVxWorkspaceDelegate(context('testervx-session'));assert.equal(denied.error.status,403);assert.match((await denied.error.json()).error,/ค่าคอมมิชชัน/);
const me=await authMe(context('testervx-session','/api/auth/me'));assert.equal(me.status,200);const meBody=await me.json();assert.deepEqual(meBody.vx_workspace,{delegated:true,scope:'boss_tiktok_channel_operator',landing_path:'/tiktok-analyzer.html'});assert.equal(meBody.user.role,'user');

const helper='11111111-1111-4111-8111-111111111111',channel='22222222-2222-4222-8222-222222222222',slot='33333333-3333-4333-8333-333333333333',command='44444444-4444-4444-8444-444444444444';
db.prepare('INSERT INTO tiktok_channels(id,name,created_by) VALUES(?,?,?)').run(channel,'Boss channel',1);
db.prepare("INSERT INTO tiktok_browser_profile_bindings(slot_id,user_id,channel_id,profile_kind) VALUES(?,?,?,'channel')").run(slot,1,channel);
db.prepare("INSERT INTO browser_launcher_helpers(id,user_id,session_id,owner_hash,port,key_version,secret_cipher,pair_code,status,expires_at) VALUES(?,?,?,?,?,1,'cipher','ABCDEF123456','active',datetime('now','+1 day'))").run(helper,10,'testervx-session','a'.repeat(64),50123);
let response=await launcherIssue(context('testervx-session','/api/tiktok/handoff',{method:'POST',body:{helper_id:helper,command_id:command,provider:'tiktok',intent:'view',channel_id:channel}}));assert.equal(response.status,200,await response.clone().text());
const commandRow=db.prepare('SELECT * FROM browser_launcher_commands WHERE id=?').get(command);assert.equal(commandRow.user_id,10);assert.equal(commandRow.actor_user_id,10);assert.equal(commandRow.workspace_owner_user_id,1);assert.equal(commandRow.helper_id,helper);assert.equal(commandRow.channel_id,channel);

const handoff=await issueHandoff(context('testervx-session','/api/tiktok/handoff',{method:'POST',body:{provider:'tiktok',intent:'reconnect',channel_id:channel}}));assert.equal(handoff.status,200,await handoff.clone().text());const handoffBody=await handoff.json(),handoffRow=db.prepare('SELECT * FROM tiktok_oauth_handoffs WHERE id=?').get(handoffBody.id);assert.equal(handoffRow.user_id,10);assert.equal(handoffRow.actor_user_id,10);assert.equal(handoffRow.workspace_owner_user_id,1);assert.equal(db.prepare('SELECT user_id FROM tiktok_oauth_handoff_heads WHERE slot_id=?').get(slot).user_id,1);

db.prepare('UPDATE vx_workspace_delegations SET revoked_at=CURRENT_TIMESTAMP WHERE delegate_user_id=10').run();
response=await launcherRoute({env,params:{action:'challenge'},request:new Request('https://visiondonline.com/api/launcher/challenge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({helper_id:helper,command_id:command,purpose:'claim'})})});assert.equal(response.status,409,'revoked delegation invalidates actor helper command against Boss workspace');

const sources=Object.fromEntries(await Promise.all([
 ['connect','functions/api/tiktok/connect.js'],['shopConnect','functions/api/tiktok-shop/connect.js'],['commissions','functions/api/admin/tiktok-commissions.js'],['cards','functions/api/admin/tiktok-commission-cards/index.js'],['card','functions/api/admin/tiktok-commission-cards/[id].js'],['referrals','functions/api/vx/referrals.js'],['payout','functions/api/vx/payouts/[id].js'],['connections','functions/api/admin/tiktok-connections/index.js'],['marketplace','functions/api/admin/tiktok-connections/marketplace.js'],['dashboard','public/member-dashboard.js'],['analyzer','public/tiktok-analyzer.js']
].map(async([key,path])=>[key,await read(path)])));
for(const key of['connect','shopConnect','commissions','cards','card','referrals','payout'])assert.match(sources[key],/denyActiveVxWorkspaceDelegate/,key);
for(const token of["if(delegated&&!channelId)","if(action==='shop_orders')","syncOrders:!delegated"])assert.ok(sources.connections.includes(token),token);
assert.match(sources.marketplace,/ไม่มีสิทธิ์ค้นหาหรือเรียงด้วยข้อมูลค่าคอมมิชชัน/);assert.match(sources.marketplace,/\{commission_rate,raw_json,\.\.\.product\}/);
assert.ok(sources.dashboard.indexOf("fetch('/api/auth/me'")<sources.dashboard.indexOf("fetch(orderUrl"));assert.ok(sources.dashboard.indexOf('if(isVxOperator)')<sources.dashboard.indexOf('\n  loadMemberHub();'));
assert.match(sources.analyzer,/pageWorkspaceDelegated=authPayload\?\.vx_workspace\?\.delegated===true/);assert.match(sources.analyzer,/pageWorkspaceDelegated\?false:routeProfileConnection/);assert.match(sources.analyzer,/if\(pageWorkspaceDelegated\)\{box.hidden=true/);assert.doesNotMatch(await read('public/tiktok-analyzer.html'),/src="\/vx-access-status\.js/);
assert.equal((await read('VERSION.txt')).trim(),'v0.20.118');
db.close();console.log('PASS v0.20.118 exact Testervx delegation, indexed migration, role matrix, actor Helper/Boss workspace command-handoff, revocation, direct OAuth and all commission denials');
