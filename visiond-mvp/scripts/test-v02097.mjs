import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const src=readFileSync('public/tiktok-analyzer.js','utf8'),nodes=new Map(),scrolls=[],$=q=>{if(!nodes.has(q))nodes.set(q,{hidden:false,innerHTML:'',textContent:'',dataset:{},querySelectorAll:()=>[],insertAdjacentHTML(){},scrollIntoView:options=>scrolls.push({selector:q,options})});return nodes.get(q)};
let current=true;const c={$ ,state:{},escapeHtml:String,arrayValue:x=>Array.isArray(x)?x:[],textValue:String,normalizeProductName:String,upgradeLegacyProductLinkCells(){},channelOwnership:{current:()=>current,capture:()=>({channelId:'A'})},stampChannelOwnedActions(){}};
vm.createContext(c);vm.runInContext(src.slice(src.indexOf('function list(values, render)'),src.indexOf('const renderResultBase = renderResult;')),c);
for(const result of [{summary:'Saved result'},{}]){scrolls.length=0;assert.equal(c.renderOwnedResult(result,{channelId:'A'}),true);assert.equal(scrolls.length,0)}
const start=src.indexOf('    if(!publishContext||!channelOwnership.current(publishContext))return;'),end=src.indexOf('    message.textContent',start),publish=src.slice(start,end);
assert.ok(start>0);const run=()=>vm.runInContext('(function(){'+publish+'})()',c);
c.publishContext={channelId:'A'};c.results=[{summary:'New result'}];c.mergeAnalysisResults=x=>x[0];
run();assert.equal(scrolls.length,1);assert.equal(scrolls[0].selector,'#result');assert.equal(scrolls[0].options.behavior,'smooth');
scrolls.length=0;c.renderOwnedResult({summary:'Restored after success'},{channelId:'A'});assert.equal(scrolls.length,0,'follow-up loadChannels cannot scroll again');
current=false;run();assert.equal(scrolls.length,0);assert.equal(c.renderOwnedResult({},c.publishContext),false);
current=true;c.mergeAnalysisResults=()=>{throw Error('fixture failure')};assert.throws(run,/fixture failure/);assert.equal(scrolls.length,0);
assert.match(src,/\$\('\.ai-recommendations'\)|\$\("\.ai-recommendations"\)/);
assert.match(src,/\$\('#marketplaceResults'\)\?\.scrollIntoView/);
await import('./test-v02089.mjs');
console.log('v97 passive saved/empty0, explicit current1, follow-up0, stale/failure0; saved/channel render preserved: PASS');
