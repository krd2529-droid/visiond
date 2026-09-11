import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const client=read('public/tiktok-analyzer.js'),html=read('public/tiktok-analyzer.html');
const slice=(from,to)=>{const start=client.indexOf(from),end=client.indexOf(to,start);assert.ok(start>=0&&end>start,`${from} source boundary`);return client.slice(start,end)};
const navigationSource=slice('const CHANNEL_ACTION_SESSION_KEY','function enableBossPartnerCommissionTest');
const controllerSource=slice('function partnerCommissionControls','const commissionTotalsHtml');
const dashboardSource=slice('function renderShopDashboard(data, shopConnection)','async function api');
const clearSource=slice('function clearChannelOwnedView','async function refreshOwnedInventory');

assert.match(client,/const COMMISSION_WORKSPACE_ENABLED = false/);
assert.match(client,/await loadChannels\(\);\s*restoreChannelActionView\(\)/,'restore runs only after authenticated channel loading settles');
assert.match(navigationSource,/sessionStorage\.setItem\(CHANNEL_ACTION_SESSION_KEY,JSON\.stringify\(\{ownerId:pageViewerId,view:storedView\}\)\)/);
assert.match(navigationSource,/String\(saved\.ownerId\)===pageViewerId&&pageViewerRole==="boss"/);
assert.match(clearSource,/const retainPartnerCommission=isBossPartnerCommissionView\(\)/);
assert.match(clearSource,/if\(retainPartnerCommission\)resetBossPartnerCommissionController\(\)/);
assert.match(dashboardSource,/if\(isBossPartnerCommissionView\(\)\)[\s\S]*?return;[\s\S]*?renderLiveShopDashboard/,'Partner-owned container blocks normal dashboard publication');
assert.match(client,/analysisChannelOptions[\s\S]*?if\(!isBossPartnerCommissionView\(\)\)setChannelView\("products"\);await selectChannel/);
assert.match(client,/\$\("#channels"\)\.addEventListener\("click", \(\) => \{[\s\S]*?if \(!isBossPartnerCommissionView\(\)\) setChannelView\("products"\)/);
assert.doesNotMatch(controllerSource,/\bapi\s*\(|\bfetch\s*\(/,'open/reset/restore is request-free');
for(const forbidden of ['/api/admin/tiktok-partner-commissions','/api/admin/tiktok-commissions','/api/vx/referrals'])assert.equal(controllerSource.includes(forbidden),false,`${forbidden} is submit-only`);

const makeClassList=()=>{const values=new Set();return{toggle(name,on){on?values.add(name):values.delete(name)},contains:name=>values.has(name),add:name=>values.add(name),remove:name=>values.delete(name)}};
const makeHarness=({owner='1',role='boss',stored=null}={})=>{
  const storage=new Map(stored?[['visiond_tiktok_channel_action',JSON.stringify(stored)]]:[]),bodyClassList=makeClassList();
  const buttons=[{dataset:{channelView:'products'},classList:makeClassList(),setAttribute(){}},{dataset:{channelView:'partner-commission'},classList:makeClassList(),setAttribute(){}}];
  const nav={querySelectorAll:()=>buttons,querySelector:()=>buttons[1],addEventListener(){}};
  const headerSmall={textContent:''},headerTitle={textContent:''},headerCaption={textContent:'',remove(){}};
  const header={querySelector(selector){if(selector==='small')return headerSmall;if(selector==='h2')return headerTitle;if(selector==='.source-caption')return headerCaption;return null},insertAdjacentHTML(){}};
  const range={textContent:''},content={innerHTML:'',insertAdjacentHTML(where,value){this.innerHTML=where==='afterbegin'?value+this.innerHTML:this.innerHTML+value}};
  const fields=['month','day','range'].map(mode=>({dataset:{commissionDates:mode},hidden:mode!=='month',querySelectorAll:()=>[{disabled:false}]}));
  const commissionForm={querySelectorAll:()=>fields};
  const dashboard={hidden:true,dataset:{},querySelector(selector){if(selector==='.result-head>div')return header;if(selector==='.result-head>b')return range;return null}};
  const nodes={'#channelActionSwitch':nav,'#shopDashboard':dashboard,'#shopCommissionDashboard':content,'#partnerCommissionForm':commissionForm,'#shopDashboard .result-head>b':range,'#shopCommissionDashboard .commission-summary':{insertAdjacentHTML(){}},'#shopGradeList':{innerHTML:''}};
  const counters={showcase:0};
  const context={COMMISSION_WORKSPACE_ENABLED:false,pageAuthorized:true,pageViewerId:owner,pageViewerRole:role,partnerCommissionUi:{scope:'selected',mode:'month',month:'2026-08',day:'2026-09-10',from:'2026-08-01',to:'2026-08-31',generation:0},partnerCommissionDefaults:()=>({month:'2026-08',latestDate:'2026-09-10',oldestDate:'2026-06-13'}),escapeHtml:value=>String(value),FormData:class{get(){return'month'}},sessionStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},document:{body:{classList:bodyClassList},querySelector:()=>null},$:selector=>nodes[selector]||null,tiktokShopNavigation:{showTab(){}},setOutputScope(){},setWorkspaceView(){},state:{selected:'a',channels:[{id:'a',name:'Alpha'}],shopDateFrom:'2026-08-01',shopDateTo:'2026-08-31'},shopHeader:header,money:value=>`฿${Number(value||0)}`,renderShowcaseProducts(){counters.showcase+=1},console};
  vm.createContext(context);
  vm.runInContext(`${navigationSource};${controllerSource};this.open=openBossPartnerCommission;this.restore=restoreChannelActionView;this.resetController=resetBossPartnerCommissionController;this.active=isBossPartnerCommissionView;this.view=()=>channelActionView;${dashboardSource};this.renderNormal=renderShopDashboard;`,context);
  return{context,storage,content,dashboard,headerTitle,bodyClassList,counters};
};

let harness=makeHarness();
assert.equal(harness.context.restore(),false);assert.equal(harness.context.view(),'products');
assert.equal(harness.context.open(),true);assert.equal(harness.context.active(),true);assert.match(harness.content.innerHTML,/id="partnerCommissionForm"/);assert.match(harness.content.innerHTML,/>ดูยอด<\/button>/);assert.doesNotMatch(harness.content.innerHTML,/แสดงค่าคอม/);
assert.deepEqual(JSON.parse(harness.storage.get('visiond_tiktok_channel_action')),{ownerId:'1',view:'boss-partner-commission'});
const beforeLate=harness.context.partnerCommissionUi.generation;
harness.context.renderNormal({shop_portfolio:{commission:[{total:99,currency:'THB',daily:[],channels:[]}]},shop_products:[{id:'p'}],shop_orders:[],date_range:{from:'2026-08-01',to:'2026-08-31'}},{id:'shop-a'});
assert.match(harness.content.innerHTML,/partnerCommissionForm/);assert.doesNotMatch(harness.content.innerHTML,/commission-summary/);assert.equal(harness.headerTitle.textContent,'ค่าคอมจาก Partner order sync');assert.equal(harness.counters.showcase,1);assert.equal(harness.context.partnerCommissionUi.generation,beforeLate);

const saved={ownerId:'1',view:'boss-partner-commission'};
harness=makeHarness({stored:saved});assert.equal(harness.context.restore(),true,'same authenticated Boss restores after reload');assert.equal(harness.context.active(),true);assert.match(harness.content.innerHTML,/partnerCommissionForm/);
const staleGeneration=harness.context.partnerCommissionUi.generation;harness.content.innerHTML='<div id="partnerCommissionResults">stale result</div>';
const generic=()=>({hidden:false,innerHTML:'x',textContent:'x',value:'x',dataset:{},classList:makeClassList(),removeAttribute(){},querySelectorAll:()=>[],querySelector:()=>null});
const originalDollar=harness.context.$,extras=new Map();
for(const selector of ['#result','#angelInventory','#tiktokConnection','#shopConnectionRequired','#syncTikTokShowcase','#syncTikTokShop','#showcaseSyncLimitField','#disconnectTikTokShop','#connectTikTok','#connectTikTokShop','#tiktokConnectionState','#tiktokShopState','#tiktokVideoSummary','#soldProductsData','#shopGradeList','#channelShopAnalysis','#screenshots','#previews','#angelProducts','#productReviewSchedule','#angelCount'])extras.set(selector,generic());
harness.context.$=selector=>originalDollar(selector)||extras.get(selector)||generic();harness.context.form={notes:{value:'x'},candidate_products:{value:'x'}};harness.context.resetMarketplaceView=()=>{};harness.context.URL=URL;
vm.runInContext(`${clearSource};this.clearOwned=clearChannelOwnedView`,harness.context);
harness.context.state.selected='b';harness.context.clearOwned();assert.ok(harness.context.partnerCommissionUi.generation>staleGeneration,'A to B/profile reload advances stale generation');assert.match(harness.content.innerHTML,/partnerCommissionForm/);assert.doesNotMatch(harness.content.innerHTML,/stale result/);assert.equal(harness.dashboard.hidden,false);
harness.context.renderNormal({shop_portfolio:{commission:[{total:50,currency:'THB',daily:[],channels:[]}]},shop_products:[],shop_orders:[]},{id:'shop-b'});assert.match(harness.content.innerHTML,/partnerCommissionForm/);assert.doesNotMatch(harness.content.innerHTML,/commission-summary/);

for(const denied of [{owner:'2',role:'boss'},{owner:'1',role:'admin'},{owner:'1',role:'user'}]){const other=makeHarness({...denied,stored:saved});assert.equal(other.context.restore(),false);assert.equal(other.context.view(),'products');assert.equal(other.context.active(),false)}
const product=makeHarness({stored:saved});product.context.restore();vm.runInContext('setChannelView("products")',product.context);assert.deepEqual(JSON.parse(product.storage.get('visiond_tiktok_channel_action')),{ownerId:'1',view:'products'});product.context.renderNormal({shop_portfolio:{commission:[{total:25,currency:'THB',daily:[],channels:[]}]},shop_products:[],shop_orders:[],date_range:{from:'2026-08-01',to:'2026-08-31'}},{id:'shop-a'});assert.match(product.content.innerHTML,/commission-summary/,'products mode retains normal shop dashboard behavior');

assert.equal(read('VERSION.txt').trim(),'v0.20.105');assert.match(html,/v0\.20\.105/);assert.match(html,/tiktok-analyzer\.js\?v=02163/);assert.match(html,/tiktok-analyzer\.css\?v=02102/);
console.log('PASS v105 owner-safe Boss view restore, request-free controller, late-load/profile/channel lifecycle isolation and exact ดูยอด action');
