import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const nodes=new Map(),timers=[],calls=[];let closed=0;
const node=name=>{if(!nodes.has(name))nodes.set(name,{textContent:'',checked:false,disabled:false,events:{},addEventListener(type,fn){(this.events[type]??=[]).push(fn)}});return nodes.get(name)};
const s={URLSearchParams,Date,AbortController,sessionStorage:{setItem(){},getItem(){return null},removeItem(){}},document:{getElementById:node},location:{hash:'#id='+id,pathname:'/launcher-pair.html'},history:{replaceState(){}},localStorage:{setItem(){throw Error('storage unavailable')}},window:{addEventListener(){},close(){closed++}},setTimeout:fn=>{timers.push(fn);return fn},clearTimeout:fn=>{const i=timers.indexOf(fn);if(i>=0)timers.splice(i,1)},fetch:async(url,opts)=>{calls.push(url);return{ok:true,json:async()=>url.endsWith('pair-prepare')?{pair_code:'12ABCDEF',confirm_nonce:'n',replace_id:''}:{helper_id:id}}}};
vm.runInNewContext(readFileSync('public/launcher-pair.js','utf8'),s);
await new Promise(resolve=>setImmediate(resolve));
assert.equal(timers.length,0,'pairing never auto-confirms or closes before explicit approval');
node('match').checked=true;await node('confirm').events.click[0]();
assert.deepEqual(calls,['/api/auth/me','/api/launcher/pair-prepare','/api/launcher/pair-confirm']);
assert.match(node('status').textContent,/ผูกตัวช่วยแล้ว/);assert.equal(timers.length,1);timers[0]();assert.equal(closed,1);assert.equal(node('confirm').textContent,'ปิดแท็บนี้');
const native=readFileSync('tools/browser-launcher/Launcher.cs','utf8');
assert.match(native,/setTimeout\(function\(\)\{window.close\(\)\},800\)/);
assert.doesNotMatch(native.match(/string nonce=RandomHex\(\),html=.*;/)?.[0]||'',/\+command|\+ticket|\+secret/);
assert.match(readFileSync('tools/browser-launcher/install.ps1','utf8'),/\/target:winexe/);
console.log('PASS explicit pair confirmation, blocked-storage success, constant owned-tab close and hidden native subsystem');
const bootstrap=readFileSync('public/launcher-open.js','utf8');
assert.match(readFileSync('public/launcher-open.html','utf8'),/>ติดตั้ง\/ซ่อมตัวช่วยเครื่องนี้<\/a>/);
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function bootstrapFixture({hash='#command_id='+id,replies=[],open=true,hung=false}={}){
 let now=0,reads=0,closed=0,focused=0,aborted=0;const tasks=[],topNavigations=[],localNavigations=[],opens=[],events={},nodeMap=new Map();
 const element=name=>{if(!nodeMap.has(name))nodeMap.set(name,{textContent:'',hidden:false,disabled:false,href:'',dataset:{},events:{},addEventListener(type,fn){this.events[type]=fn}});return nodeMap.get(name)};
 const popup={closed:false};
 const ctx={URLSearchParams,AbortController,Date:{now:()=>now},document:{getElementById:element},history:{replaceState(){}},location:{hash,pathname:'/launcher-open.html',replace:url=>topNavigations.push(url)},window:{addEventListener:(type,fn)=>events[type]=fn,open:(...args)=>{opens.push(args);if(open)localNavigations.push(args[0]);return null},close(){closed++},focus(){focused++}},setTimeout:(fn,ms)=>{const task={fn,at:now+ms,ms};tasks.push(task);return task},clearTimeout:task=>{const index=tasks.indexOf(task);if(index>=0)tasks.splice(index,1)},fetch:async(url,{signal})=>{reads++;assert.match(url,/^\/api\/launcher\/status\?command_id=/);signal.addEventListener('abort',()=>aborted++);if(hung)return new Promise(()=>{});const body=replies[Math.min(reads-1,replies.length-1)]||{status:'waiting'};return{ok:true,json:async()=>body}}};
 vm.runInNewContext(bootstrap,ctx);
 return {ctx,tasks,topNavigations,localNavigations,opens,events,popup,element,get reads(){return reads},get closed(){return closed},get focused(){return focused},get aborted(){return aborted},async flush(){await flush();await flush()},async drain(limit=40){for(let i=0;i<limit;i++){await this.flush();tasks.sort((a,b)=>a.at-b.at);const task=tasks.shift();if(!task)break;now=task.at;task.fn()}await this.flush()}};
}
{
 const f=bootstrapFixture({hash:'#command_id='+id+'&provider=tiktok'});await f.flush();assert.equal(f.reads,0);assert.equal(f.topNavigations.length,0);assert.match(f.element('status').textContent,/TikTok Analyzer/);assert.match(f.element('launcher-setup').href,/state=new/);
}
console.log('PASS hostile bootstrap fragments never read status or dispatch localhost');
{
 const pending={status:'pending',command_id:id,port:53179,expired:0},f=bootstrapFixture({replies:[pending,{status:'process_started',command_id:id,port:53179}]});await f.flush();
 assert.equal(f.topNavigations.length,0,'pending must retain the VisionD foreground');assert.equal(f.element('launcher-dispatch').hidden,false);assert.equal(f.element('launcher-dispatch').textContent,'เปิด Helper เครื่องนี้');
 await f.element('launcher-dispatch').events.click();assert.deepEqual(f.opens,[['http://127.0.0.1:53179/launch?command_id='+id,'_blank','noopener,noreferrer,popup,width=460,height=260']]);assert.deepEqual(f.localNavigations,['http://127.0.0.1:53179/launch?command_id='+id]);assert.equal(f.topNavigations.length,0);assert.match(f.element('status').textContent,/เริ่ม Chrome/);assert.ok(f.focused>=1);
}
console.log('PASS pending command uses one user-activated command-id-only auxiliary and keeps VisionD foreground');
{
 const pending={status:'pending',command_id:id,port:53179,expired:0},f=bootstrapFixture({replies:[pending]});await f.flush();const run=f.element('launcher-dispatch').events.click();await f.drain();await run;
 assert.ok(f.reads<=9,'initial readiness plus dispatch polling stay bounded');assert.equal(f.localNavigations.length,1);assert.equal(f.topNavigations.length,0);assert.equal(f.element('launcher-dispatch').disabled,false);assert.match(f.element('launcher-dispatch').textContent,/คำขอเดิม/);assert.match(f.element('status').textContent,/ยังไม่ตอบจากเครื่องนี้/);assert.match(f.element('launcher-setup').href,/state=not-running/);
}
console.log('PASS absent/stopped/other-machine timeout retains same-command retry and setup recovery');
{
 const pending={status:'pending',command_id:id,port:53179,expired:0},outdated={status:'failed',command_id:id,error_code:'HELPER_UPDATE_REQUIRED'},f=bootstrapFixture({replies:[pending,outdated]});await f.flush();await f.element('launcher-dispatch').events.click();assert.match(f.element('status').textContent,/รุ่นเก่า.*อัปเดต/);assert.match(f.element('launcher-setup').href,/state=outdated/);assert.equal(f.element('launcher-dispatch').hidden,true);
}
console.log('PASS signed legacy status gives authoritative update guidance without retrying a terminal command');
{
 const pending={status:'pending',command_id:id,port:53179,expired:0},f=bootstrapFixture({replies:[pending],open:false});await f.flush();const run=f.element('launcher-dispatch').events.click();await f.drain();await run;assert.equal(f.localNavigations.length,0);assert.match(f.element('status').textContent,/ยังไม่ตอบจากเครื่องนี้/);assert.match(f.element('launcher-dispatch').textContent,/คำขอเดิม/);
}
for(const bodyHung of [false,true]){
 const f=bootstrapFixture({hung:true});await f.flush();assert.equal(f.tasks[0].ms,5000);f.tasks.shift().fn();await f.flush();assert.equal(f.aborted,1);assert.equal(f.topNavigations.length,0);assert.match(f.element('status').textContent,/หมดเวลา/);
}
console.log('PASS blocked auxiliary outcome and hung status remain recoverable without foreground localhost navigation');
