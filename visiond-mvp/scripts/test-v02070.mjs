import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const [source, html, version] = await Promise.all([
  read('public/tiktok-analyzer.js'),
  read('public/tiktok-analyzer.html'),
  read('VERSION.txt')
]);
const between = (start, end) => {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `missing source slice ${start}`);
  return source.slice(from, to);
};

const ownershipSource = between('function createTikTokChannelOwnership', 'const $ =');
{
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${ownershipSource}\nlet selected='A';const owner=createTikTokChannelOwnership(()=>selected);this.h={owner,set:id=>selected=id};`, sandbox);
  const a = sandbox.h.owner.begin('A');
  assert.equal(sandbox.h.owner.commit(a), true);
  assert.equal(sandbox.h.owner.capture().channelId, 'A');
  sandbox.h.set('B');
  const b = sandbox.h.owner.begin('B');
  assert.equal(sandbox.h.owner.current(a), false, 'late A response must be stale after B begins');
  assert.equal(sandbox.h.owner.capture(), null, 'B actions stay disabled until B overview commits');
  assert.equal(sandbox.h.owner.commit(b), true);
  sandbox.h.set('C');
  sandbox.h.owner.begin('C');
  assert.equal(sandbox.h.owner.current(b), false, 'A/B/C switching must keep only the newest owner');
}

const contextSource = between('function channelContextFor', 'function clearChannelOwnedView');
const mutationSource = between('async function setProductC', 'async function addMarketplaceProductToSelection');
const showcaseSource = between('async function addProductsToShowcase', 'async function addMarketplaceSelection');
{
  const sandbox = { FormData };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${ownershipSource}
    let state={selected:'A'};const channelOwnership=createTikTokChannelOwnership(()=>state.selected);channelOwnership.commit(channelOwnership.begin('A'));
    ${contextSource}
    let posts=[],toasts=[],resolveApi;let message={textContent:'A ready'};
    function api(url,options){posts.push({url,channelId:options.body.get('channel_id')});return new Promise(resolve=>resolveApi=resolve)}
    async function refreshOwnedInventory(context){return channelOwnership.current(context)?{products:[]}:null}
    function showToast(text,type){toasts.push({text,type})}
    ${mutationSource}
    const button=owner=>({dataset:{channelOwner:owner,setC:'fixture',productScore:'1',productEvidence:'fixture',productUrl:'',sourceKind:'fixture',requestedGrade:'D'},disabled:false,closest(){return{dataset:{channelOwner:owner}}}});
    this.h={start:owner=>setProductC(button(owner)),resolve:value=>resolveApi(value||{product_type:'D'}),switchTo(id){state.selected=id;channelOwnership.commit(channelOwnership.begin(id));message.textContent=id+' ready'},snapshot:()=>({posts:[...posts],toasts:[...toasts],message:message.textContent})};
  `, sandbox);
  const pending = sandbox.h.start('A');
  assert.equal(sandbox.h.snapshot().posts[0].channelId, 'A');
  sandbox.h.switchTo('B');
  sandbox.h.resolve();
  await pending;
  assert.equal(sandbox.h.snapshot().toasts.length, 0, 'late A mutation must not announce success in B');
  assert.equal(sandbox.h.snapshot().message, 'B ready');
  await sandbox.h.start('A');
  assert.equal(sandbox.h.snapshot().posts.length, 1, 'retained A action must cause zero writes in B');
}
{
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${ownershipSource}
    let state={selected:'B',shopConnection:{id:'shop-B',channel_id:'B',capabilities:{can_write_showcase:true}}};const channelOwnership=createTikTokChannelOwnership(()=>state.selected);channelOwnership.commit(channelOwnership.begin('B'));
    ${contextSource}
    let posts=[];async function api(url,options){posts.push(JSON.parse(options.body));return{added:1}}
    function renderShowcasePermission(){} function showToast(){} function $(){return{scrollIntoView(){}}}
    async function loadTikTokConnection(){} function renderMarketplaceProducts(){} function marketplaceView(){return{products:[]}}
    ${showcaseSource}
    const oldA={disabled:false,closest(){return{dataset:{channelOwner:'A'}}}};
    this.h={run:()=>addProductsToShowcase(['product-A'],oldA),posts};
  `, sandbox);
  await sandbox.h.run();
  assert.equal(sandbox.h.posts.length, 0, 'detached A Showcase action must not write through B connection');
}

const selectWrapper = between('const selectChannelBase = selectChannel;', '$("#channels").addEventListener');
assert.ok(selectWrapper.indexOf('channelOwnership.begin') < selectWrapper.indexOf('clearChannelOwnedView()'));
assert.ok(selectWrapper.indexOf('clearChannelOwnedView()') < selectWrapper.indexOf('await selectChannelBase'), 'old DOM must clear before overview awaits');
const selectBase = between('async function selectChannel(id, context)', 'function newChannel');
assert.ok(selectBase.indexOf('await api(') < selectBase.indexOf('channelOwnership.current(context)'));
assert.ok(selectBase.indexOf('channelOwnership.current(context)') < selectBase.indexOf('form.channel_id.value'), 'stale overview must exit before DOM writes');
const clearSource = between('function clearChannelOwnedView()', 'async function refreshOwnedInventory');
for (const token of ['state.connectionLoadSeq += 1', 'result.hidden = true', 'inventory.hidden = true', '#syncTikTokShowcase', '#showcaseSyncLimitField', 'form.notes.value = ""', '#screenshots']) assert.ok(clearSource.includes(token), token);

function createSelectRuntime() {
  const sandbox = { URLSearchParams, encodeURIComponent };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${ownershipSource}
    class FixtureNode {
      constructor(id=''){this.id=id;this.hidden=false;this.dataset={};this.innerHTML='';this.textContent='';this.value='';this.children=[];this.classList={add(){},remove(){},toggle(){}}}
      querySelector(selector){return selector==='#analysisRunHistory'?null:null}
      querySelectorAll(selector){
        if(selector==='[data-field="summary"],[data-field="direction"]')return [nodes.summary,nodes.direction];
        if(selector==='[data-list]')return [nodes.winners,nodes.candidates,nodes.plan];
        return [];
      }
      removeAttribute(name){delete this[name]}
    }
    const nodeIds=['result','angelInventory','tiktokConnection','manageChannelConnections','shopConnectionRequired','syncTikTokShowcase','showcaseSyncLimitField','disconnectTikTokShop','connectTikTok','connectTikTokShop','tiktokConnectionState','tiktokShopState','tiktokVideoSummary','soldProductsData','shopCommissionDashboard','shopGradeList','shopDashboard','channelShopAnalysis','screenshots','previews','angelProducts','productReviewSchedule','angelCount','channelMode','formHeading'];
    const nodes=Object.fromEntries(nodeIds.map(id=>[id,new FixtureNode(id)]));
    Object.assign(nodes,{summary:new FixtureNode('summary'),direction:new FixtureNode('direction'),winners:new FixtureNode('winners'),candidates:new FixtureNode('candidates'),plan:new FixtureNode('plan')});
    const $=selector=>nodes[String(selector).replace(/^#/, '')]||null;
    const document={body:{classList:{remove(){},toggle(){}}}};
    const form={classList:{add(){}},channel_id:{value:''},channel_name:{value:''},channel_url:{value:''},strategy:{value:''},notes:{value:''},candidate_products:{value:''}};
    const typeLabels={A:'A',B:'B',C:'C',D:'D',E:'E',F:'F'};
    const escapeHtml=value=>String(value??'');
    const state={selected:null,channels:[{id:'A',name:'A'},{id:'B',name:'B'}],connectionLoadSeq:0};
    const channelOwnership=createTikTokChannelOwnership(()=>state.selected);
    const pending=new Map();
    function api(url){const id=new URLSearchParams(String(url).split('?')[1]).get('channel_id');return new Promise((resolve,reject)=>pending.set(id,{resolve,reject}))}
    function renderChannels(){}
    function upgradeLegacyProductLinkCells(){}
    function resetMarketplaceView(){}
    function saveUiValue(){}
    function replaceInventory(data){return data}
    function renderInventoryState(){}
    function renderRunHistory(){}
    function stampChannelOwnedActions(root,context){if(root&&context)root.dataset.channelOwner=context.channelId}
    function renderOwnedResult(value,context){if(!channelOwnership.current(context))return false;nodes.result.hidden=false;nodes.summary.textContent=value?.summary||'';nodes.result.dataset.channelOwner=context.channelId;return true}
    async function loadTikTokConnection(channelId,context){return channelOwnership.current(context)?{channelId}:null}
    function renderReviewSchedule(){}
    function showToast(text){nodes.toast=text}
    const message=new FixtureNode('message');
    ${clearSource}
    ${selectBase}
    ${selectWrapper}
    this.fixture={
      select:id=>selectChannel(id),
      resolve:(id,data)=>pending.get(id).resolve(data),
      reject:(id,error)=>pending.get(id).reject(error),
      snapshot:()=>({selected:state.selected,resultHidden:nodes.result.hidden,summary:nodes.summary.textContent,owner:nodes.result.dataset.channelOwner||'',message:message.textContent})
    };
  `, sandbox);
  return sandbox.fixture;
}

