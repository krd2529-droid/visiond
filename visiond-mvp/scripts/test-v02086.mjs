import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {dateRange} from '../functions/api/admin/tiktok-connections/index.js';
const source=readFileSync('public/tiktok-analyzer.js','utf8'),apiSource=readFileSync('functions/api/admin/tiktok-connections/index.js','utf8');
const pickerLine=source.split('\n').find(line=>line.includes('insertAdjacentHTML("afterend",\'<section id="analysisChannelPicker"'));
let picker='';vm.runInNewContext(pickerLine,{$:()=>({insertAdjacentHTML:(_,html)=>picker=html})});
if(!process.argv.includes('--noon-only')){
assert.match(picker,/data-refresh-profile/,'refresh action belongs inside actual rendered channel picker');
assert.match(picker,/id="analysisChannelOptions"/);assert.match(picker,/data-browser-profile-status/,'authoritative status remains beside refresh');
assert.match(picker,/data-browser-profile-label/,'selected profile identity remains compactly visible');assert.equal((picker.match(/data-refresh-profile/g)||[]).length,1);
assert.doesNotMatch(source,/insertAdjacentHTML\("beforebegin",'<section id="browserProfilePanel"/,'no standalone Chrome action block');
assert.match(source,/\$\("\[data-refresh-profile\]"\)\?\.addEventListener\('click',refreshProfileStatus\)/,'original action listener preserved');
}
let calls=0;
const from=apiSource.indexOf("if(action==='shop_orders'){"),to=apiSource.indexOf('if (action === "shop_sync")',from),branch=apiSource.slice(from,to);
const ctx={request:{url:'https://visiondonline.com/api/admin/tiktok-connections'},env:{}};
const body={date_from:'2026-09-10',date_to:'2026-09-10',request_id:'fixture',revision:0};
const sandbox={ctx,body,auth:{},shop:{id:'selected'},action:'shop_orders',URL,URLSearchParams,headers:{},dateRange:url=>dateRange(url,Date.parse('2026-09-11T02:00:00Z')),json:(data,status)=>({data,status}),syncOrderPage:async(env,connection,range)=>{calls++;assert.equal(connection.id,'selected');assert.equal(range.availability.ready,false);return{status:'complete'}},vxRequestAccessStillCurrent:async()=>true};
const result=await vm.runInNewContext('(async()=>{'+branch+'})()',sandbox);
assert.equal(calls,1,'09:00 Thai latest-day POST reaches authoritative sync/provider seam');assert.equal(result.status,200);
assert.doesNotMatch(source,/12:00/,'no local wait-until-noon copy remains');assert.doesNotMatch(apiSource,/TIKTOK_DAILY_TOTALS_NOT_READY|!range\.availability\.ready|!availability\.ready/);
console.log('PASS v86 actual rendered picker placement/action/status and pre-noon latest-day POST reaches sync seam');
