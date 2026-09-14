import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {ensureDatabase} from '../functions/_schema.js';
import {ensureTikTokAnalyzerSchema} from '../functions/_tiktok_analyzer.js';
import {ensureVxAccess} from '../functions/_vx_access.js';
import {encryptChannelValue} from '../functions/_channel_crypto.js';
import {onRequestGet as analyzerGet,onRequestPost as analyzerPost} from '../functions/api/admin/tiktok-analyzer/index.js';
import {onRequestGet as connectionsGet,onRequestPost as connectionsPost} from '../functions/api/admin/tiktok-connections/index.js';
import {onRequestGet as commissionsGet} from '../functions/api/admin/tiktok-commissions.js';
import {onRequestGet as cardsGet,onRequestPost as cardsPost} from '../functions/api/admin/tiktok-commission-cards/index.js';
import {onRequestGet as cardGet} from '../functions/api/admin/tiktok-commission-cards/[id].js';
import {onRequestGet as referralsGet} from '../functions/api/vx/referrals.js';
import {onRequestGet as payoutGet} from '../functions/api/vx/payouts/[id].js';

const sqlite=new DatabaseSync(':memory:');
const queries=[];
class Bound{
  constructor(sql,args=[]){this.sql=sql;this.args=args}
  bind(...args){return new Bound(this.sql,args)}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const DB={
  prepare(sql){queries.push(String(sql));return new Bound(sql)},
  async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());sqlite.exec('COMMIT');return out}catch(error){sqlite.exec('ROLLBACK');throw error}}
};
const breaker=()=>JSON.stringify({version:1,revision:1,auto_closed:false,auto_closed_day:'',status:'ok',reason:'below_close_threshold',sample_day:new Date().toISOString().slice(0,10),sampled_at:new Date().toISOString(),reported_at:new Date().toISOString(),rows_read:0,rows_written:0,read_limit:5000000,write_limit:100000,read_percent:0,write_percent:0,usage_percent:0,source:'test',last_error:'',monitor_configured:true,monitor_interval:'1234567',monitor_lease:null,audit:[]});
const r2={gets:0,puts:0,deletes:0};
const FILES={async get(){r2.gets++;return{etag:'test',text:async()=>breaker()}},async put(){r2.puts++;return{}},async delete(){r2.deletes++}};
const env={DB,FILES,GEMINI_API_KEY:'test-key',VISIOND_CHANNEL_ENCRYPTION_KEY:'x'.repeat(32),TIKTOK_CLIENT_KEY:'key',TIKTOK_CLIENT_SECRET:'secret',TIKTOK_SHOP_APP_KEY:'shop-key',TIKTOK_SHOP_APP_SECRET:'shop-secret'};
await ensureDatabase(env);await ensureTikTokAnalyzerSchema(env);await ensureVxAccess(env);
for(const name of['0094_vx_review_access.sql','0095_tiktok_browser_profile_bindings.sql','0096_tiktok_oauth_handoffs.sql','0097_tiktok_direct_profile_login.sql','0098_browser_launcher_transport.sql','0103_browser_launcher_capability.sql','0109_vx_boss_channel_operator.sql']){let sql=await readFile(new URL('../migrations/'+name,import.meta.url),'utf8');if(name.startsWith('0109_'))sql=sql.replace(/^ALTER TABLE tiktok_connections ADD COLUMN avatar_.*;\r?$/gm,'');sqlite.exec(sql)}

