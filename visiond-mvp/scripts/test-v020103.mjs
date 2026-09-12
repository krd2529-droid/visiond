import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {onRequestGet,partnerCommissionRange} from '../functions/api/admin/tiktok-partner-commissions.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const route=read('functions/api/admin/tiktok-partner-commissions.js'),client=read('public/tiktok-analyzer.js'),html=read('public/tiktok-analyzer.html');
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
CREATE TABLE tiktok_channels(id TEXT PRIMARY KEY,name TEXT,created_by INTEGER,archived_at TEXT);
CREATE TABLE tiktok_shop_creator_connections(id TEXT PRIMARY KEY,user_id INTEGER,channel_id TEXT,scopes TEXT,status TEXT,creator_username TEXT,last_synced_at TEXT,updated_at TEXT);
CREATE TABLE tiktok_shop_affiliate_orders(connection_id TEXT,order_id TEXT,create_time INTEGER,status TEXT,commission_json TEXT,synced_at TEXT,PRIMARY KEY(connection_id,order_id));
CREATE TABLE tiktok_shop_order_coverage(connection_id TEXT,date_from TEXT,date_to TEXT,status TEXT,page_token TEXT,request_id TEXT,lease_id TEXT,lease_until INTEGER,pages INTEGER,synced_at TEXT,error_code TEXT,PRIMARY KEY(connection_id,date_from,date_to));
CREATE INDEX idx_tiktok_shop_orders_time ON tiktok_shop_affiliate_orders(connection_id,create_time DESC);
INSERT INTO users VALUES(1,'boss@example.invalid','boss','Boss','','boss',CURRENT_TIMESTAMP),(2,'admin@example.invalid','admin','Admin','','admin',CURRENT_TIMESTAMP),(3,'user@example.invalid','user','User','','user',CURRENT_TIMESTAMP);
INSERT INTO sessions VALUES('boss-session',1,datetime('now','+1 day')),('admin-session',2,datetime('now','+1 day')),('user-session',3,datetime('now','+1 day'));
INSERT INTO tiktok_channels VALUES('owned','Owned',1,NULL),('foreign','Foreign',3,NULL),('archived','Archived',1,CURRENT_TIMESTAMP);
INSERT INTO tiktok_shop_creator_connections VALUES('shop-owned',1,'owned','creator.affiliate_collaboration.read','active','owned','2026-09-10T10:00:00Z','2026-09-10T10:00:00Z'),('shop-foreign',3,'foreign','creator.affiliate_collaboration.read','active','foreign','2026-09-10T10:00:00Z','2026-09-10T10:00:00Z'),('shop-archived',1,'archived','creator.affiliate_collaboration.read','active','archived','2026-09-10T10:00:00Z','2026-09-10T10:00:00Z');`);
const sqlLog=[];
function prepared(sql,args=[]){return{bind(...next){return prepared(sql,next)},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}}}}
const env={DB:{prepare(sql){sqlLog.push(sql);return prepared(sql)}}};
const today=new Date(Date.now()+25200000).toISOString().slice(0,10),to=new Date(Date.parse(`${today}T00:00:00Z`)-86400000).toISOString().slice(0,10),from=new Date(Date.parse(`${to}T00:00:00Z`)-29*86400000).toISOString().slice(0,10),range=partnerCommissionRange(new URL(`https://fixture.invalid/?from=${from}&to=${to}`));
const request=(session='boss-session',channel='owned',query=`from=${from}&to=${to}`)=>({env,request:new Request(`https://fixture.invalid/api/admin/tiktok-partner-commissions?channel_id=${channel}&${query}`,{headers:session?{cookie:`vd_session=${session}`}:{}})});

for(const [session,status] of [['',401],['admin-session',403],['user-session',403]]){
  sqlLog.length=0;const response=await onRequestGet(request(session));assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(sqlLog.some(sql=>sql.includes('tiktok_')),false,'non-Boss must perform zero channel/commission work');
}
assert.equal((await onRequestGet(request('boss-session','foreign'))).status,404);
assert.equal((await onRequestGet(request('boss-session','archived'))).status,404);
assert.equal((await onRequestGet(request('boss-session','owned','from=2026-01-01&to=2026-05-01'))).status,400);

db.prepare("UPDATE tiktok_shop_creator_connections SET scopes='' WHERE id='shop-owned'").run();sqlLog.length=0;
let response=await onRequestGet(request()),body=await response.json();assert.equal(response.status,200);assert.equal(body.status,'missing_scope');assert.equal(sqlLog.filter(sql=>sql.includes('tiktok_shop_affiliate_orders')).length,1,'fixed second aggregate read must exclude missing-scope connection rows');
db.prepare("UPDATE tiktok_shop_creator_connections SET scopes='creator.affiliate_collaboration.read' WHERE id='shop-owned'").run();

