import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import {onRequestGet,partnerCommissionRange,discoverPartnerCommissionConnections,aggregatePartnerCommissions} from '../functions/api/admin/tiktok-partner-commissions.js';
import {validateOrderRange} from '../functions/_tiktok_order_sync.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const route=read('functions/api/admin/tiktok-partner-commissions.js'),client=read('public/tiktok-analyzer.js'),html=read('public/tiktok-analyzer.html'),css=read('public/tiktok-analyzer.css');
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
CREATE TABLE tiktok_channels(id TEXT PRIMARY KEY,name TEXT,created_by INTEGER,archived_at TEXT);
CREATE TABLE tiktok_shop_creator_connections(id TEXT PRIMARY KEY,user_id INTEGER,channel_id TEXT,open_id TEXT,scopes TEXT,status TEXT,creator_username TEXT,updated_at TEXT,UNIQUE(user_id,open_id));
CREATE TABLE tiktok_shop_affiliate_orders(connection_id TEXT,order_id TEXT,create_time INTEGER,status TEXT,commission_json TEXT,synced_at TEXT,PRIMARY KEY(connection_id,order_id));
CREATE TABLE tiktok_shop_order_coverage(connection_id TEXT,date_from TEXT,date_to TEXT,status TEXT,page_token TEXT,request_id TEXT,lease_id TEXT,lease_until INTEGER,pages INTEGER,synced_at TEXT,error_code TEXT,PRIMARY KEY(connection_id,date_from,date_to));
CREATE INDEX idx_tiktok_shop_orders_time ON tiktok_shop_affiliate_orders(connection_id,create_time DESC);
INSERT INTO users VALUES(1,'boss@example.invalid','boss','Boss','','boss',CURRENT_TIMESTAMP),(2,'admin@example.invalid','admin','Admin','','admin',CURRENT_TIMESTAMP),(3,'foreign@example.invalid','foreign','Foreign','','user',CURRENT_TIMESTAMP);
INSERT INTO sessions VALUES('boss-session',1,datetime('now','+1 day')),('admin-session',2,datetime('now','+1 day'));
INSERT INTO tiktok_channels VALUES('a','Alpha',1,NULL),('b','Beta',1,NULL),('c','Gamma',1,NULL),('archived','Archived',1,CURRENT_TIMESTAMP),('foreign','Foreign',3,NULL);
INSERT INTO tiktok_shop_creator_connections VALUES
 ('a-old',1,'a','open-a-old','creator.affiliate_collaboration.read','active','alpha-old','2026-08-01'),
 ('a-new',1,'a','open-a-new','creator.affiliate_collaboration.read','active','alpha','2026-09-10'),
 ('b-new',1,'b','open-b','creator.affiliate_collaboration.read','active','beta','2026-09-10'),
 ('c-new',1,'c','open-c','','active','gamma','2026-09-10'),
 ('archived-new',1,'archived','open-archived','creator.affiliate_collaboration.read','active','archived','2026-09-10'),
 ('foreign-new',3,'foreign','open-foreign','creator.affiliate_collaboration.read','active','foreign','2026-09-10');`);
const sqlLog=[];
function prepared(sql,args=[]){return{bind(...next){return prepared(sql,next)},async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}}}}
const env={DB:{prepare(sql){sqlLog.push(sql);return prepared(sql)}}};
const fixedNow=Date.parse('2026-09-11T05:00:00Z'),range=partnerCommissionRange(new URL('https://fixture.invalid/?from=2026-08-01&to=2026-08-31'),fixedNow);
assert.equal(validateOrderRange(range,fixedNow),true);
assert.throws(()=>partnerCommissionRange(new URL('https://fixture.invalid/?from=2020-01-01&to=2020-01-31'),fixedNow),/INVALID_RANGE/);
const request=(session='boss-session',query='scope=all&from=2026-08-01&to=2026-08-31')=>({env,request:new Request(`https://fixture.invalid/api/admin/tiktok-partner-commissions?${query}`,{headers:session?{cookie:`vd_session=${session}`}:{}})});