sqlite.prepare("INSERT INTO users(id,email,username,name,password_hash,role,is_test_user) VALUES(1,'boss@example.test','boss','Boss','x','boss',0),(3,'user@example.test','user','User','x','user',0),(10,'testervx@gmail.com','testervx','Testervx','x','user',0)").run();
sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('boss-session',1,datetime('now','+1 day')),('user-session',3,datetime('now','+1 day')),('testervx-session',10,datetime('now','+1 day'))").run();
const delegationId='testervx-boss-tiktok-channel-operator-v1',channelId='11111111-1111-4111-8111-111111111111',connectionId='22222222-2222-4222-8222-222222222222',shopId='33333333-3333-4333-8333-333333333333';
sqlite.prepare("INSERT INTO vx_workspace_delegations(id,delegate_user_id,owner_user_id,scope,created_by) VALUES(?,10,1,'boss_tiktok_channel_operator',1)").run(delegationId);
sqlite.prepare("INSERT INTO tiktok_channels(id,name,channel_url,created_by) VALUES(?,'Boss channel','https://www.tiktok.com/@boss',1)").run(channelId);
const accessCipher=await encryptChannelValue(env,'access'),refreshCipher=await encryptChannelValue(env,'refresh');
sqlite.prepare("INSERT INTO tiktok_connections(id,user_id,channel_id,open_id,display_name,access_token_ciphertext,refresh_token_ciphertext,scopes,access_expires_at,refresh_expires_at,status) VALUES(?,1,?,'boss-open','Boss profile',?,?, 'user.info.basic',datetime('now','+1 day'),datetime('now','+30 days'),'active')").run(connectionId,channelId,accessCipher,refreshCipher);
sqlite.prepare("INSERT INTO tiktok_shop_creator_connections(id,user_id,channel_id,open_id,access_token_ciphertext,refresh_token_ciphertext,scopes,access_expires_at,refresh_expires_at,status,creator_username) VALUES(?,1,?,'boss-shop',?,?,'creator.showcase.write,creator.affiliate_collaboration.read',datetime('now','+1 day'),datetime('now','+30 days'),'active','Boss shop')").run(shopId,channelId,accessCipher,refreshCipher);
sqlite.prepare("INSERT INTO tiktok_shop_showcase_products(connection_id,product_id,name,image_url,product_url,price_json,commission_json,raw_json,product_grade) VALUES(?,'p1','Product','https://img.test/p1.jpg','https://shop.test/p1','{\"amount\":\"100\"}','{\"amount\":\"30\"}','{\"commission\":{\"amount\":\"30\"}}','B')").run(shopId);
sqlite.prepare("INSERT INTO tiktok_shop_affiliate_orders(connection_id,order_id,create_time,gmv_json,commission_json,raw_json) VALUES(?,'order-secret',unixepoch('now'),'{\"amount\":\"100\"}','{\"amount\":\"30\"}','{\"secret\":true}')").run(shopId);

const request=(session,path,{method='GET',json,form,params={}}={})=>({env,params,request:new Request('https://visiondonline.com'+path,{method,headers:{cookie:`vd_session=${session}`,...(json?{'content-type':'application/json',origin:'https://visiondonline.com'}:{})},body:json?JSON.stringify(json):form})});
const keys=value=>value&&typeof value==='object'?Object.entries(value).flatMap(([key,child])=>[key,...keys(child)]):[];
const activate=()=>{sqlite.prepare("UPDATE vx_workspace_delegations SET revoked_at=NULL WHERE id=?").run(delegationId);sqlite.prepare("UPDATE sessions SET expires_at=datetime('now','+1 day') WHERE id='testervx-session'").run()};

let response=await analyzerGet(request('testervx-session','/api/admin/tiktok-analyzer'));
assert.equal(response.status,200);let body=await response.json();assert.deepEqual(body.channels.map(channel=>channel.id),[channelId]);assert.equal(body.workspace.delegated,true);
response=await analyzerGet(request('testervx-session',`/api/admin/tiktok-analyzer?channel_id=${channelId}&resource=channel`));assert.equal(response.status,200);assert.equal((await response.json()).channel.created_by,1);
response=await analyzerGet(request('user-session',`/api/admin/tiktok-analyzer?channel_id=${channelId}&resource=channel`));assert.equal(response.status,403,'ordinary User cannot read a Boss channel');
response=await analyzerGet(request('user-session','/api/admin/tiktok-analyzer'));assert.deepEqual((await response.json()).channels,[],'ordinary User list never inherits Boss rows');
response=await analyzerGet(request('boss-session','/api/admin/tiktok-analyzer'));assert.deepEqual((await response.json()).channels.map(channel=>channel.id),[channelId],'Boss behavior stays owner-scoped');
const selection=new FormData();selection.set('action','set_product_c');selection.set('channel_id',channelId);selection.set('product_name','Delegated selection');selection.set('source_kind','manual_selection');
response=await analyzerPost(request('testervx-session','/api/admin/tiktok-analyzer',{method:'POST',form:selection}));assert.equal(response.status,200,await response.clone().text());
assert.equal(sqlite.prepare("SELECT channel_id FROM tiktok_channel_products WHERE name='Delegated selection'").get().channel_id,channelId,'delegate mutation stays in Boss-owned channel');