{
  const fixture = createSelectRuntime();
  const selectA = fixture.select('A');
  fixture.resolve('A', { channel: { id: 'A', name: 'A' }, products: [], runs: [{ result: { summary: 'summary A' } }] });
  await selectA;
  assert.equal(JSON.stringify(fixture.snapshot()), JSON.stringify({ selected: 'A', resultHidden: false, summary: 'summary A', owner: 'A', message: '' }));
  const selectB = fixture.select('B');
  assert.equal(fixture.snapshot().resultHidden, true, 'switching to B must clear A before the B overview resolves');
  assert.equal(fixture.snapshot().summary, '', 'switching must clear the prior channel summary immediately');
  fixture.resolve('B', { channel: { id: 'B', name: 'B' }, products: [], runs: [] });
  await selectB;
  assert.equal(fixture.snapshot().resultHidden, true, 'an empty B overview must not reveal the old A result');
  assert.equal(fixture.snapshot().summary, '');
}
{
  const fixture = createSelectRuntime();
  const slowA = fixture.select('A');
  const fastB = fixture.select('B');
  fixture.resolve('B', { channel: { id: 'B', name: 'B' }, products: [], runs: [{ result: { summary: 'summary B' } }] });
  await fastB;
  fixture.resolve('A', { channel: { id: 'A', name: 'A' }, products: [], runs: [{ result: { summary: 'late summary A' } }] });
  await slowA;
  assert.equal(JSON.stringify(fixture.snapshot()), JSON.stringify({ selected: 'B', resultHidden: false, summary: 'summary B', owner: 'B', message: '' }), 'late A overview must not overwrite committed B');
}

