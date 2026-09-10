import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('public/tiktok-analyzer.js','utf8');
const classes=new Map();const context={COMMISSION_WORKSPACE_ENABLED:false,document:{body:{classList:{toggle:(k,v)=>classes.set(k,v)}}},$:()=>null};
vm.runInNewContext(source.slice(source.indexOf('function setChannelView(view)'),source.indexOf('$("#channelActionSwitch")?.addEventListener'))+';setChannelView("commission");',context);
assert.equal(classes.get('channel-view-commission'),false,'disabled commission stale view must normalize to products');
assert.equal(classes.get('channel-view-products'),true);
console.log('PASS v82 stale commission view fails closed');
assert.match(source,/const COMMISSION_WORKSPACE_ENABLED = false;/);
const nav=source.split('\n').find(line=>line.includes('insertAdjacentHTML("afterend", \'<nav id="channelActionSwitch"'));
const helper=source.slice(source.indexOf('async function loadCommissionWorkspace('),source.indexOf('function renderAccurateCommission('));
const portfolio=source.slice(source.indexOf('async function loadPortfolioDashboard('),source.indexOf('async function loadCommissionWorkspace('));
for(const enabled of [false,true]){
 const calls=[],html=[],rendered=[];const s={COMMISSION_WORKSPACE_ENABLED:enabled,$:()=>({insertAdjacentHTML:(_,value)=>html.push(value)}),api:async url=>{calls.push(url);return{}},state:{shopDateFrom:'2026-09-01',shopDateTo:'2026-09-10'},shopDateQuery:()=> 'fixture',renderShopDashboard:()=>rendered.push('products'),renderAccurateCommission:()=>rendered.push('commission')};
 vm.runInNewContext(nav,s);assert.equal(html[0].includes('data-channel-view="commission"'),enabled);assert.match(html[0],/data-channel-view="products"/);
 vm.runInNewContext(helper+portfolio+';this.load=loadPortfolioDashboard;this.selected=()=>loadCommissionWorkspace("channel_id=fixture");',s);
 await s.load();assert.equal(calls.some(url=>url.includes('tiktok-connections')),true,'portfolio product/order read retained');assert.equal(calls.some(url=>url.includes('tiktok-commissions')),enabled);assert.equal(calls.some(url=>url.includes('/vx/referrals')),enabled);assert.equal(rendered.includes('products'),true);assert.equal(rendered.includes('commission'),enabled);
 calls.length=0;await s.selected();assert.equal(calls.length,enabled?2:0,'selected-channel commission request gated');
}
assert.match(source,/if \(shopConnection && COMMISSION_WORKSPACE_ENABLED\) \{\s*const \[commission, referral\] = await loadCommissionWorkspace/);
assert.match(source,/shopCommissionDashboard"\)\.addEventListener\("click", async \(event\) => \{\s*if\(!COMMISSION_WORKSPACE_ENABLED\)return/);
assert.match(source,/if\(COMMISSION_WORKSPACE_ENABLED\)document.head.append\(commissionCardScript\)/);
console.log('PASS v82 actual nav/products-only, portfolio and selected no-commission/referral calls; one-line true restores both');
const daysHandler=source.slice(source.indexOf('$("#shopCommissionDashboard").addEventListener("click", async event =>'),source.indexOf('$("#showInputView").addEventListener'));
for(const enabled of [false,true]){
 let handler,calls=0;const state={selected:null,shopDateFrom:'before-from',shopDateTo:'before-to'},button={dataset:{commissionDays:'7'},disabled:false};
 const s={COMMISSION_WORKSPACE_ENABLED:enabled,state,$:()=>({addEventListener:(_,fn)=>{handler=fn}}),commissionAvailability:()=>({latestDate:'new-to'}),dateDaysAgo:days=>'new-from-'+days,loadPortfolioDashboard:async()=>{calls++},showToast:()=>{}};
 vm.runInNewContext(daysHandler,s);await handler({target:{closest:()=>button}});
 assert.equal(calls,enabled?1:0,'stale commission-days click must perform zero actions when disabled');
 assert.equal(state.shopDateFrom,enabled?'new-from-6':'before-from');assert.equal(state.shopDateTo,enabled?'new-to':'before-to');assert.equal(button.disabled,enabled);
}
console.log('PASS v82 commission-days stale click is no-op while disabled and preserved when enabled');
