import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { ensureDatabase } from '../functions/_schema.js';
import { hashPassword } from '../functions/_security.js';
import { onRequestPost as login } from '../functions/api/auth/login.js';
import { onRequestGet as authMe } from '../functions/api/auth/me.js';
import { onRequestGet as listReviewers, onRequestPost as writeReviewer, onRequestDelete as revokeReviewer } from '../functions/api/admin/users/tiktok-reviewer.js';
import { ensureVxAccess, vxAccess, requireVxUser } from '../functions/_vx_access.js';
import { ensureVision7AuthSchema } from '../functions/_vision7_auth.js';
import { ensureTikTokAnalyzerSchema } from '../functions/_tiktok_analyzer.js';
import { onRequestGet as connectTikTok } from '../functions/api/tiktok/connect.js';
import { onRequestGet as connectTikTokShop } from '../functions/api/tiktok-shop/connect.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const source = await read('public/tiktok-analyzer.js'),adminSource=await read('public/admin.js'),adminHtml=await read('public/admin.html'),adminMobile=await read('public/admin-mobile.css'),analyzerHtml=await read('public/tiktok-analyzer.html'),version=await read('VERSION.txt');
const callbackSource=await read('functions/api/tiktok/callback.js'),shopCallbackSource=await read('functions/api/tiktok-shop/callback.js');

const helperSource = source.slice(0, source.indexOf('const $ ='));
const context = vm.createContext({ encodeURIComponent });
vm.runInContext(`${helperSource}\nthis.actions=tiktokShopActionVisibility;`, context);
const actions = options => ({ ...context.actions(options) });

assert.deepEqual(actions({ loading: true, selectable: true, connected: false }), { connect: false, manage: false }, 'loading must expose neither action');
assert.deepEqual(actions({ loading: false, selectable: false, connected: false }), { connect: false, manage: false }, 'missing/stale selection must expose neither action');
assert.deepEqual(actions({ loading: false, selectable: true, connected: false }), { connect: true, manage: false }, 'disconnected selection must expose only Connect');
assert.deepEqual(actions({ loading: false, selectable: true, connected: true }), { connect: false, manage: true }, 'connected selection must expose only Manage');

