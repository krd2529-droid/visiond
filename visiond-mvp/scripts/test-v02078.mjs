import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {tikTokOAuthConfig,tikTokAuthorizeUrl,tikTokCapabilities,tikTokVisibleProfile,fetchTikTokProfile,syncTikTokConnection} from '../functions/_tiktok_oauth.js';
import {encryptChannelValue} from '../functions/_channel_crypto.js';
const basic='user.info.basic',full=basic+',user.info.profile,user.info.stats,video.list';
const config=tikTokOAuthConfig({TIKTOK_CLIENT_KEY:'fixture',TIKTOK_CLIENT_SECRET:'fixture'});
assert.deepEqual(config.scopes,[basic,'video.list']);
const url=new URL(tikTokAuthorizeUrl(config,'fixture-state'));
assert.equal(url.searchParams.get('scope'),basic+',video.list');assert.equal(url.searchParams.get('redirect_uri'),'https://visiondonline.com/api/tiktok/callback');assert.equal(url.searchParams.has('client_secret'),false);
assert.deepEqual(tikTokOAuthConfig({TIKTOK_APPROVED_OPTIONAL_SCOPES:'user.info.stats,bogus,user.info.profile,user.info.stats'}).scopes,[basic,'video.list','user.info.stats','user.info.profile']);
for(const scopes of [basic,basic+',video.list',full]){
 let fields='';await fetchTikTokProfile('fixture',async u=>{fields=new URL(u).searchParams.get('fields');return Response.json({data:{user:{open_id:'fixture'}}})},scopes);
 assert.equal(fields.includes('follower_count'),scopes===full);assert.equal(fields.includes('bio_description'),scopes===full);assert.ok(fields.includes('open_id'));
}
await assert.rejects(fetchTikTokProfile('fixture',()=>assert.fail('no call without basic'),''),/BASIC_SCOPE/);
const masked=tikTokVisibleProfile({scopes:basic,follower_count:100,video_count:20,bio:'old'});assert.equal(masked.follower_count,null);assert.equal(masked.bio,null);assert.equal(masked.capabilities.videos,false);
for(const [initial,refreshScope,refresh] of [[basic,undefined,false],[full,undefined,false],[full,basic,true],[full,undefined,true],[full,'',true],[full,'video.list',true],['video.list',undefined,false]]){
 const writes=[],calls=[],env={VISIOND_CHANNEL_ENCRYPTION_KEY:'synthetic-test-key-only-12345678901234567890',DB:{prepare:sql=>({bind:(...args)=>({run:async()=>{writes.push({sql,args})},sql,args})}),batch:async s=>{writes.push(...s)}}};
 const connection={id:'fixture-id',scopes:initial,access_expires_at:new Date(Date.now()+(refresh?-1000:3600000)).toISOString(),access_token_ciphertext:await encryptChannelValue(env,'fake-access'),refresh_token_ciphertext:await encryptChannelValue(env,'fake-refresh')};
 const fake=async (u,o)=>{calls.push(String(u));if(String(u).includes('/oauth/token/'))return Response.json({access_token:'fake-renewed',expires_in:3600,...(refreshScope===undefined?{}:{scope:refreshScope})});if(String(u).includes('/user/info/'))return Response.json({data:{user:{open_id:'fixture-id',display_name:'Fixture'}}});return Response.json({data:{videos:[],has_more:false}})};
 if(!tikTokCapabilities(refreshScope??initial).basic){await assert.rejects(syncTikTokConnection(env,connection,fake),/BASIC_SCOPE/);assert.equal(calls.length,refresh?1:0);assert.equal(connection.scopes,refreshScope??initial);if(refresh){assert.match(writes[0].sql,/scopes=\?/);assert.equal(writes[0].args[2],refreshScope)}const exposed=tikTokVisibleProfile(connection);assert.equal(exposed.status,'reconnect_required');assert.equal(exposed.reconnect_required,true);continue}
 const result=await syncTikTokConnection(env,connection,fake);const effective=refreshScope??initial;
 assert.equal(calls.some(u=>u.includes('/video/list/')),tikTokCapabilities(effective).videos);assert.equal(calls.find(u=>u.includes('/user/info/')).includes('follower_count'),effective===full);assert.deepEqual(result.videos,[]);assert.equal(connection.scopes,effective);
}
const callback=readFileSync('functions/api/tiktok/callback.js','utf8'),api=readFileSync('functions/api/admin/tiktok-connections/index.js','utf8'),client=readFileSync('public/tiktok-analyzer.js','utf8');
assert.match(callback,/fetchTikTokProfile\(token.access_token,fetch,token.scope\)/);assert.match(api,/tikTokCapabilities\(connections\[0\].scopes\).videos/);assert.match(client,/tiktok_connected \?\?/);assert.match(client,/ยังไม่ได้รับสิทธิ์/);
// Execute the actual channel-list SQL and projection, not a substituted query.
const analyzer=readFileSync('functions/api/admin/tiktok-analyzer/index.js','utf8');
const raw=analyzer.match(/`(WITH scoped AS[^`]+)`/)[1],sql=raw.replace('${channelWhere}','');
const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE tiktok_channels(id TEXT PRIMARY KEY,name TEXT,created_by INTEGER,archived_at TEXT,updated_at TEXT);
CREATE TABLE tiktok_connections(id TEXT,user_id INTEGER,channel_id TEXT,status TEXT,updated_at TEXT,scopes TEXT,avatar_url TEXT,follower_count INTEGER,likes_count INTEGER,video_count INTEGER);
CREATE INDEX idx_test_connections ON tiktok_connections(channel_id,user_id,status,updated_at DESC);
CREATE TABLE tiktok_browser_profile_bindings(slot_id TEXT,user_id INTEGER,channel_id TEXT,profile_kind TEXT);
CREATE INDEX idx_test_bindings ON tiktok_browser_profile_bindings(channel_id,user_id);
CREATE TABLE tiktok_analysis_runs(channel_id TEXT,result_json TEXT,created_at TEXT);
CREATE INDEX idx_test_runs ON tiktok_analysis_runs(channel_id,created_at DESC);`);
for(let i=0;i<26;i++)db.prepare('INSERT INTO tiktok_channels VALUES(?,?,1,NULL,?)').run(String(i).padStart(2,'0'),'Fixture','2026-09-10');
db.prepare('INSERT INTO tiktok_connections VALUES(?,1,?,?,?, ?,?,100,20,10)').run('fixture','25','active','2026-09-10',basic,'avatar');
db.prepare('INSERT INTO tiktok_connections VALUES(?,2,?,?,?, ?,?,999,999,999)').run('foreign','24','active','2026-09-10',full,'foreign');
const rows=db.prepare(sql).all(1,25);assert.equal(rows.length,25);assert.equal(rows[0].tiktok_scopes,basic);assert.equal(rows[1].tiktok_scopes,null);
const projection=analyzer.match(/const channelView=row=>([^;]+);/)[1],view=new Function('row','tikTokVisibleProfile','tikTokCapabilities','parse','return '+projection)(rows[0],tikTokVisibleProfile,tikTokCapabilities,JSON.parse);
assert.equal(view.tiktok_connected,true);assert.equal(view.follower_count,null);
for(const scopes of ['', 'video.list','user.info.stats']){
 const row={...rows[0],tiktok_scopes:scopes};const projected=new Function('row','tikTokVisibleProfile','tikTokCapabilities','parse','return '+projection)(row,tikTokVisibleProfile,tikTokCapabilities,JSON.parse);
 assert.equal(projected.tiktok_connected,false);assert.equal(projected.follower_count,null);assert.equal(projected.reconnect_required,true);
 const detailExpression=api.match(/const publicConnection = \(row\) => ([^;]+);/)[1];const detail=new Function('row','tikTokVisibleProfile','return '+detailExpression)({...row,scopes},tikTokVisibleProfile);assert.equal(detail.status,'reconnect_required');assert.equal(detail.avatar_url,null);
}
assert.match(analyzer,/channel.tiktok_connected=tikTokCapabilities\(channel.tiktok_scopes\).basic/);
assert.match(analyzer,/if\(linked&&tikTokCapabilities\(linked.scopes\).basic\)/);
assert.match(client,/if \(!granted.includes\('user.info.basic'\)\)/);
const secondSql=raw.replace('${channelWhere}','WHERE (sort_at<? OR (sort_at=? AND id<?))'),second=db.prepare(secondSql).all(1,'2026-09-10','2026-09-10',rows[23].id,25);
assert.equal(second.length,2);assert.equal(new Set([...rows.slice(0,24),...second].map(r=>r.id)).size,26);
const plan=db.prepare('EXPLAIN QUERY PLAN '+sql).all(1,25).map(r=>r.detail).join('\n');assert.match(plan,/SEARCH t USING INDEX idx_test_connections/);db.close();
console.log('PASS v78 minimal/allowlisted request; actual granted fields; subset/basic-only; full/refresh scope downgrade; unavailable != zero; no stale video read');