const insert=db.prepare('INSERT INTO tiktok_shop_affiliate_orders VALUES(?,?,?,?,?,?)'),at=range.fromEpoch+100;
db.prepare("INSERT INTO tiktok_shop_order_coverage VALUES('shop-owned',?,?,'complete','','','',0,2,'2026-09-10T11:00:00Z','')").run(from,to);
for(const row of [
  ['actual',at,'SETTLED',{amount:'12.34',currency:'THB',_visiond_basis:'actual'}],
  ['estimated',at+1,'TO-SETTLE',{amount:'8.50',currency:'THB',_visiond_basis:'estimated'}],
  ['unknown',at+2,'PAID',{amount:'3',currency:'USD',_visiond_basis:'other'}],
  ['localized',at+3,'SETTLED',{amount:'Rp1.900',currency:'IDR',_visiond_basis:'actual'}],
  ['zero',at+4,'SETTLED',{amount:'0.00',currency:'THB',_visiond_basis:'actual'}],
  ['refunded',at+5,'REFUNDED',{amount:'999',currency:'THB',_visiond_basis:'actual'}],
  ['outside',range.toExclusive+1,'SETTLED',{amount:'777',currency:'THB',_visiond_basis:'actual'}],
])insert.run('shop-owned',row[0],row[1],row[2],JSON.stringify(row[3]),'2026-09-10T11:00:00Z');
sqlLog.length=0;response=await onRequestGet(request());body=await response.json();
assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(body.status,'ready');
assert.deepEqual(body.totals,[{basis:'actual',currency:'THB',amount:12.34,orders:1},{basis:'estimated',currency:'THB',amount:8.5,orders:1},{basis:'unknown',currency:'USD',amount:3,orders:1}]);
assert.deepEqual({...body.coverage,last_synced_at:undefined},{orders:5,valued_orders:3,unavailable_orders:2,last_synced_at:undefined});
assert.equal(body.sync.status,'complete');assert.equal(body.sync.synced_at,'2026-09-10T11:00:00Z');assert.equal(JSON.stringify(body).includes('Rp1.900'),false);assert.equal(JSON.stringify(body).includes('raw_json'),false);assert.equal(body.source.endpoint,'POST /affiliate_creator/202410/orders/search');
const aggregateSql=sqlLog.find(sql=>sql.includes('tiktok_shop_affiliate_orders'));assert.ok(aggregateSql);assert.match(aggregateSql,/o\.connection_id IN \(\?\) AND o\.create_time>=\? AND o\.create_time<\?/);
assert.match(db.prepare('EXPLAIN QUERY PLAN '+aggregateSql).all('shop-owned',range.fromEpoch,range.toExclusive).map(row=>row.detail).join(' '),/idx_tiktok_shop_orders_time/);
for(const forbidden of ['tiktok_commission_center_snapshots','_tiktok_commission','collector','referral','fetch('])assert.equal(route.includes(forbidden),false,forbidden);

assert.match(client,/const COMMISSION_WORKSPACE_ENABLED = false/);assert.doesNotMatch(html,/ดูค่าคอม \(Boss Test\)/);assert.equal((client.match(/\/api\/admin\/tiktok-partner-commissions/g)||[]).length,1,'experiment endpoint must have one explicit client call site');assert.match(client,/pageViewerRole=String\(authPayload\?\.user\?\.role/);assert.match(client,/pageAuthorized=true;enableBossPartnerCommissionTest\(\)/);
assert.match(client,/channels"\)\.addEventListener\("click",[\s\S]*?setChannelView\("products"\)/,'channel change still returns to products');
assert.match(client,/if\(mode!=="showcase"\)invalidatePartnerCommissionCache\(context\.channelId\)/,'order sync must target commission invalidation from the selected channel');
assert.match(client,/if\(current\(\)\)\{invalidatePartnerCommissionCache\(context\.channelId\);await loadTikTokConnection/,'paged order sync completion must invalidate the selected channel commission cache');

const enableSource=client.slice(client.indexOf('function enableBossPartnerCommissionTest'),client.indexOf('function invalidatePartnerCommissionCache'));
for(const role of ['boss','admin','user','reviewer','']){let inserted='',existing=false;const nav={querySelector:()=>existing?{}:null,insertAdjacentHTML:(_where,value)=>{inserted+=value;existing=true}};const context={pageViewerRole:role,$:()=>nav};vm.createContext(context);vm.runInContext(`${enableSource};this.enable=enableBossPartnerCommissionTest;`,context);assert.equal(context.enable(),role==='boss');assert.equal(context.enable(),false);assert.equal(inserted.includes('ดูค่าคอม (Boss Test)'),role==='boss')}

const loadSource=client.slice(client.indexOf('async function loadBossPartnerCommission'),client.indexOf('$("#shopCommissionDashboard")?.addEventListener'));
assert.match(loadSource,/partnerCommissionRequests\.get\(key\)/,'same-key in-flight dedupe remains');
assert.match(loadSource,/PARTNER_COMMISSION_TTL_MS/,'short TTL cache remains');
assert.match(loadSource,/isBossPartnerCommissionView\(\)/,'Boss/auth/view stale guard remains');
assert.match(client,/function isBossPartnerCommissionView\(\)\{return pageAuthorized&&pageViewerRole==="boss"/,'active Partner view remains exact-auth Boss-only');
assert.match(loadSource,/channelOwnership\.current\(context\)/,'selected-channel generation guard remains');
assert.match(loadSource,/\/api\/admin\/tiktok-partner-commissions/,'dedicated Partner endpoint remains');

assert.equal(read('VERSION.txt').trim(),'v0.20.107');assert.match(html,/v0\.20\.107/);assert.match(html,/tiktok-analyzer\.js\?v=02163/);
console.log('PASS v103 compatibility: Boss-only Partner source isolation, role/owner/range/index and truthful amount states');
