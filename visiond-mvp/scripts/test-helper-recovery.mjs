import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const pair=readFileSync('public/launcher-pair.js','utf8'),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',flush=()=>new Promise(r=>setImmediate(r));
function fixture(fetch,storage=new Map(),hash='#id='+id){
 const nodes=new Map(),timers=[],calls=[],events={};const node=k=>{if(!nodes.has(k))nodes.set(k,{checked:false,events:{},addEventListener:(n,f)=>node(k).events[n]=f});return nodes.get(k)};
 const context={URLSearchParams,Date,AbortController,document:{getElementById:node},location:{hash,pathname:'/launcher-pair.html',assign:p=>calls.push(p)},history:{replaceState(){}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},localStorage:{setItem(){}},window:{addEventListener:(n,f)=>events[n]=f,close(){}},setTimeout:(f,ms)=>{const t={f,ms};timers.push(t);return t},clearTimeout:t=>{const i=timers.indexOf(t);if(i>=0)timers.splice(i,1)},fetch:async(p,o)=>{calls.push(p);return fetch(p,o)}};
 vm.runInNewContext(pair,context);return{node,timers,calls,storage,events};
}
const response=(status,body={})=>({ok:status===200,status,json:async()=>body});
{
 const f=fixture(async()=>response(401));await flush();assert.deepEqual(f.calls,['/api/auth/me']);assert.equal(f.node('login').hidden,false);assert.equal(f.node('confirm').disabled,true);assert.equal(f.node('retry').disabled,false);assert.ok(f.storage.has('visiond_pair_pending'));f.node('login').events.click();assert.equal(f.storage.get('vd_return_to'),'/launcher-pair');
 const restored=fixture(async p=>response(200,p.endsWith('prepare')?{pair_code:'12345678',confirm_nonce:'n'}:{}),f.storage,'');await flush();assert.deepEqual(restored.calls,['/api/auth/me','/api/launcher/pair-prepare']);restored.node('match').checked=true;restored.node('match').events.change();assert.equal(restored.node('confirm').disabled,false);
}
{
 const f=fixture(async p=>response(p.endsWith('prepare')?409:200));await flush();assert.equal(f.storage.has('visiond_pair_pending'),false);const count=f.calls.length;await f.node('retry').events.click();assert.equal(f.calls.length,count);assert.match(f.node('status').textContent,/เปิด VisionD Helper/);
}
for(const body of [false,true]){
 const f=fixture(async()=>body?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{}));await flush();assert.equal(f.timers[0].ms,8000);f.timers[0].f();await flush();assert.equal(f.node('retry').disabled,false);assert.equal(f.node('confirm').disabled,true);assert.match(f.node('status').textContent,/หมดเวลา/);assert.ok(f.storage.has('visiond_pair_pending'));
}
{
 const f=fixture(async()=>({ok:true,json:async()=>{throw new SyntaxError('raw parse')}}));await flush();assert.match(f.node('status').textContent,/กรุณากดลองใหม่/);assert.doesNotMatch(f.node('status').textContent,/SyntaxError|raw parse/);
}
console.log('PASS pair auth-first, login/refresh hint, explicit checkbox, expiry clear and hung headers/body/JSON recovery');
const setup=readFileSync('public/launcher-setup.js','utf8'),html=readFileSync('public/launcher-setup.html','utf8');assert.doesNotMatch(html.match(/<a id="download"[^>]+>/)[0],/href=/);
for(const valid of [false,true]){
 const nodes=new Map(),timers=[];const node=k=>{if(!nodes.has(k))nodes.set(k,{removeAttribute(){}});return nodes.get(k)};
 vm.runInNewContext(setup,{AbortController,document:{getElementById:node},setTimeout:f=>{timers.push(f);return f},clearTimeout(){},fetch:async()=>response(200,{version:valid?'0.20.76':'evil',signature_status:'NotSigned',executable:{file:'VisionD-Helper-Setup.exe',sha256:'bb1ca2900ad3ca16d5caae27b49e999e12b2bc42c31b25f17e202c4f507216d7'}})});await flush();assert.equal(!!node('download').href,valid);
}
console.log('PASS download remains unavailable until exact version/file/hash/signature manifest validation');
