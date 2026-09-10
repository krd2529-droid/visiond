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
for(const hash of ['#command_id='+id+'&provider=tiktok&intent=new&channel_id=','#command_id='+id]){
 let requests=0,navigations=0;const tasks=[];
 const ctx={URLSearchParams,Date,AbortController,document:{getElementById:()=>({textContent:''})},history:{replaceState(){}},location:{hash,pathname:'/launcher-open.html',replace(){navigations++}},window:{addEventListener(){},close(){}},setTimeout:(fn,ms)=>{const t={fn,ms};tasks.push(t);return t},clearTimeout:t=>{const i=tasks.indexOf(t);if(i>=0)tasks.splice(i,1)},fetch:async(url,options)=>{requests++;assert.match(url,/^\/api\/launcher\/status\?/);assert.equal(options.method,undefined);return {ok:true,json:async()=>({status:'waiting'})}}};
 vm.runInNewContext(bootstrap,ctx);for(let i=0;i<10;i++){await new Promise(resolve=>setImmediate(resolve));const task=tasks.shift();if(task)task.fn()}
 assert.equal(navigations,0,'hostile standalone fragment cannot dispatch');assert.ok(requests<=8,'read-only bounded lookup never issues');
}
console.log('PASS hostile legacy/random bootstrap fragments cannot create or dispatch commands');
for(const bodyHung of [false,true]){
 const tasks=[],message={textContent:''};let aborted=false,navigations=0;
 const ctx={URLSearchParams,Date,AbortController,document:{getElementById:()=>message},history:{replaceState(){}},location:{hash:'#command_id='+id,pathname:'/launcher-open.html',replace(){navigations++}},window:{addEventListener(){},close(){}},setTimeout:(fn,ms)=>{const t={fn,ms};tasks.push(t);return t},clearTimeout:t=>{const i=tasks.indexOf(t);if(i>=0)tasks.splice(i,1)},fetch:async(url,{signal})=>{signal.addEventListener('abort',()=>aborted=true);return bodyHung?{ok:true,json:()=>new Promise(()=>{})}:new Promise(()=>{})}};
 vm.runInNewContext(bootstrap,ctx);await new Promise(resolve=>setImmediate(resolve));assert.equal(tasks[0].ms,5000);tasks.shift().fn();await new Promise(resolve=>setImmediate(resolve));assert.equal(aborted,true);assert.equal(navigations,0);assert.match(message.textContent,/หมดเวลา/);
}
console.log('PASS bootstrap hung headers/body abort at a hard deadline without dispatch');
for(const readyAt of [9000,Infinity]){
 const tasks=[],destinations=[],readTimes=[],message={textContent:''};let now=0;
 const ctx={URLSearchParams,AbortController,Date:{now:()=>now},document:{getElementById:()=>message},history:{replaceState(){}},location:{hash:'#command_id='+id,pathname:'/launcher-open.html',replace:url=>destinations.push(url)},window:{addEventListener(){},close(){}},setTimeout:(fn,ms)=>{const task={fn,at:now+ms};tasks.push(task);return task},clearTimeout:task=>{const index=tasks.indexOf(task);if(index>=0)tasks.splice(index,1)},fetch:async(url,options)=>{assert.match(url,/^\/api\/launcher\/status\?/);assert.equal(options.method,undefined);readTimes.push(now);return{ok:true,json:async()=>now<readyAt?{status:'waiting'}:{status:'pending',command_id:id,port:53179,expired:0}}}};
 vm.runInNewContext(bootstrap,ctx);
 for(let step=0;step<24;step++){await new Promise(resolve=>setImmediate(resolve));tasks.sort((a,b)=>a.at-b.at);const task=tasks.shift();if(!task)break;now=task.at;task.fn()}
 assert.ok(readTimes.length<=8);assert.ok(readTimes.every(time=>time<25000));
 if(readyAt===9000){assert.deepEqual(destinations,['http://127.0.0.1:53179/launch?command_id='+id]);assert.equal(readTimes.at(-1),10000,'valid 4.5s helper + 4.5s issue result dispatches on next bounded read');assert.equal(message.textContent,'')}
 else{assert.equal(readTimes.length,8);assert.equal(destinations.length,0);assert.match(message.textContent,/ไม่พบคำขอ/)}
}
console.log('PASS virtual-clock 9s authorized command dispatches once; absent command stops within eight reads/25s');