queries.length=0;r2.gets=0;response=await connectionsGet(request('testervx-session',`/api/admin/tiktok-connections?channel_id=${channelId}`));assert.equal(response.status,200);body=await response.json();
assert.deepEqual(body.connections.map(item=>item.channel_id),[channelId]);assert.deepEqual(body.shop_connections.map(item=>item.channel_id),[channelId]);assert.equal(body.shop_products.length,1);
for(const forbiddenKey of keys(body).filter(key=>/object_key|ciphertext|access_token|refresh_token|creator_avatar_url|avatar_revision|avatar_source/i.test(key)))assert.fail(`connections payload leaked secret/storage field ${forbiddenKey}`);
for(const connection of body.connections)assert.ok(!connection.avatar_url||connection.avatar_url.startsWith('/api/admin/tiktok-avatar/'),'connection avatar is same-origin only');
assert.equal(r2.gets,0,'ordinary delegated connection list performs zero R2 reads');
for(const forbiddenKey of keys(body).filter(key=>/commission|order/i.test(key)))assert.fail(`delegated connections payload leaked financial key ${forbiddenKey}`);
const readQueries=queries.filter(sql=>/^\s*(?:SELECT|WITH)\b/i.test(sql)).join('\n');
for(const forbidden of['tiktok_shop_affiliate_orders','commission_json','shop_portfolio'])assert.doesNotMatch(readQueries,new RegExp(forbidden,'i'),`delegate GET must not read ${forbidden}`);
assert.doesNotMatch(readQueries,/SELECT\s+\*\s+FROM\s+tiktok_connections/i,'connection list uses an explicit non-secret projection');
assert.doesNotMatch(queries.join('\n'),/^\s*(?:CREATE|ALTER)\b/im,'ordinary delegated connection list performs no request-time DDL');
for(let index=0;index<25;index++){const id=`40000000-0000-4000-8000-${String(index).padStart(12,'0')}`,ownedChannel=`50000000-0000-4000-8000-${String(index).padStart(12,'0')}`;sqlite.prepare("INSERT INTO tiktok_channels(id,name,created_by) VALUES(?,'Paged channel',1)").run(ownedChannel);sqlite.prepare("INSERT INTO tiktok_connections(id,user_id,channel_id,open_id,display_name,access_token_ciphertext,refresh_token_ciphertext,scopes,access_expires_at,refresh_expires_at,status,updated_at) VALUES(?,1,?,?,?, ?,?,'user.info.basic',datetime('now','+1 day'),datetime('now','+30 days'),'active',?)").run(id,ownedChannel,`open-${index}`,`Profile ${index}`,accessCipher,refreshCipher,`2026-09-13 00:${String(index).padStart(2,'0')}:00`)}
response=await connectionsGet(request('boss-session','/api/admin/tiktok-connections'));body=await response.json();assert.equal(body.connections.length,24);assert.equal(body.connection_pagination.has_more,true);const firstIds=new Set(body.connections.map(item=>item.id));
response=await connectionsGet(request('boss-session',`/api/admin/tiktok-connections?connection_cursor=${encodeURIComponent(body.connection_pagination.next_cursor)}`));const nextBody=await response.json();assert.equal(nextBody.connections.length,2);assert.equal(nextBody.connections.some(item=>firstIds.has(item.id)),false,'connection cursor has no duplicate rows');

const financialHandlers=[
  ['commissions',()=>commissionsGet(request('testervx-session','/api/admin/tiktok-commissions'))],
  ['cards-get',()=>cardsGet(request('testervx-session','/api/admin/tiktok-commission-cards'))],
  ['cards-post',()=>cardsPost(request('testervx-session','/api/admin/tiktok-commission-cards',{method:'POST',form:new FormData()}))],
  ['card-item',()=>cardGet(request('testervx-session','/api/admin/tiktok-commission-cards/card-secret',{params:{id:'card-secret'}}))],
  ['referrals',()=>referralsGet(request('testervx-session','/api/vx/referrals'))],
  ['payout',()=>payoutGet(request('testervx-session','/api/vx/payouts/payout-secret',{params:{id:'payout-secret'}}))]
];
queries.length=0;r2.gets=r2.puts=r2.deletes=0;
for(const [name,call] of financialHandlers){response=await call();assert.equal(response.status,403,name)}
assert.equal(r2.gets+r2.puts+r2.deletes,0,'financial denial happens before R2');
assert.doesNotMatch(queries.join('\n'),/tiktok_(?:commission_cards|shop_affiliate_orders)|vx_referral_(?:commissions|payouts|adjustments)/i,'financial denial happens before financial D1');

const aiResult={summary:'ok',homework:[],winner_products:[],next_product_candidates:[],avoid_products:[],daily_product_list:[],data_gaps:[],extracted_metrics:[]};
async function analyzerRace(mode){
  activate();let release,started;const began=new Promise(resolve=>{started=resolve});const priorFetch=globalThis.fetch;globalThis.fetch=(url)=>new Promise(resolve=>{release=resolve;started(String(url))});
  try{
    const form=new FormData();form.set('channel_id',channelId);form.set('channel_name','Boss channel');form.set('notes','race gate');
    const pending=analyzerPost(request('testervx-session','/api/admin/tiktok-analyzer',{method:'POST',form}));await began;
    if(mode==='revoked')sqlite.prepare('UPDATE vx_workspace_delegations SET revoked_at=CURRENT_TIMESTAMP WHERE id=?').run(delegationId);else sqlite.prepare("UPDATE sessions SET expires_at=datetime('now','-1 second') WHERE id='testervx-session'").run();
    release(new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(aiResult)}]}}]}),{status:200,headers:{'content-type':'application/json'}}));
    const result=await pending;assert.equal(result.status,403,`analyzer ${mode} during provider await`);
  }finally{globalThis.fetch=priorFetch}
}
const baselineRuns=sqlite.prepare('SELECT COUNT(*) n FROM tiktok_analysis_runs').get().n,baselineProducts=sqlite.prepare('SELECT COUNT(*) n FROM tiktok_channel_products').get().n;
await analyzerRace('revoked');await analyzerRace('expired');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM tiktok_analysis_runs').get().n,baselineRuns);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM tiktok_channel_products').get().n,baselineProducts);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM tiktok_analysis_images').get().n,0);assert.equal(r2.puts,0,'revoked/expired analyzer cannot write R2');

