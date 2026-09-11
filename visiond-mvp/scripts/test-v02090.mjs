import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const src=readFileSync('public/tiktok-analyzer.js','utf8');
// Execute the real selection wrapper with a multiple-run overview; the base latest-render
// seam and actual result markup/owner races are exercised by v89 immediately below.
const start=src.indexOf('const selectChannelBase = selectChannel;'),end=src.indexOf('\n};',start)+3;
assert.ok(start>=0&&end>start);
const nodes=[];const c={state:{selected:'A'},selectChannel:async()=>({runs:[{id:'latest',result:{summary:'latest'}},{id:'older',result:{summary:'older'}}],pagination:{runs:{has_more:true}}}),channelOwnership:{begin:()=>({channelId:'A'}),current:()=>true},clearChannelOwnedView(){},replaceInventory(){},renderInventoryState(){},stampChannelOwnedActions(){},loadTikTokConnection:async()=>null,renderReviewSchedule(){},showToast(){},$:()=>({append:n=>nodes.push(n),classList:{toggle(){}}}),document:{body:{classList:{toggle(){}}},querySelector:()=>null,createElement:()=>({})},escapeHtml:String};
// Include any legacy renderer so this test remains RED on the original visible-history path.
const legacyStart=src.indexOf('function renderRunHistory()');
Object.assign(c,{renderChannels(){},saveUiValue(){}});
const legacy=legacyStart<0?'':src.slice(legacyStart,src.indexOf('async function loadMoreRuns()',legacyStart));
vm.createContext(c);vm.runInContext(legacy+'\n'+src.slice(start,end)+'\nthis.run=selectChannel;',c);await c.run('A');
assert.equal(nodes.length,0,'selected multirun channel must not append history DOM');
for(const token of ['analysisRunHistory','data-analysis-run','data-load-more-runs','loadMoreRuns','analysisRuns','runPagination'])assert.ok(!src.includes(token),token+' retired');
assert.ok(src.includes('renderOwnedResult(data.runs?.[0]?.result || {}, context)'));
await import('./test-v02089.mjs');
console.log('PASS v90 actual selection has no history DOM; latest/empty/race and backend history preserved');
