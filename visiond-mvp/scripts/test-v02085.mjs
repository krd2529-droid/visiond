import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {ORDER_SCHEMA,ORDER_SCOPE,orderCoverage,syncOrderPage as actualSyncOrderPage,validateOrderRange} from '../functions/_tiktok_order_sync.js';
import {encryptChannelValue} from '../functions/_channel_crypto.js';
import {dateRange} from '../functions/api/admin/tiktok-connections/index.js';
const db=new DatabaseSync(':memory:');
db.exec(ORDER_SCHEMA);db.exec(`CREATE TABLE tiktok_shop_creator_connections(id TEXT PRIMARY KEY,user_id INTEGER,channel_id TEXT,status TEXT,scopes TEXT);
CREATE TABLE tiktok_shop_affiliate_orders(connection_id TEXT,order_id TEXT,create_time INTEGER,product_ids TEXT,status TEXT,gmv_json TEXT,commission_json TEXT,raw_json TEXT,synced_at TEXT,PRIMARY KEY(connection_id,order_id));
CREATE INDEX idx_tiktok_shop_orders_time ON tiktok_shop_affiliate_orders(connection_id,create_time DESC);`);
function prepared(sql,args=[]){return{bind(...next){return prepared(sql,next)},async run(){return{meta:{changes:db.prepare(sql).run(...args).changes}}},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}},sql,args}}
const env={VISIOND_CHANNEL_ENCRYPTION_KEY:'test-only-key-not-a-secret-value-1234567890',TIKTOK_SHOP_APP_KEY:'fixture',TIKTOK_SHOP_APP_SECRET:'fixture',DB:{prepare:prepared,async batch(stmts){db.exec('BEGIN');try{const result=[];for(const s of stmts)result.push(await s.run());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}}};
const c={id:'creator-1',user_id:1,channel_id:'channel-a',status:'active',scopes:ORDER_SCOPE,access_expires_at:new Date(Date.now()+86400000).toISOString(),access_token_ciphertext:await encryptChannelValue(env,'fixture-only')};
db.prepare('INSERT INTO tiktok_shop_creator_connections VALUES(?,?,?,?,?)').run(c.id,c.user_id,c.channel_id,c.status,c.scopes);
const today=new Date(Date.now()+25200000).toISOString().slice(0,10),yesterday=new Date(Date.parse(today)-86400000).toISOString().slice(0,10);
const range=dateRange(new URL('https://fixture.invalid/?date_from='+yesterday+'&date_to='+yesterday));
async function syncOrderPage(env,c,range,id,options){const state=await orderCoverage(env,c,range);return actualSyncOrderPage(env,c,range,id,{expectedRevision:state.revision||0,...options})}
assert.equal(range.toExclusive-range.fromEpoch,86400);assert.equal(validateOrderRange(range),true);assert.equal(validateOrderRange({...range,fromEpoch:0}),false);
assert.equal((await orderCoverage(env,c,range)).status,'never');assert.equal((await orderCoverage(env,{...c,scopes:''},range)).status,'missing_scope');
let calls=0,hold;
const response=(data)=>new Response(JSON.stringify({code:0,data}),{status:200});
const fetchImpl=async(url,options)=>{calls++;assert.equal(new URL(url).searchParams.get('page_size'),'24');assert.deepEqual(JSON.parse(options.body),{create_time_ge:range.fromEpoch,create_time_lt:range.toExclusive});return response({orders:[{id:'order-1',create_time:range.fromEpoch+1,skus:[{product_id:'p1',product_name:'Fixture',quantity:2,actual_paid_commission:{amount:'12',currency:'THB'}}]}],next_page_token:'page2'})};
const id=crypto.randomUUID();assert.equal((await syncOrderPage(env,c,range,id,{fetchImpl})).status,'partial');
assert.equal((await syncOrderPage(env,c,range,id,{fetchImpl})).status,'partial');assert.equal(calls,1,'response replay does not fetch again');
assert.equal((await actualSyncOrderPage(env,c,range,crypto.randomUUID(),{expectedRevision:0,fetchImpl})).status,'partial');assert.equal(calls,1,'delayed earlier revision cannot dispatch provider again');
assert.equal(db.prepare('SELECT count(*) n FROM tiktok_shop_affiliate_orders').get().n,1);
assert.equal(db.prepare('SELECT product_ids FROM tiktok_shop_affiliate_orders').get().product_ids,'["p1"]');assert.equal(JSON.parse(db.prepare('SELECT commission_json FROM tiktok_shop_affiliate_orders').get().commission_json).amount,'12.00');
assert.equal((await syncOrderPage(env,c,range,crypto.randomUUID(),{fetchImpl:async url=>{assert.equal(new URL(url).searchParams.get('page_token'),'page2');return response({orders:[]})}})).status,'complete');
const blocked=syncOrderPage(env,c,range,crypto.randomUUID(),{fetchImpl:async()=>new Promise(r=>hold=r)});while(!hold)await new Promise(r=>setImmediate(r));
assert.equal((await syncOrderPage(env,c,range,crypto.randomUUID(),{fetchImpl})).status,'running');
hold(response({orders:[]}));assert.equal((await blocked).status,'complete');
const failed=await syncOrderPage(env,c,range,crypto.randomUUID(),{fetchImpl:async()=>{throw new Error('synthetic provider failure')}});assert.equal(failed.status,'failed');assert.equal(db.prepare('SELECT count(*) n FROM tiktok_shop_affiliate_orders').get().n,1,'failed retry preserves orders');
db.exec("CREATE TRIGGER fail_fixture_order BEFORE INSERT ON tiktok_shop_affiliate_orders WHEN NEW.order_id='reject-write' BEGIN SELECT RAISE(ABORT,'fixture_write_failure'); END");
assert.equal((await syncOrderPage(env,c,range,crypto.randomUUID(),{fetchImpl:async()=>response({orders:[{id:'reject-write',create_time:range.fromEpoch+1}]})})).status,'failed');assert.notEqual((await orderCoverage(env,c,range)).status,'complete','failed durable write cannot commit complete coverage');
const originalBatch=env.DB.batch;
env.DB.batch=async statements=>{db.exec('DELETE FROM tiktok_shop_order_coverage; DELETE FROM tiktok_shop_creator_connections');return originalBatch(statements)};
const deleted=await syncOrderPage(env,c,range,crypto.randomUUID(),{fetchImpl:async()=>response({orders:[{id:'orphan-after-delete',create_time:range.fromEpoch+1}]})});
assert.equal(deleted.status,'failed');assert.equal(db.prepare("SELECT count(*) n FROM tiktok_shop_affiliate_orders WHERE order_id='orphan-after-delete'").get().n,0,'missing coverage row aborts entire write batch');assert.equal(db.prepare('SELECT count(*) n FROM tiktok_shop_order_coverage').get().n,0,'guard cannot recreate deleted coverage');assert.equal(db.prepare('SELECT count(*) n FROM tiktok_shop_creator_connections').get().n,0,'deleted connection stays deleted');
env.DB.batch=originalBatch;db.prepare('INSERT INTO tiktok_shop_creator_connections VALUES(?,?,?,?,?)').run(c.id,c.user_id,c.channel_id,c.status,c.scopes);
const revoked=await syncOrderPage(env,c,range,crypto.randomUUID(),{fetchImpl:async()=>{db.prepare("UPDATE tiktok_shop_creator_connections SET status='revoked'").run();return response({orders:[{order_id:'forbidden',create_time:range.fromEpoch+1}]})}});assert.equal(revoked.status,'failed');assert.equal(db.prepare("SELECT count(*) n FROM tiktok_shop_affiliate_orders WHERE order_id='forbidden'").get().n,0,'atomic live guard rolls back orders');
assert.match(db.prepare('EXPLAIN QUERY PLAN SELECT status FROM tiktok_shop_order_coverage WHERE connection_id=? AND date_from=? AND date_to=?').all(c.id,range.from,range.to).map(x=>x.detail).join(' '),/INDEX/);
assert.match(db.prepare('EXPLAIN QUERY PLAN SELECT order_id FROM tiktok_shop_affiliate_orders WHERE connection_id=? AND create_time>=? AND create_time<? ORDER BY create_time DESC LIMIT 24').all(c.id,range.fromEpoch,range.toExclusive).map(x=>x.detail).join(' '),/idx_tiktok_shop_orders_time/);
const src=readFileSync('public/tiktok-analyzer.js','utf8'),extract=(a,b)=>src.slice(src.indexOf(a),src.indexOf(b,src.indexOf(a)));
const ctx=vm.createContext({state:{},escapeHtml:String,displayDate:String,arrayValue:x=>x||[],safeJson:x=>typeof x==='string'?JSON.parse(x):x});vm.runInContext(extract('function soldProductSummaryTable(','function decorateSoldProductSelection('),ctx);
for(const status of ['never','failed','partial','running','missing_scope','provider_not_ready','complete']){
 const html=ctx.shopRangeSummary({date_range:range,commission_availability:{ready:true,latest_date:yesterday},order_sync:{status,can_read_orders:status!=='missing_scope'}},[],[]);
 assert.equal(html.includes('ช่วงวันที่นี้ยังไม่มีสินค้าที่ขายได้'),status==='complete',status+' zero classification');
 assert.equal(html.includes('data-fetch-sold-orders'),false,'v87 uses the single submit for every state');
}
const callsByDate=[];let selectedDate='2026-08-12';
const reads=vm.createContext({pageViewerId:'owner1',shopConnectionRequests:new Map(),shopDateQuery:id=>new URLSearchParams({channel_id:id,date_from:selectedDate,date_to:'2026-09-10'}),api:url=>{callsByDate.push(url);return new Promise(()=>{})}});
vm.runInContext(extract('function fetchTikTokConnectionData(','async function loadTikTokConnection('),reads);
const august=reads.fetchTikTokConnectionData('a');assert.equal(reads.fetchTikTokConnectionData('a'),august);
selectedDate='2026-09-01';assert.notEqual(reads.fetchTikTokConnectionData('a'),august);assert.equal(callsByDate.length,2);
reads.pageViewerId='owner2';reads.fetchTikTokConnectionData('a');assert.equal(callsByDate.length,3,'owner-separated inflight reads');
// The removed two-action client contract is replaced by the actual submit orchestration matrix in test-v02087.mjs.
console.log('PASS v85 actual order page SQL/provider seam, replay/concurrency/rollback/scope/range/index and renderer matrix');
