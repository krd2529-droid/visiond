import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('public/tiktok-analyzer.js','utf8'),bridge=await readFile('public/browser-profile-launcher.js','utf8');
assert.doesNotMatch(source,/createTikTokConnectionPreflight|data-continue-pending|data-restore-profile/);
assert.match(source,/consumeLegacyConnectionHint/);assert.doesNotMatch(source,/browserLauncher\.launchHandoff/);
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const code=source.slice(source.indexOf('function connectionActionStatus('),source.indexOf('const tiktokShopNavigation'));
function fixture(){
 const pending=[],opened=[],statuses=[],timers=[],events={};let serial=0;
 const s={Set,Map,WeakMap,Date,Promise,JSON,AbortController,encodeURIComponent,window:{addEventListener:(name,fn)=>events[name]=fn},setTimeout:fn=>{timers.push(fn);return fn},clearTimeout:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1)},pageAuthorized:true,pageViewerId:'1',selected:A,rev:0,selectedChannel:()=>({id:s.selected}),$:()=>null,setBrowserProfileStatus:(...a)=>statuses.push(a),commandLauncher:{openCommand:body=>{opened.push(body);return (++serial===1?A:B)}},fetch:async(url,options)=>url.endsWith('/helpers')?{ok:true,json:async()=>({items:[{id:A}]})}:url==='/api/tiktok/handoff'?{ok:true,json:async()=>({command_id:JSON.parse(options.body).command_id})}:new Promise(resolve=>pending.push({url,resolve})),channelOwnership:{capture:()=>({channelId:s.selected,generation:s.rev}),revision:()=>s.rev,unchanged:r=>r===s.rev,current:c=>c.channelId===s.selected&&c.generation===s.rev}};
 vm.createContext(s);vm.runInContext(code+';this.run=issueProfileOAuth;this.requests=profileHandoffRequests;this.readStatus=readLauncherStatus;',s);
 const reply=(request,body={status:'process_started'},ok=true)=>request.resolve({ok,json:async()=>body});
 return{s,pending,opened,statuses,reply,timers,events};
}
{
 const f=fixture(),a=f.s.run('shop');assert.equal(f.opened.length,1,'popup opens synchronously before any await');assert.equal(f.opened[0].channel_id,A);assert.equal(await f.s.run('tiktok'),false,'same channel cross-provider duplicate is suppressed');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.pending.length,1);f.reply(f.pending[0]);assert.equal(await a,true);assert.equal(await f.s.run('shop'),false,'ack does not blindly reissue');assert.equal(f.opened.length,1);
}
{
 const f=fixture(),attrs=new Map(),node={textContent:'',dataset:{}},control={parentElement:{querySelector:()=>node},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const a=f.s.run('shop',control);await new Promise(resolve=>setImmediate(resolve));f.s.selected=B;f.s.rev++;const b=f.s.run('shop',control);
 await new Promise(resolve=>setImmediate(resolve));f.reply(f.pending[0]);assert.equal(await a,false);assert.equal(attrs.get('aria-busy'),'true');f.reply(f.pending[1]);assert.equal(await b,true);assert.equal(attrs.has('aria-busy'),false);assert.equal(f.s.requests.size,2,'independently authorized clicks retain two command ids');assert.equal(f.opened[0].channel_id,A);assert.equal(f.opened[1].channel_id,B);
}
{
 const f=fixture(),a=f.s.run('tiktok_new');assert.equal(JSON.stringify(f.opened[0]),JSON.stringify({provider:'tiktok',intent:'new',channel_id:''}));await new Promise(resolve=>setImmediate(resolve));f.events.pagehide();f.reply(f.pending[0]);assert.equal(await a,false,'unmount drops status rendering');assert.equal(f.pending.length,1);
}
{
 const f=fixture(),a=f.s.run('shop');await new Promise(resolve=>setImmediate(resolve));for(let i=0;i<8;i++){assert.equal(f.pending.length,i+1);f.reply(f.pending[i],{status:'pending'});await new Promise(resolve=>setImmediate(resolve));if(i<7){f.timers.shift()();await new Promise(resolve=>setImmediate(resolve));}}assert.equal(await a,false);assert.equal(f.pending.length,8,'finite polling never continues indefinitely');assert.equal(f.opened.length,1);
}
{
 const opens=[],context={window:{},URLSearchParams,setTimeout,console};vm.runInNewContext(bridge,context);const launcher=context.window.createVisionDCommandLauncher({cryptoApi:{randomUUID:()=>A},openWindow:(...args)=>{opens.push(args);return null}});
 assert.equal(launcher.openCommand({provider:'tiktok',intent:'new'}),A,'noopener null is not interpreted as failure');assert.equal(opens[0][2],'noopener,noreferrer');assert.match(opens[0][0],/^\/launcher-open\.html#/);assert.doesNotMatch(opens[0][0],/ticket|secret|visiond-profile:/);
}
console.log('PASS v72 synchronous noopener command bootstrap, null return, direct new/view, per-channel dedup, Map/WeakMap ownership, stale status and bounded teardown');
for(const bodyHung of [false,true]){
 const f=fixture();f.s.fetch=async()=>bodyHung?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{});
 const run=f.s.run('shop');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.timers.length,1);f.timers[0]();assert.equal(await run,false,'hung headers/body settles at deadline');assert.equal(await f.s.run('shop'),false);assert.equal(f.opened.length,1,'timeout preserves ambiguous request instead of relaunching');
 const status=f.s.readStatus(A);await new Promise(resolve=>setImmediate(resolve));f.timers[0]();await assert.rejects(status);const again=f.s.readStatus(A);await new Promise(resolve=>setImmediate(resolve));f.timers[0]();await assert.rejects(again,'timed out status dedup entry is released');
}
for(const bodyHung of [false,true]){
 const f=fixture();f.s.fetch=async url=>url.endsWith('/helpers')?{ok:true,json:async()=>({items:[{id:A}]})}:bodyHung?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{});
 const run=f.s.run('shop');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.timers.length,1);f.timers[0]();assert.equal(await run,false,'hung issue headers/body releases busy lock');assert.equal(await f.s.run('shop'),false);assert.equal(f.opened.length,1);
}
{
 const f=fixture(),a=f.s.readStatus(A),b=f.s.readStatus(A);assert.equal(f.pending.length,1,'focus/manual and active polling coalesce the same indexed status read');f.reply(f.pending[0]);await Promise.all([a,b]);
}