{
  const prepareSource = between('async function prepareOwnedCommission', '$("#shopCommissionDashboard").addEventListener');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`
    ${ownershipSource}
    let state={selected:'A'},resolvePrepare;const channelOwnership=createTikTokChannelOwnership(()=>state.selected);channelOwnership.commit(channelOwnership.begin('A'));
    const window={VisionDCommissionCard:{prepareCommissionCard:()=>new Promise(resolve=>resolvePrepare=resolve)}};
    ${prepareSource}
    this.fixture={start:()=>prepareOwnedCommission(channelOwnership.capture(),{owner:'A'}),switchB(){state.selected='B';channelOwnership.commit(channelOwnership.begin('B'))},resolve:value=>resolvePrepare(value)};
  `, sandbox);
  const pending = sandbox.fixture.start();
  sandbox.fixture.switchB();
  sandbox.fixture.resolve({ files: ['A-card'] });
  assert.equal(await pending, null, 'late A commission preparation must not publish into B');
}

assert.match(source, /renderOwnedResult\(data\.runs\[0\]\.result, context\)/);
assert.match(source, /loadMoreRuns\(\)[^]*channelOwnership\.current\(context\)/);
assert.match(source, /loadMoreInventoryResource\(resource\)[^]*channelOwnership\.current\(context\)/);
assert.match(source, /syncSelectedSoldProductGrades\(context\)[^]*channelOwnership\.current\(context\)/);
assert.match(source, /baseEntries=\[\.\.\.new FormData\(form\)\.entries\(\)\]/, 'batch analysis must snapshot inputs once');
assert.match(source, /payload\.set\("channel_id", operationChannelId\)/, 'all batches must keep the original channel');
for (const token of ['state.preparedCommission = null', 'state.commissionCards = []', 'state.lastCommissionCard = null', 'URL.revokeObjectURL']) assert.ok(clearSource.includes(token), `channel switch must clear ${token}`);
assert.match(source, /stampChannelOwnedActions\(\$\("#shopDashboard"\), context\)/, 'commission actions must be stamped with their channel owner');

assert.equal(version.trim(), 'v0.20.76');
assert.match(html, /<b>v0\.20\.76<\/b>/);
assert.match(html, /tiktok-analyzer\.js\?v=02135/);
console.log('PASS v0.20.70 channel-owned analyzer view, async responses and mutations');