activate();let releaseProfile,profileStarted;const profileBegan=new Promise(resolve=>{profileStarted=resolve}),priorFetch=globalThis.fetch;
globalThis.fetch=url=>new Promise(resolve=>{releaseProfile=resolve;profileStarted(String(url))});
try{
  const pending=connectionsPost(request('testervx-session','/api/admin/tiktok-connections',{method:'POST',json:{action:'sync',id:connectionId,channel_id:channelId}}));await profileBegan;
  sqlite.prepare('UPDATE vx_workspace_delegations SET revoked_at=CURRENT_TIMESTAMP WHERE id=?').run(delegationId);
  releaseProfile(new Response(JSON.stringify({data:{user:{display_name:'Leaked update'}},error:{code:'ok'}}),{status:200,headers:{'content-type':'application/json'}}));
  response=await pending;assert.equal(response.status,403,'profile sync revocation after provider await');
}finally{globalThis.fetch=priorFetch}
assert.equal(sqlite.prepare('SELECT display_name FROM tiktok_connections WHERE id=?').get(connectionId).display_name,'Boss profile');assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM tiktok_connection_videos').get().n,0);

async function shopRace(action,extra={}){
  activate();let release,started;const began=new Promise(resolve=>{started=resolve}),prior=globalThis.fetch;
  globalThis.fetch=url=>new Promise(resolve=>{release=resolve;started(String(url))});
  try{
    const pending=connectionsPost(request('testervx-session','/api/admin/tiktok-connections',{method:'POST',json:{action,id:shopId,channel_id:channelId,...extra}}));await began;
    sqlite.prepare('UPDATE vx_workspace_delegations SET revoked_at=CURRENT_TIMESTAMP WHERE id=?').run(delegationId);
    release(new Response(JSON.stringify({code:0,data:action==='shop_sync'?{username:'Changed shop'}:{}}),{status:200,headers:{'content-type':'application/json'}}));
    const result=await pending;assert.equal(result.status,403,`${action} revocation after provider await`);
  }finally{globalThis.fetch=prior}
}
await shopRace('shop_sync',{mode:'showcase'});assert.equal(sqlite.prepare('SELECT creator_username FROM tiktok_shop_creator_connections WHERE id=?').get(shopId).creator_username,'Boss shop');
await shopRace('shop_add',{product_ids:['new-product']});assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM tiktok_shop_showcase_products WHERE connection_id=? AND product_id='new-product'").get(shopId).n,0);
await shopRace('shop_remove',{product_ids:['p1']});assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM tiktok_shop_showcase_products WHERE connection_id=? AND product_id='p1'").get(shopId).n,1);

activate();let releaseRevoke,revokeStarted;const revokeBegan=new Promise(resolve=>{revokeStarted=resolve}),previousFetch=globalThis.fetch;
globalThis.fetch=url=>new Promise(resolve=>{releaseRevoke=resolve;revokeStarted(String(url))});
try{
  const pending=connectionsPost(request('testervx-session','/api/admin/tiktok-connections',{method:'POST',json:{action:'disconnect',id:connectionId,channel_id:channelId}}));await revokeBegan;
  sqlite.prepare('UPDATE vx_workspace_delegations SET revoked_at=CURRENT_TIMESTAMP WHERE id=?').run(delegationId);releaseRevoke(new Response('{}',{status:200}));
  response=await pending;assert.equal(response.status,403,'disconnect revocation after provider revoke');
}finally{globalThis.fetch=previousFetch}
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM tiktok_connections WHERE id=?').get(connectionId).n,1,'revoked actor cannot delete Boss LoginKit row');
response=await connectionsPost(request('testervx-session','/api/admin/tiktok-connections',{method:'POST',json:{action:'shop_disconnect',id:shopId,channel_id:channelId}}));assert.ok([403,404].includes(response.status));
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM tiktok_shop_creator_connections WHERE id=?').get(shopId).n,1,'revoked actor cannot delete Boss Shop row');

sqlite.close();
console.log('PASS v0.20.117 real analyzer/connections routes, Boss effective-owner mutation, ordinary-user isolation, zero delegated financial SQL/R2/request-time DDL, and analyzer/profile/shop/add/remove/disconnect provider-race write denial');
