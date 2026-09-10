import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fixture} from './test-v02072.mjs';
const source=readFileSync('public/tiktok-analyzer.js','utf8');
const f=fixture();vm.runInContext('launcherReadiness.expires=0;',f.s);
const run=f.s.run('tiktok_new');assert.equal(f.opened.length,1,'expired selected same-owner helper opens on this genuine click synchronously');
await new Promise(r=>setImmediate(r));f.reply(f.pending[0]);await run;
assert.equal(f.opened[0].intent,'new');assert.equal(f.opened[0].channel_id,'');
console.log('PASS v81 expired same-owner helper remains a synchronous server-revalidated candidate');
function mounted(){
 const f=fixture(),node={textContent:'',dataset:{}},attrs=new Map(),control={disabled:false,textContent:'+ ช่องใหม่',parentElement:{querySelector:()=>node},setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k),addEventListener:(event,fn)=>{control.click=()=>control.disabled?false:fn()}};
 f.s.$=selector=>selector==='#newChannel'?control:null;vm.runInContext(source.slice(source.indexOf('function requestNewBrowserProfile()'),source.indexOf('$("[data-open-channel-profile]")?.addEventListener'))+';this.init=initializeLauncherReadiness;',f.s);
 return {...f,node,control,attrs};
}
for(const outcome of ['ready','empty','error','owner']){
 const f=mounted();f.s.unready();let resolveLookup;const originalFetch=f.s.fetch;f.s.fetch=(url,options)=>url.endsWith('/helpers')?new Promise(resolve=>{resolveLookup=resolve}):originalFetch(url,options);
 const init=f.s.init();assert.equal(f.control.disabled,true);assert.equal(f.attrs.get('aria-busy'),'true');assert.match(f.control.textContent,/กำลังตรวจ/);f.control.click();assert.equal(f.opened.length,0);
 if(outcome==='owner')f.s.pageViewerId='2';resolveLookup({ok:outcome!=='error',json:async()=>({items:outcome==='ready'||outcome==='owner'?[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]:[]})});await init;
 assert.equal(f.control.disabled,false);assert.equal(f.attrs.has('aria-busy'),false);assert.equal(f.control.textContent,'+ ช่องใหม่');
 if(outcome==='ready'){const run=f.control.click();assert.equal(f.opened.length,1);const duplicate=f.control.click();assert.equal(f.opened.length,1);await new Promise(r=>setImmediate(r));f.reply(f.pending[0]);await run;assert.equal(f.s.requests.size,1)}
 else if(outcome==='empty'){await f.control.click();assert.equal(f.opened.length,0);assert.match(f.node.textContent,/ติดตั้ง|Helper|ตัวช่วย/)}
 else if(outcome==='error'){assert.match(f.node.textContent,/ตรวจสถานะ|เข้าสู่ระบบ/);assert.equal(f.opened.length,0)}
 else{assert.equal(f.opened.length,0);assert.equal(f.node.textContent,'','stale owner initialization never renders prior helper status')}
}
{
 const f=mounted();vm.runInContext('launcherReadiness.expires=0;',f.s);let posts=0;f.s.fetch=async()=>{posts++;return{ok:false,json:async()=>({error:'Helper ถูกยกเลิกแล้ว'})}};
 const run=f.control.click();assert.equal(f.opened.length,1);await run;assert.match(f.node.textContent,/ถูกยกเลิก/);assert.equal(posts,1);assert.equal(f.attrs.has('aria-busy'),false);assert.equal(f.s.requests.size,1,'ambiguous issued ID retained, never silently replaced');
}
assert.match(source,/await initializeLauncherReadiness\(\)/);
assert.match(readFileSync('public/tiktok-analyzer.html','utf8'),/id="newChannel"[^>]*disabled[^>]*aria-busy="true"/);
for(const outcome of ['timeout','teardown']){
 const f=mounted();f.s.unready();f.s.fetch=()=>new Promise(()=>{});const init=f.s.init();await new Promise(r=>setImmediate(r));
 if(outcome==='teardown')f.events.pagehide();else f.timers[0]();await init;
 assert.equal(f.control.disabled,false);assert.equal(f.attrs.has('aria-busy'),false);assert.equal(f.opened.length,0);
 if(outcome==='teardown'){await f.control.click();assert.equal(f.opened.length,0);assert.equal(f.node.textContent,'')}else assert.match(f.node.textContent,/หมดเวลา/);
}
console.log('PASS v81 actual new-button listener cold initialization/finally/no-helper/error/owner and expired/revoked/dedup');
