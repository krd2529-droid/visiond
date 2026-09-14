import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {encryptChannelValue} from '../functions/_channel_crypto.js';
import {MAX_AVATAR_BYTES,mirrorTikTokAvatar,providerAvatarUrl} from '../functions/_tiktok_avatar.js';
import {syncTikTokConnection,tikTokVisibleProfile} from '../functions/_tiktok_oauth.js';
import {onRequestGet as avatarGet,onRequestHead as avatarHead} from '../functions/api/admin/tiktok-avatar/[id].js';

const sqlite=new DatabaseSync(':memory:'),queries=[];
sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,is_test_user INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
CREATE TABLE entitlements(id INTEGER,user_id INTEGER,product_id INTEGER,active INTEGER);
CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT);
CREATE TABLE courses(id INTEGER,product_id INTEGER,course_type TEXT);
CREATE TABLE course_right_credits(id INTEGER,user_id INTEGER);
CREATE TABLE orders(id INTEGER,user_id INTEGER,status TEXT);
CREATE TABLE vx_access_grants(order_id INTEGER,user_id INTEGER,plan_slug TEXT,account_limit INTEGER,starts_at TEXT,expires_at TEXT);
CREATE TABLE vx_review_access_grants(id TEXT,user_id INTEGER,scope TEXT,account_limit INTEGER,starts_at TEXT,expires_at TEXT,revoked_at TEXT);
CREATE TABLE vx_workspace_delegations(id TEXT PRIMARY KEY,delegate_user_id INTEGER,owner_user_id INTEGER,scope TEXT,revoked_at TEXT,created_by INTEGER);
CREATE TABLE tiktok_channels(id TEXT PRIMARY KEY,created_by INTEGER,archived_at TEXT);
CREATE TABLE tiktok_connections(id TEXT PRIMARY KEY,user_id INTEGER,channel_id TEXT,open_id TEXT,union_id TEXT DEFAULT '',display_name TEXT DEFAULT '',avatar_url TEXT DEFAULT '',avatar_object_key TEXT DEFAULT '',avatar_mime_type TEXT DEFAULT '',avatar_file_size INTEGER DEFAULT 0,avatar_revision TEXT DEFAULT '',avatar_mirrored_at TEXT,avatar_sync_generation INTEGER DEFAULT 0,profile_url TEXT DEFAULT '',bio TEXT DEFAULT '',is_verified INTEGER DEFAULT 0,follower_count INTEGER DEFAULT 0,following_count INTEGER DEFAULT 0,likes_count INTEGER DEFAULT 0,video_count INTEGER DEFAULT 0,access_token_ciphertext TEXT,refresh_token_ciphertext TEXT,scopes TEXT,access_expires_at TEXT,refresh_expires_at TEXT,status TEXT,last_synced_at TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE tiktok_connection_videos(connection_id TEXT,video_id TEXT,title TEXT,description TEXT,create_time INTEGER,duration INTEGER,cover_url TEXT,embed_link TEXT,view_count INTEGER,like_count INTEGER,comment_count INTEGER,share_count INTEGER,synced_at TEXT,PRIMARY KEY(connection_id,video_id));`);
class Bound{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Bound(this.sql,args)}async first(){return sqlite.prepare(this.sql).get(...this.args)||null}async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}async run(){const value=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(value.changes)}}}}
const DB={prepare(sql){queries.push(String(sql));return new Bound(sql)},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());sqlite.exec('COMMIT');return out}catch(error){sqlite.exec('ROLLBACK');throw error}}};
const objects=new Map(),r2={puts:0,gets:0,heads:0,deletes:0};
const FILES={async put(key,bytes,options){r2.puts++;const data=new Uint8Array(bytes);objects.set(key,{data,size:data.length,httpMetadata:options.httpMetadata,customMetadata:options.customMetadata,httpEtag:`etag-${r2.puts}`})},async get(key){r2.gets++;const value=objects.get(key);return value?{...value,body:value.data}:null},async head(key){r2.heads++;const value=objects.get(key);return value?{...value,body:undefined}:null},async delete(key){r2.deletes++;objects.delete(key)}};
const env={DB,FILES,VISIOND_CHANNEL_ENCRYPTION_KEY:'avatar-test-key-'.padEnd(40,'x')};
const ownerId=1,delegateId=10,otherId=20,adminId=30,channelId='11111111-1111-4111-8111-111111111111',connectionId='22222222-2222-4222-8222-222222222222';
sqlite.prepare("INSERT INTO users(id,email,username,name,role,is_test_user) VALUES(1,'boss@test','boss','Boss','boss',0),(10,'testervx@gmail.com','testervx','Testervx','user',0),(20,'user@test','user','User','user',0),(30,'admin@test','admin','Admin','admin',0)").run();
sqlite.prepare("INSERT INTO sessions VALUES('boss',1,datetime('now','+1 day')),('delegate',10,datetime('now','+1 day')),('other',20,datetime('now','+1 day')),('admin',30,datetime('now','+1 day'))").run();
sqlite.prepare("INSERT INTO vx_workspace_delegations VALUES('delegate-v1',10,1,'boss_tiktok_channel_operator',NULL,1)").run();
sqlite.prepare('INSERT INTO tiktok_channels VALUES(?,1,NULL)').run(channelId);
const access=await encryptChannelValue(env,'access'),refresh=await encryptChannelValue(env,'refresh');
sqlite.prepare(`INSERT INTO tiktok_connections(id,user_id,channel_id,open_id,display_name,avatar_url,access_token_ciphertext,refresh_token_ciphertext,scopes,access_expires_at,refresh_expires_at,status)
 VALUES(?,1,?,'open','Boss profile','https://expired.example/avatar',?,?,'user.info.basic',datetime('now','+1 day'),datetime('now','+30 days'),'active')`).run(connectionId,channelId,access,refresh);

const png=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3,4]),jpeg=new Uint8Array([0xff,0xd8,0xff,0xe0,1,2,3,4]);
const imageResponse=(bytes,type='image/png',headers={})=>new Response(new ReadableStream({start(controller){controller.enqueue(bytes);controller.close()}}),{status:200,headers:{'content-type':type,...headers}});
const row=()=>sqlite.prepare('SELECT * FROM tiktok_connections WHERE id=?').get(connectionId);
assert.equal(providerAvatarUrl('http://127.0.0.1/private'),null,'private/non-HTTPS source is refused before fetch');
let fetches=0,result=await mirrorTikTokAvatar(env,row(),'https://p16-sign-va.tiktokcdn.com/avatar.png',async()=>{fetches++;return imageResponse(png)});
assert.equal(result.mirrored,true,'valid streaming image without Content-Length mirrors');assert.equal(r2.puts,1);assert.equal(fetches,1);assert.match(row().avatar_object_key,new RegExp(`^tiktok-avatars/${ownerId}/${connectionId}/[0-9a-f]{64}\\.png$`));assert.equal(row().avatar_file_size,png.length);
const stable=row(),putsAfterFirst=r2.puts,attachWrites=queries.filter(sql=>/SET avatar_url='',avatar_object_key=/.test(sql)).length;
result=await mirrorTikTokAvatar(env,stable,'https://p16-sign-va.tiktokcdn.com/avatar.png',async()=>imageResponse(png));assert.equal(result.reason,'unchanged');assert.equal(r2.puts,putsAfterFirst,'same digest performs zero redundant R2 writes');assert.equal(queries.filter(sql=>/SET avatar_url='',avatar_object_key=/.test(sql)).length,attachWrites,'same digest performs zero redundant D1 attaches');
objects.delete(row().avatar_object_key);const putsBeforeRepair=r2.puts;result=await mirrorTikTokAvatar(env,row(),'https://p16-sign-va.tiktokcdn.com/avatar.png',async()=>imageResponse(png));assert.equal(result.mirrored,true,'explicit sync repairs a missing same-digest object');assert.equal(r2.puts,putsBeforeRepair+1);assert.equal(objects.has(row().avatar_object_key),true);
const knownKey=row().avatar_object_key;
for(const [name,response] of [['mime',imageResponse(png,'text/html')],['magic',imageResponse(jpeg,'image/png')],['redirect',new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})]]){result=await mirrorTikTokAvatar(env,row(),'https://p16-sign-va.tiktokcdn.com/avatar.png',async()=>response);assert.equal(result.mirrored,false,name);assert.equal(row().avatar_object_key,knownKey,`${name} preserves known-good mirror`)}
const oversized=new Uint8Array(MAX_AVATAR_BYTES+1);oversized.set(png);result=await mirrorTikTokAvatar(env,row(),'https://p16-sign-va.tiktokcdn.com/avatar.png',async()=>imageResponse(oversized));assert.equal(result.mirrored,false);assert.equal(row().avatar_object_key,knownKey,'stream cap preserves known mirror');
let privateFetch=0;result=await mirrorTikTokAvatar(env,row(),'https://127.0.0.1/avatar.png',async()=>{privateFetch++;return imageResponse(png)});assert.equal(privateFetch,0,'SSRF source rejected before network');assert.equal(result.reason,'source_unavailable');
let stalledCanceled=false,stalledSignal;const stalledAt=Date.now(),writesBeforeStall=queries.filter(sql=>/^UPDATE tiktok_connections SET avatar_url=/i.test(sql.trim())).length,putsBeforeStall=r2.puts;
result=await mirrorTikTokAvatar(env,row(),'https://p16-sign-va.tiktokcdn.com/stalled.png',async(_url,init)=>{stalledSignal=init.signal;return new Response(new ReadableStream({start(controller){controller.enqueue(png.slice(0,8))},cancel(){stalledCanceled=true}}),{status:200,headers:{'content-type':'image/png'}})},{stillAuthorized:async()=>true,downloadTimeoutMs:25});
assert.equal(result.mirrored,false);assert.equal(result.reason,'AVATAR_DOWNLOAD_TIMEOUT');assert.equal(stalledSignal.aborted,true,'the fetch signal stays live and aborts during the body read');assert.equal(stalledCanceled,true,'timeout cancels the stalled response reader');assert.ok(Date.now()-stalledAt<1000,'deterministic timeout must not wait the production 10 seconds');assert.equal(r2.puts,putsBeforeStall,'stalled body cannot write R2');assert.equal(queries.filter(sql=>/^UPDATE tiktok_connections SET avatar_url=/i.test(sql.trim())).length,writesBeforeStall,'stalled body cannot attach D1');assert.equal(row().avatar_object_key,knownKey,'stalled body preserves known mirror');

const generationBefore=row().avatar_sync_generation,putsBeforeRace=r2.puts;
result=await mirrorTikTokAvatar(env,row(),'https://p16-sign-va.tiktokcdn.com/new.jpg',async()=>{sqlite.prepare('UPDATE tiktok_connections SET avatar_sync_generation=avatar_sync_generation+1 WHERE id=?').run(connectionId);return imageResponse(jpeg,'image/jpeg')});assert.equal(result.reason,'concurrent_update');assert.equal(r2.puts,putsBeforeRace,'older generation loses before R2');assert.equal(row().avatar_object_key,knownKey);
let authorizationChecks=0;const deletesBefore=r2.deletes;await assert.rejects(mirrorTikTokAvatar(env,row(),'https://p16-sign-va.tiktokcdn.com/new.jpg',async()=>imageResponse(jpeg,'image/jpeg'),{stillAuthorized:async()=>++authorizationChecks===1}),/VX_WORKSPACE_ACCESS_REVOKED/);assert.equal(r2.puts,putsBeforeRace+1);assert.equal(r2.deletes,deletesBefore+1,'revocation after R2 put cleans unattached object');assert.equal(row().avatar_object_key,knownKey);

const putsBeforeSync=r2.puts;result=await syncTikTokConnection(env,row(),async url=>{assert.match(String(url),/user\/info/);return Response.json({data:{user:{open_id:'open',display_name:'Updated',avatar_url:'http://127.0.0.1/private'}},error:{code:'ok'}})},{stillAuthorized:async()=>true});
assert.equal(result.avatar.preserved,true);assert.equal(row().avatar_url,'','failed image retrieval clears durable remote source');assert.equal(row().avatar_object_key,knownKey,'failed explicit sync preserves mirror');assert.equal(r2.puts,putsBeforeSync);
let releaseOld,oldStarted;const oldBegan=new Promise(resolve=>{oldStarted=resolve});
const oldSync=syncTikTokConnection(env,row(),async()=>new Promise(resolve=>{releaseOld=resolve;oldStarted()}),{stillAuthorized:async()=>true});await oldBegan;
const newSync=syncTikTokConnection(env,row(),async()=>Response.json({data:{user:{open_id:'open',display_name:'Newest profile',avatar_url:''}},error:{code:'ok'}}),{stillAuthorized:async()=>true});await newSync;
releaseOld(Response.json({data:{user:{open_id:'open',display_name:'Stale profile',avatar_url:''}},error:{code:'ok'}}));await assert.rejects(oldSync,/TIKTOK_SYNC_SUPERSEDED/);assert.equal(row().display_name,'Newest profile','older-started profile/video batch cannot overwrite newer sync');
const stored=row(),visible=tikTokVisibleProfile({id:stored.id,channel_id:stored.channel_id,display_name:stored.display_name,avatar_url:'https://expired.example/avatar',avatar_object_key:stored.avatar_object_key,avatar_revision:stored.avatar_revision,scopes:stored.scopes,status:stored.status}),serialized=JSON.stringify(visible);assert.match(visible.avatar_url,/^\/api\/admin\/tiktok-avatar\/[0-9a-f-]{36}\?v=[0-9a-f]{64}$/);assert.doesNotMatch(serialized,/avatar_object_key|avatar_revision|expired\.example|ciphertext|access_token|refresh_token/i);

const ctx=(session,method='GET')=>({env,params:{id:connectionId},request:new Request(`https://visiondonline.com/api/admin/tiktok-avatar/${connectionId}?v=${row().avatar_revision}`,{method,headers:session?{cookie:`vd_session=${session}`}:{}})});
let response=await avatarGet(ctx('boss'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.has('content-disposition'),false);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),png);
response=await avatarGet(ctx('delegate'));assert.equal(response.status,200,'Testervx reads Boss workspace avatar');
response=await avatarHead(ctx('delegate','HEAD'));assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,0);assert.equal(response.headers.get('cache-control'),'private, no-store');
response=await avatarGet(ctx('other'));assert.equal(response.status,403);assert.equal(response.headers.get('cache-control'),'private, no-store');
response=await avatarGet(ctx('admin'));assert.equal(response.status,404,'non-owner admin cannot read Boss avatar');
response=await avatarGet(ctx(''));assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'private, no-store');
sqlite.prepare("INSERT INTO vx_review_access_grants VALUES('review',10,'tiktok_app_review',1,datetime('now','-1 day'),datetime('now','+1 day'),NULL)").run();sqlite.prepare("UPDATE vx_workspace_delegations SET revoked_at=CURRENT_TIMESTAMP WHERE id='delegate-v1'").run();response=await avatarGet(ctx('delegate'));assert.equal(response.status,403,'revoked delegate cannot fall back to reviewer grant');
sqlite.prepare('UPDATE tiktok_connections SET avatar_file_size=avatar_file_size+1 WHERE id=?').run(connectionId);response=await avatarGet(ctx('boss'));assert.equal(response.status,404,'R2 size must exactly match metadata');assert.equal(response.headers.get('cache-control'),'private, no-store');
sqlite.prepare('UPDATE tiktok_connections SET avatar_file_size=avatar_file_size-1 WHERE id=?').run(connectionId);
const validObject=objects.get(knownKey);
for(const [field,value] of [['ownerUserId',String(otherId)],['connectionId','33333333-3333-4333-8333-333333333333'],['revision','f'.repeat(64)]]){
  objects.set(knownKey,{...validObject,customMetadata:{...validObject.customMetadata,[field]:value}});
  for(const [handler,method] of [[avatarGet,'GET'],[avatarHead,'HEAD']]){response=await handler(ctx('boss',method));assert.equal(response.status,404,`${method} rejects cross-object ${field} metadata`);assert.equal(response.headers.get('cache-control'),'private, no-store');if(method==='HEAD')assert.equal((await response.arrayBuffer()).byteLength,0,'rejected HEAD has no body')}
  objects.set(knownKey,validObject);
}
const wrongKey='tiktok-avatars/20/33333333-3333-4333-8333-333333333333/'+row().avatar_revision+'.png';objects.set(wrongKey,{...validObject,customMetadata:{...validObject.customMetadata,ownerUserId:String(otherId),connectionId:'33333333-3333-4333-8333-333333333333'}});sqlite.prepare('UPDATE tiktok_connections SET avatar_object_key=? WHERE id=?').run(wrongKey,connectionId);for(const [handler,method] of [[avatarGet,'GET'],[avatarHead,'HEAD']]){response=await handler(ctx('boss',method));assert.equal(response.status,404,`${method} rejects a cross-owner object key`);if(method==='HEAD')assert.equal((await response.arrayBuffer()).byteLength,0)}sqlite.prepare('UPDATE tiktok_connections SET avatar_object_key=? WHERE id=?').run(knownKey,connectionId);
sqlite.prepare('UPDATE tiktok_channels SET archived_at=CURRENT_TIMESTAMP WHERE id=?').run(channelId);response=await avatarGet(ctx('boss'));assert.equal(response.status,404,'archived owner channel stops serving its mirror immediately');

sqlite.close();
console.log('PASS v0.20.117 bounded/abort-safe TikTok avatar mirror, same-digest/CAS/race preservation, strict R2 metadata binding, no secret projection, and Boss/Testervx/non-owner authenticated media matrix');