for(const [session,status] of [['',401],['admin-session',403]]){sqlLog.length=0;const response=await onRequestGet(request(session));assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(sqlLog.some(sql=>sql.includes('tiktok_')),false)}
assert.equal((await onRequestGet(request('boss-session','scope=wrong&from=2026-08-01&to=2026-08-31'))).status,400);
assert.equal((await onRequestGet(request('boss-session','scope=selected&from=2026-08-01&to=2026-08-31'))).status,400);
assert.equal((await onRequestGet(request('boss-session','scope=selected&channel_id=foreign&from=2026-08-01&to=2026-08-31'))).status,404);

for(const [id,status,pages] of [['a-new','complete',2],['b-new','partial',1],['c-new','complete',1]])db.prepare('INSERT INTO tiktok_shop_order_coverage VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,range.from,range.to,status,'','','',0,pages,'2026-09-10T11:00:00Z','');
const insert=db.prepare('INSERT INTO tiktok_shop_affiliate_orders VALUES(?,?,?,?,?,?)'),at=range.fromEpoch+100;
for(const row of [
  ['a-new','a-actual',at,'SETTLED',{amount:'12.34',currency:'THB',_visiond_basis:'actual'}],
  ['a-new','a-unknown',at+1,'PAID',{amount:'3',currency:'USD',_visiond_basis:'other'}],
  ['a-new','a-localized',at+2,'SETTLED',{amount:'Rp1.900',currency:'IDR',_visiond_basis:'actual'}],
  ['a-old','old-excluded',at+3,'SETTLED',{amount:'700',currency:'THB',_visiond_basis:'actual'}],
  ['b-new','b-estimated',at+4,'TO-SETTLE',{amount:'8.50',currency:'THB',_visiond_basis:'estimated'}],
  ['c-new','scope-excluded',at+5,'SETTLED',{amount:'999',currency:'THB',_visiond_basis:'actual'}],
  ['foreign-new','foreign-excluded',at+6,'SETTLED',{amount:'888',currency:'THB',_visiond_basis:'actual'}]
])insert.run(...row.slice(0,4),JSON.stringify(row[4]),'2026-09-10T11:00:00Z');

sqlLog.length=0;let response=await onRequestGet(request()),body=await response.json();
assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(body.scope,'all');assert.equal(body.status,'partial');assert.equal(body.complete,false);assert.equal(body.channels.length,3);
assert.deepEqual(body.totals,[{basis:'actual',currency:'THB',amount:12.34,orders:1},{basis:'estimated',currency:'THB',amount:8.5,orders:1},{basis:'unknown',currency:'USD',amount:3,orders:1}]);
assert.deepEqual(body.incomplete_channels.map(row=>[row.channel_id,row.status]),[['b','no_exact_sync'],['c','missing_scope']]);
assert.equal(body.channels.find(row=>row.channel_id==='a').coverage.unavailable_orders,1);assert.equal(JSON.stringify(body).includes('Rp1.900'),false);assert.equal(JSON.stringify(body).includes('999'),false);assert.equal(JSON.stringify(body).includes('888'),false);
const tiktokReads=sqlLog.filter(sql=>sql.includes('tiktok_'));assert.equal(tiktokReads.length,2,'a valid commission request performs exactly two set-based TikTok reads');
const [discoverySql,aggregateSql]=tiktokReads;assert.match(discoverySql,/ROW_NUMBER\(\) OVER \(PARTITION BY sc\.channel_id/);assert.match(discoverySql,/LIMIT 25/);assert.match(discoverySql,/LEFT JOIN tiktok_shop_order_coverage/);
assert.match(aggregateSql,/o\.connection_id IN \(/);assert.match(aggregateSql,/o\.create_time>=\? AND o\.create_time<\?/);assert.match(aggregateSql,/GROUP BY o\.connection_id,basis,currency/);
const discoveryPlan=db.prepare('EXPLAIN QUERY PLAN '+discoverySql).all(1,range.from,range.to).map(row=>row.detail).join(' ');
assert.match(discoveryPlan,/sqlite_autoindex_tiktok_shop_creator_connections_2|SEARCH sc/);assert.match(discoveryPlan,/sqlite_autoindex_tiktok_shop_order_coverage_1/);
const discovered=await discoverPartnerCommissionConnections(env,1,'all','',range),aggregate=await aggregatePartnerCommissions(env,discovered.rows,range);
const aggregatePlan=db.prepare('EXPLAIN QUERY PLAN '+aggregate.sql).all(...discovered.rows.filter(row=>String(row.scopes).includes('creator.affiliate_collaboration.read')).map(row=>row.connection_id),range.fromEpoch,range.toExclusive).map(row=>row.detail).join(' ');
assert.match(aggregatePlan,/idx_tiktok_shop_orders_time/);

sqlLog.length=0;response=await onRequestGet(request('boss-session','scope=selected&channel_id=a&from=2026-08-01&to=2026-08-31'));body=await response.json();
assert.equal(response.status,200);assert.equal(body.scope,'selected');assert.equal(body.status,'ready');assert.equal(body.complete,true);assert.equal(body.channels.length,1);assert.equal(sqlLog.filter(sql=>sql.includes('tiktok_')).length,2);
sqlLog.length=0;response=await onRequestGet(request('boss-session','scope=selected&channel_id=c&from=2026-08-01&to=2026-08-31'));body=await response.json();
assert.equal(body.status,'missing_scope');assert.equal(body.totals.length,0);assert.equal(sqlLog.filter(sql=>sql.includes('tiktok_')).length,2);

db.exec(`DELETE FROM tiktok_shop_creator_connections WHERE user_id=1;
DELETE FROM tiktok_channels WHERE created_by=1;`);
const addChannel=db.prepare('INSERT INTO tiktok_channels VALUES(?,?,1,NULL)'),addConnection=db.prepare("INSERT INTO tiktok_shop_creator_connections VALUES(?,1,?,?,?,'active','',?)");
for(let index=1;index<=25;index++){const id=`many-${String(index).padStart(2,'0')}`;addChannel.run(id,id);addConnection.run(`connection-${id}`,id,`open-${id}`,'creator.affiliate_collaboration.read',`2026-09-${String(index).padStart(2,'0')}`)}
sqlLog.length=0;response=await onRequestGet(request());body=await response.json();assert.equal(response.status,409);assert.equal(body.code,'CHANNEL_SCOPE_TOO_LARGE');assert.equal(sqlLog.filter(sql=>sql.includes('tiktok_')).length,1,'sentinel overflow stops before aggregation');

for(const forbidden of ['tiktok_commission_center_snapshots','_tiktok_commission','collector','referral','fetch(','raw_json','access_token','refresh_token'])assert.equal(route.includes(forbidden),false,forbidden);
assert.match(route,/validateOrderRange\(range,now\)/);assert.match(client,/const COMMISSION_WORKSPACE_ENABLED = false/);assert.doesNotMatch(html,/ดูค่าคอม \(Boss Test\)/);

const helperSource=client.slice(client.indexOf('const validCommissionDay'),client.indexOf('const savedUiValue'));
const helperContext={Date};vm.createContext(helperContext);vm.runInContext(`const shiftThaiDate=(date,days)=>{const [y,m,d]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1,d)+days*864e5).toISOString().slice(0,10)};${helperSource};this.defaults=partnerCommissionDefaults;this.resolve=resolvePartnerCommissionRange;`,helperContext);
assert.deepEqual({...helperContext.defaults(fixedNow)},{scope:'selected',mode:'month',month:'2026-08',day:'2026-09-10',from:'2026-08-01',to:'2026-08-31',latestDate:'2026-09-10',oldestDate:'2026-06-13'});
assert.deepEqual({...helperContext.resolve({scope:'all',mode:'month',month:'2026-08'},fixedNow)},{ok:true,scope:'all',mode:'month',from:'2026-08-01',to:'2026-08-31'});
assert.equal(helperContext.resolve({mode:'month',month:'2026-09'},fixedNow).ok,false);assert.equal(helperContext.resolve({mode:'day',day:'2026-09-10'},fixedNow).ok,true);assert.equal(helperContext.resolve({mode:'day',day:'2026-09-11'},fixedNow).ok,false);
assert.equal(helperContext.resolve({mode:'range',from:'2026-06-13',to:'2026-09-10'},fixedNow).ok,true);assert.equal(helperContext.resolve({mode:'range',from:'2026-06-12',to:'2026-09-10'},fixedNow).ok,false);assert.equal(helperContext.resolve({mode:'range',from:'2026-08-10',to:'2026-08-01'},fixedNow).ok,false);

const controlSource=client.slice(client.indexOf('function partnerCommissionControls'),client.indexOf('function syncPartnerCommissionFields'));
const controlContext={partnerCommissionDefaults:()=>helperContext.defaults(fixedNow),partnerCommissionUi:helperContext.defaults(fixedNow),escapeHtml:value=>String(value)};vm.createContext(controlContext);vm.runInContext(`${controlSource};this.controls=partnerCommissionControls;`,controlContext);
const controls=controlContext.controls();for(const label of ['ช่องที่เลือก','รวมทุกช่อง','รายเดือน','วันเดียว','ช่วงวัน','ดูยอด'])assert.ok(controls.includes(label),label);assert.equal((controls.match(/ดูยอด/g)||[]).length,1);assert.match(controls,/value="selected" checked/);assert.match(controls,/value="month" checked/);assert.match(controls,/type="month"[^>]+max="2026-08"/);
assert.match(client,/input\.disabled=inactive/,'inactive required date inputs must not block active-mode submit');
const openSource=client.slice(client.indexOf('function openBossPartnerCommission'),client.indexOf('const commissionTotalsHtml'));assert.doesNotMatch(openSource,/\bapi\s*\(/,'opening the Boss view is request-free');
assert.match(client,/button\.dataset\.channelView === "partner-commission"\) openBossPartnerCommission\(\)/);

const handoffSource=client.slice(client.indexOf('function handoffPartnerCommissionRange'),client.indexOf('async function loadBossPartnerCommission'));
const soldFrom={value:''},soldTo={value:''},handoffContext={state:{shopDateFrom:'',shopDateTo:''},$:()=>({querySelector:selector=>selector.includes('date_from')?soldFrom:soldTo})};vm.createContext(handoffContext);vm.runInContext(`${handoffSource};this.handoff=handoffPartnerCommissionRange;`,handoffContext);handoffContext.handoff({from:'2026-08-01',to:'2026-08-31'});assert.deepEqual(handoffContext.state,{shopDateFrom:'2026-08-01',shopDateTo:'2026-08-31'});assert.equal(soldFrom.value,'2026-08-01');assert.equal(soldTo.value,'2026-08-31');

const invalidateSource=client.slice(client.indexOf('function invalidatePartnerCommissionCache'),client.indexOf('function partnerCommissionControls'));
const loadSource=client.slice(client.indexOf('async function loadBossPartnerCommission'),client.indexOf('$("#shopCommissionDashboard")?.addEventListener'));
let selected='a',generation=1,apiCalls=0,rendered=0,release,urls=[];
const results={innerHTML:''},button={disabled:false},clientContext={pageViewerRole:'boss',pageViewerId:'1',pageAuthorized:true,state:{shopDateFrom:'2026-08-01',shopDateTo:'2026-08-31'},partnerCommissionUi:{scope:'selected',mode:'month',generation:1},partnerCommissionRequests:new Map(),partnerCommissionCache:new Map(),partnerCommissionRevisions:new Map(),PARTNER_COMMISSION_TTL_MS:30000,channelOwnership:{capture:()=>({channelId:selected,generation}),current:value=>value.channelId===selected&&value.generation===generation},isBossPartnerCommissionView:()=>true,document:{body:{classList:{contains:()=>true}}},URLSearchParams,Date,$:selector=>selector==='#partnerCommissionResults'?results:null,api:url=>{apiCalls++;urls.push(url);return new Promise(resolve=>{release=resolve})},renderBossPartnerCommission:()=>{rendered++},showToast:()=>{}};
vm.createContext(clientContext);vm.runInContext(`${invalidateSource};${loadSource};this.invalidate=invalidatePartnerCommissionCache;this.load=loadBossPartnerCommission;`,clientContext);
assert.match(loadSource,/key=JSON\.stringify\(\[owner,query\.scope,query\.scope==='selected'\?context\.channelId:'',query\.from,query\.to,revision\]\)/,'cache identity excludes presentation mode but includes owner/scope/range/revision');
assert.equal(apiCalls,0);const selectedQuery={ok:true,scope:'selected',mode:'month',from:'2026-08-01',to:'2026-08-31',generation:1},first=clientContext.load(button,selectedQuery),duplicate=clientContext.load(button,selectedQuery);assert.equal(apiCalls,1);release({});await Promise.all([first,duplicate]);assert.equal(rendered,2);await clientContext.load(button,selectedQuery);assert.equal(apiCalls,1);assert.equal(rendered,3);
clientContext.partnerCommissionUi={scope:'all',mode:'month',generation:2};const allQuery={...selectedQuery,scope:'all',generation:2};let allRelease;clientContext.api=url=>{apiCalls++;urls.push(url);return new Promise(resolve=>{allRelease=resolve})};const all=clientContext.load(button,allQuery);assert.equal(apiCalls,2);assert.match(urls.at(-1),/scope=all/);assert.doesNotMatch(urls.at(-1),/channel_id=/);allRelease({});await all;assert.equal(rendered,4);
selected='b';generation=2;clientContext.partnerCommissionUi={scope:'selected',mode:'month',generation:3};clientContext.state.shopDateFrom=selectedQuery.from;clientContext.state.shopDateTo=selectedQuery.to;const bQuery={...selectedQuery,generation:3};clientContext.api=url=>{apiCalls++;urls.push(url);return Promise.resolve({})};await clientContext.load(button,bQuery);assert.equal(apiCalls,3);assert.equal(rendered,5);
clientContext.partnerCommissionCache.set('foreign-owner',{owner:'2',scope:'all',channelId:'',expires:Date.now()+30000,data:{}});clientContext.invalidate('a');assert.equal([...clientContext.partnerCommissionCache.values()].some(item=>item.channelId==='b'),true);assert.equal([...clientContext.partnerCommissionCache.values()].some(item=>item.owner==='1'&&item.scope==='all'),false);assert.equal(clientContext.partnerCommissionCache.has('foreign-owner'),true,'other owner cache survives selected A invalidation');
await clientContext.load(button,bQuery);assert.equal(apiCalls,3,'selected B cache survives selected A invalidation');
const renderedBeforeStale=rendered;selected='a';generation=3;clientContext.partnerCommissionUi={scope:'selected',mode:'day',generation:4};clientContext.state.shopDateFrom='2026-09-10';clientContext.state.shopDateTo='2026-09-10';let staleRelease;clientContext.api=url=>{apiCalls++;urls.push(url);return new Promise(resolve=>{staleRelease=resolve})};const staleQuery={ok:true,scope:'selected',mode:'day',from:'2026-09-10',to:'2026-09-10',generation:4},stale=clientContext.load(button,staleQuery);clientContext.partnerCommissionUi={scope:'selected',mode:'range',generation:5};staleRelease({});await stale;assert.equal(rendered,renderedBeforeStale,'late response after mode/generation change cannot publish');

for(const token of ['.partner-commission-form{','.partner-commission-range{','@media(max-width:650px)'])assert.ok(css.includes(token),token);
assert.equal(read('VERSION.txt').trim(),'v0.20.111');assert.match(html,/v0\.20\.111/);assert.match(html,/tiktok-analyzer\.js\?v=02163/);assert.match(html,/tiktok-analyzer\.css\?v=02102/);
console.log('PASS v104 Boss month/day/range selected/all Partner commission controller, set-based indexed reads, truthful channel status, cache invalidation and stale/date handoff');