const loadingHide = source.indexOf('$("#manageChannelConnections").hidden = true;', source.indexOf('async function loadTikTokConnection'));
const request = source.indexOf('const data = await fetchTikTokConnectionData(requestedChannelId)', loadingHide);
const staleGuard = source.indexOf('if(loadSeq!==state.connectionLoadSeq||!context||!channelOwnership.current(context))return shopConnection;', request);
const visibilityCommit = source.indexOf('const shopActions = tiktokShopActionVisibility', staleGuard);
assert.ok(loadingHide >= 0 && loadingHide < request, 'both actions start hidden before connection fetch');
assert.ok(request < staleGuard && staleGuard < visibilityCommit, 'stale response must exit before publishing either action');
assert.doesNotMatch(source.slice(visibilityCommit, visibilityCommit + 500), /manageChannelConnections"\)\.hidden = false/, 'successful disconnected load must not unconditionally expose Manage');
assert.match(source.slice(visibilityCommit, visibilityCommit + 500), /manageChannelConnections"\)\.hidden = !shopActions\.manage/);
assert.match(source.slice(visibilityCommit, visibilityCommit + 500), /shopConnectionRequired"\)\.hidden = !shopActions\.connect/);
assert.match(source, /id="shopConnectionRequired"[^]*data-connect-selected-shop/);
assert.match(source, /id="manageChannelConnections"[^>]*hidden/);
assert.match(adminSource,/tiktokReviewerCache\.owner===owner/);assert.match(adminSource,/loadTikTokReviewerAccess\(\{after:tiktokReviewerNextCursor,append:true\}\)/);assert.match(adminHtml,/id="loadMoreTikTokReviewers"/);assert.match(adminMobile,/#tiktokReviewerAccess\[hidden\],#loadMoreTikTokReviewers\[hidden\]\{display:none!important\}/);
const callbackSave=callbackSource.indexOf('saveTikTokConnection('),callbackFinalAccess=callbackSource.lastIndexOf('vxRequestAccessStillCurrent',callbackSave);
assert.ok(callbackFinalAccess>callbackSource.indexOf('channelForProfile(')&&callbackFinalAccess<callbackSave,'regular callback must refresh session/grant immediately before persistence');
assert.ok(callbackSource.lastIndexOf('archived_at IS NULL',callbackSave)<callbackFinalAccess,'regular callback must refresh access after its final selected-channel ownership await');
const shopSave=shopCallbackSource.indexOf('saveTikTokShopCreatorConnection('),shopFinalAccess=shopCallbackSource.lastIndexOf('vxRequestAccessStillCurrent',shopSave);
assert.ok(shopFinalAccess>shopCallbackSource.lastIndexOf('archived_at IS NULL',shopSave)&&shopFinalAccess<shopSave,'Shop callback must recheck live access after its final ownership await');
assert.equal(version.trim(),'v0.20.70');assert.match(adminHtml,/ADMIN v0\.20\.70/);assert.match(adminHtml,/admin\.js\?v=02069/);assert.match(adminHtml,/admin-mobile\.css\?v=014129/);assert.match(analyzerHtml,/<b>v0\.20\.70<\/b>/);assert.match(analyzerHtml,/tiktok-analyzer\.js\?v=02127/);

console.log('PASS v0.20.69 TikTok Shop disconnected/connected/loading/stale action visibility');

const sqlite=new DatabaseSync(':memory:');
class Bound{
  constructor(sql){this.sql=sql;this.args=[]}
  bind(...args){this.args=args;return this}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.args)} }
  async run(){const result=sqlite.prepare(this.sql).run(...this.args);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const DB={prepare:sql=>new Bound(sql),exec:async sql=>sqlite.exec(sql),async batch(statements){sqlite.exec('BEGIN');try{const output=[];for(const statement of statements)output.push(await statement.run());sqlite.exec('COMMIT');return output}catch(error){sqlite.exec('ROLLBACK');throw error}}};
const env={DB,TIKTOK_CLIENT_KEY:'client-key',TIKTOK_CLIENT_SECRET:'client-secret',TIKTOK_REDIRECT_URI:'https://visiondonline.com/api/tiktok/callback',TIKTOK_SHOP_APP_KEY:'shop-key',TIKTOK_SHOP_APP_SECRET:'shop-secret',TIKTOK_SHOP_REDIRECT_URI:'https://visiondonline.com/api/tiktok-shop/callback'};
await ensureDatabase(env);await ensureVision7AuthSchema(env);await ensureTikTokAnalyzerSchema(env);await ensureVxAccess(env);sqlite.exec(await read('migrations/0094_vx_review_access.sql'));
const bossHash=await hashPassword('boss-password-safe');
sqlite.prepare("INSERT INTO users(id,email,username,name,password_hash,role) VALUES(1,'boss@example.invalid','boss','Boss',?,'boss')").run(bossHash);
sqlite.prepare("INSERT INTO users(id,email,username,name,password_hash,role) VALUES(2,'ordinary@example.invalid','ordinary','Ordinary',?,'user')").run(bossHash);
sqlite.prepare("INSERT INTO users(id,email,username,name,password_hash,role) VALUES(3,'admin@example.invalid','admin','Admin',?,'admin')").run(bossHash);
assert.throws(()=>sqlite.prepare("INSERT INTO vx_review_access_grants(user_id,starts_at,expires_at,created_by) VALUES(2,'bad','also-bad',1)").run(),'malformed grant timestamps must be rejected');
for(const [id,userId] of [['boss-session',1],['ordinary-session',2],['admin-session',3]])sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").run(id,userId);
const apiContext=(method,session,body,path='/api/admin/users/tiktok-reviewer')=>({env,request:new Request(`https://visiondonline.com${path}`,{method,headers:{cookie:`vd_session=${session}`,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),waitUntil(){}});

for(const [session,status] of [['ordinary-session',403],['admin-session',403]]){
  const denied=await listReviewers(apiContext('GET',session));assert.equal(denied.status,status);assert.equal(denied.headers.get('cache-control'),'private, no-store');
}
const password='Fresh-Reviewer-Password-69!';
const provision={action:'provision',name:'TikTok Reviewer',username:'reviewer-v69',email:'reviewer-v69@example.invalid',password};
const beforeOrders=sqlite.prepare('SELECT COUNT(*) count FROM orders').get().count,beforePaid=sqlite.prepare('SELECT COUNT(*) count FROM vx_access_grants').get().count;
const [createdA,createdB]=await Promise.all([writeReviewer(apiContext('POST','boss-session',provision)),writeReviewer(apiContext('POST','boss-session',provision))]);
assert.deepEqual([createdA.status,createdB.status].sort(),[200,201]);
const createdBodies=await Promise.all([createdA.json(),createdB.json()]);
assert.equal(createdBodies[0].item.id,createdBodies[1].item.id);assert.equal(createdBodies[0].item.expires_at,createdBodies[1].item.expires_at,'concurrent replay must not extend expiry');
assert.ok(createdBodies.every(body=>!JSON.stringify(body).includes(password)&&!JSON.stringify(body).includes('password_hash')),'secret must not be echoed');
const reviewer=sqlite.prepare("SELECT * FROM users WHERE username='reviewer-v69'").get();
assert.equal(reviewer.role,'user');assert.equal(reviewer.is_test_user,0);assert.equal(reviewer.phone,null);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM users WHERE username=?').get('reviewer-v69').count,1);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM vx_review_access_grants WHERE user_id=?').get(reviewer.id).count,1);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM orders').get().count,beforeOrders);assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM vx_access_grants').get().count,beforePaid);
const replay=await writeReviewer(apiContext('POST','boss-session',provision));assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
const wrong=await writeReviewer(apiContext('POST','boss-session',{...provision,password:'Different-Reviewer-Pass!'}));assert.equal(wrong.status,409);assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM vx_review_access_grants').get().count,1);

const loginResponse=await login({env,request:new Request('https://visiondonline.com/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:provision.username,password})}),waitUntil(){}});
assert.equal(loginResponse.status,200);const cookie=loginResponse.headers.get('set-cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Lax/);
const reviewerSession=/vd_session=([^;]+)/.exec(cookie)[1];
const me=await authMe({env,request:new Request('https://visiondonline.com/api/auth/me',{headers:{cookie:`vd_session=${reviewerSession}`}})});assert.equal(me.status,200);assert.equal((await me.json()).user.role,'user');
const reviewAccess=await vxAccess(env,{id:reviewer.id,role:'user'});assert.deepEqual({active:reviewAccess.active,admin:reviewAccess.admin,limit:reviewAccess.account_limit,source:reviewAccess.access_source},{active:true,admin:false,limit:1,source:'review'});
sqlite.prepare("INSERT INTO orders(id,order_no,user_id,total,status) VALUES(6901,'VX69-PAID',?,100,'paid')").run(reviewer.id);
sqlite.prepare("INSERT INTO vx_access_grants(order_id,user_id,plan_slug,account_limit,starts_at,expires_at) VALUES(6901,?,'vx-30-days-10',10,CURRENT_TIMESTAMP,datetime('now','+30 days'))").run(reviewer.id);
assert.equal((await vxAccess(env,{id:reviewer.id,role:'user'})).access_source,'paid','paid entitlement must take precedence');
sqlite.prepare('DELETE FROM vx_access_grants WHERE user_id=?').run(reviewer.id);

const foreign=sqlite.prepare("INSERT INTO tiktok_channels(id,name,channel_url,handle,created_by) VALUES('owner-channel','Owner','','',1)").run();assert.equal(Number(foreign.changes),1);
const reviewerCtx=path=>({env,request:new Request(`https://visiondonline.com${path}`,{headers:{cookie:`vd_session=${reviewerSession}`}})});
assert.equal((await requireVxUser(reviewerCtx('/api/tiktok-shop/connect?channel_id=owner-channel'))).vx.account_limit,1,'review grant authenticates but route ownership remains separately enforced');
const statesBefore=sqlite.prepare('SELECT COUNT(*) count FROM tiktok_oauth_states').get().count,shopStatesBefore=sqlite.prepare('SELECT COUNT(*) count FROM tiktok_shop_oauth_states').get().count;
assert.equal((await connectTikTok(reviewerCtx('/api/tiktok/connect?channel_id=owner-channel'))).status,404);assert.equal((await connectTikTokShop(reviewerCtx('/api/tiktok-shop/connect?channel_id=owner-channel'))).status,404);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM tiktok_oauth_states').get().count,statesBefore);assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM tiktok_shop_oauth_states').get().count,shopStatesBefore,'foreign channels must not create OAuth state');

const firstGrant=sqlite.prepare('SELECT * FROM vx_review_access_grants WHERE user_id=? ORDER BY id DESC').get(reviewer.id);
sqlite.prepare("UPDATE vx_review_access_grants SET starts_at=datetime('now','-30 days'),expires_at=datetime('now','-1 second') WHERE id=?").run(firstGrant.id);
assert.equal((await vxAccess(env,{id:reviewer.id,role:'user'})).active,false);
assert.equal((await requireVxUser(reviewerCtx('/api/tiktok-shop/connect?channel_id=owner-channel'))).error.status,403,'expired reviewer cannot start new OAuth');
const cleanupRequest={env,request:new Request('https://visiondonline.com/api/admin/tiktok-connections',{method:'POST',headers:{cookie:`vd_session=${reviewerSession}`,'content-type':'application/json'},body:JSON.stringify({action:'disconnect'})})};
assert.ok(!(await requireVxUser(cleanupRequest)).error,'expired reviewer may still revoke own consent');

const renewed=await writeReviewer(apiContext('POST','boss-session',{action:'renew',expected_grant_id:firstGrant.id}));assert.equal(renewed.status,200);
const renewedItem=(await renewed.json()).item;assert.notEqual(renewedItem.id,firstGrant.id);assert.equal(renewedItem.account_limit,1);
const revoked=await revokeReviewer(apiContext('DELETE','boss-session',{expected_grant_id:renewedItem.id}));assert.equal(revoked.status,200);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM sessions WHERE user_id=?').get(reviewer.id).count,0,'Boss revoke invalidates only reviewer sessions');
assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM sessions WHERE user_id=1").get().count,1,'Boss session must remain');
assert.equal((await vxAccess(env,{id:reviewer.id,role:'user'})).active,false);
const staleRevoke=await revokeReviewer(apiContext('DELETE','boss-session',{expected_grant_id:firstGrant.id}));assert.equal(staleRevoke.status,409);assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM sessions WHERE user_id=1").get().count,1);

sqlite.prepare("INSERT INTO users(email,username,name,password_hash,role) VALUES('taken@example.invalid','taken','Taken',?,'user')").run(bossHash);
const collision=await writeReviewer(apiContext('POST','boss-session',{...provision,email:'taken@example.invalid',username:'new-reviewer'}));assert.equal(collision.status,409);
assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM users WHERE username='new-reviewer'").get().count,0);
sqlite.prepare("INSERT INTO users(email,username,name,password_hash,role) VALUES('legacy@example.invalid','cross@example.invalid','Legacy Alias',?,'user')").run(bossHash);
const crossAlias=await writeReviewer(apiContext('POST','boss-session',{...provision,email:'cross@example.invalid',username:'another-reviewer'}));assert.equal(crossAlias.status,409,'login precedence aliases must not create a second identity');
for(let index=0;index<25;index++){
  const user=sqlite.prepare("INSERT INTO users(email,username,name,password_hash,role,is_test_user) VALUES(?,?,?,?, 'user',0)").run(`page-${index}@example.invalid`,`page-${index}`,`Page ${index}`,bossHash);
  sqlite.prepare("INSERT INTO vx_review_access_grants(user_id,starts_at,expires_at,created_by) VALUES(?,CURRENT_TIMESTAMP,datetime('now','+30 days'),1)").run(Number(user.lastInsertRowid));
}
const firstPage=await listReviewers(apiContext('GET','boss-session')),firstPageBody=await firstPage.json();assert.equal(firstPageBody.items.length,24);assert.match(firstPageBody.next_cursor,/^[1-9]\d*$/);
const secondPage=await listReviewers({...apiContext('GET','boss-session'),request:new Request(`https://visiondonline.com/api/admin/users/tiktok-reviewer?cursor=${firstPageBody.next_cursor}`,{headers:{cookie:'vd_session=boss-session'}})}),secondPageBody=await secondPage.json();
assert.ok(secondPageBody.items.length>0);assert.equal(new Set([...firstPageBody.items,...secondPageBody.items].map(item=>item.id)).size,firstPageBody.items.length+secondPageBody.items.length,'keyset pages must not duplicate grants');
assert.equal((await listReviewers({...apiContext('GET','boss-session'),request:new Request('https://visiondonline.com/api/admin/users/tiktok-reviewer?cursor=1e2',{headers:{cookie:'vd_session=boss-session'}})})).status,400);
const plan=sqlite.prepare("EXPLAIN QUERY PLAN SELECT g.id FROM vx_review_access_grants g JOIN users u ON u.id=g.user_id WHERE g.user_id=? AND g.revoked_at IS NULL AND g.expires_at>CURRENT_TIMESTAMP ORDER BY g.expires_at DESC,g.id DESC LIMIT 1").all(reviewer.id).map(row=>row.detail).join(' | ');
assert.match(plan,/idx_vx_review_access_user_active/);
assert.doesNotMatch(plan,/SCAN g|USE TEMP B-TREE/);

console.log('PASS v0.20.69 reviewer provision/login/expiry/renew/revoke/paid-priority/index/security gates');
