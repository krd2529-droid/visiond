import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const script=readFileSync('public/launcher-pair.js','utf8'),A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',flush=()=>new Promise(r=>setImmediate(r));
assert.match(readFileSync('public/launcher-pair.html','utf8'),/id="retry" hidden disabled/,'no dead retry before script loads');
const setupPage=readFileSync('public/launcher-setup.html','utf8');assert.match(setupPage,/ต่ำกว่า 0\.20\.78 ต้องดาวน์โหลดและติดตั้งอัปเดต/);assert.match(setupPage,/รักษาโปรไฟล์และการผูกเดิม/);assert.doesNotMatch(setupPage,/0\.20\.73 ขึ้นไป/);
function fixture(hash=''){
 const nodes=new Map(),events={},pending=[],storage=new Map(),timers=[];
 const node=k=>{if(!nodes.has(k))nodes.set(k,{checked:false,events:{},addEventListener:(t,f)=>node(k).events[t]=f});return nodes.get(k)};
 const s={URLSearchParams,Date,AbortController,document:{getElementById:node},location:{hash,pathname:'/launcher-pair'},history:{replaceState(){s.location.hash=''}},sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},localStorage:{setItem(){}},window:{addEventListener:(t,f)=>events[t]=f,close(){}},setTimeout:(f,ms)=>{const t={f,ms};timers.push(t);return t},clearTimeout:t=>{const i=timers.indexOf(t);if(i>=0)timers.splice(i,1)},fetch:(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}))};
 vm.runInNewContext(script,s);return{s,node,pending,events,storage,hash:id=>{s.location.hash='#id='+id;events.hashchange()},reply:(i,body={},status=200)=>pending[i].resolve({ok:status===200,status,json:async()=>body})};
}
{
 const f=fixture();assert.match(f.node('status').textContent,/ไม่พบคำขอ/);assert.equal(f.node('retry').hidden,true,'missing request has no dead retry');assert.equal(f.node('retry').disabled,true);assert.equal(f.pending.length,0);f.hash(A);assert.equal(f.pending[0].url,'/api/auth/me');assert.equal(f.node('retry').hidden,false);assert.equal(f.node('retry').disabled,true,'active check cannot duplicate');f.reply(0);await flush();f.reply(1,{pair_code:'CODE-A',confirm_nonce:'n'});await flush();assert.equal(f.node('retry').disabled,false,'valid prepared request remains retryable');f.node('match').checked=true;f.node('match').events.change();assert.equal(f.node('confirm').disabled,false);
 f.hash(A);assert.equal(f.pending.length,2,'duplicate current hash does not reprepare/reset approval');assert.equal(f.node('match').checked,true);
 f.hash(B+'&extra=1');assert.equal(f.pending.length,2,'extra fragment rejected without poisoning current');assert.match(f.node('code').textContent,/CODE-A/);
 f.hash(B+'%0A');assert.equal(f.pending.length,2,'trailing newline is not a canonical UUID');
}
for(const stage of ['auth','prepare'])for(const lateStatus of [200,409]){
 const f=fixture('#id='+A);if(stage==='prepare'){f.reply(0);await flush();}const old=f.pending.length-1;f.hash(B);assert.equal(f.node('match').checked,false);const auth=f.pending.length-1;f.reply(auth);await flush();const prep=f.pending.length-1;assert.equal(JSON.parse(f.pending[prep].options.body).pair_id,B);f.reply(prep,{pair_code:'CODE-B',confirm_nonce:'b'});await flush();f.reply(old,{pair_code:'STALE-A',confirm_nonce:'a'},lateStatus);await flush();assert.match(f.node('code').textContent,/CODE-B/);assert.doesNotMatch(f.node('status').textContent,/หมดอายุ/);assert.equal(f.pending.length,stage==='auth'?3:4,'stale auth cannot start another prepare');
}
{
 const f=fixture('#id='+A);f.reply(0);await flush();f.reply(1,{},409);await flush();assert.match(f.node('status').textContent,/คำขอใหม่/);assert.equal(f.node('retry').hidden,true);await f.node('retry').events.click();assert.equal(f.pending.length,2);assert.doesNotMatch(f.node('status').textContent,/ไม่พบคำขอ/);assert.equal(f.storage.size,0);f.hash(B);assert.equal(f.pending.length,3,'explicit new hash starts fresh authenticated lifecycle');
}
{
 const f=fixture('#id='+A);f.reply(0);await flush();f.reply(1,{pair_code:'CODE-A',confirm_nonce:'a'});await flush();f.node('match').checked=true;const confirmation=f.node('confirm').events.click();f.hash(B);assert.equal(f.pending.length,3,'late hash cannot replace confirming request');assert.equal(JSON.parse(f.pending[2].options.body).pair_id,A);f.reply(2,{helper_id:A});await confirmation;f.hash(B);assert.equal(f.pending.length,3,'completed page cannot silently start another pair');
}
{
 const f=fixture();for(let i=1;i<=9;i++)f.hash(String(i).repeat(8)+'-aaaa-4aaa-8aaa-aaaaaaaaaaaa');assert.equal(f.pending.length,8,'bounded arrival budget');await flush();
 const old=fixture();old.s.Date={now:()=>Date.now()+300001};old.hash(A);assert.equal(old.pending.length,0,'five-minute acceptance boundary');
}
console.log('PASS missing→late hash, strict/duplicate/bounded hash, stale auth/prepare success/error, expired/new lifecycle and confirming/done ownership');
const work=mkdtempSync(join(tmpdir(),'visiond-pair-url-'));try{
 const exe=join(work,'PairUrlHarness.exe');execFileSync(join(process.env.WINDIR||'C:\\Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe'),['/nologo','/target:exe','/main:PairUrlHarness','/r:System.Security.dll','/r:System.Web.Extensions.dll','/r:System.Windows.Forms.dll','/r:System.Drawing.dll','/r:System.Management.dll','/out:'+exe,'tools\\browser-launcher\\Launcher.cs','tools\\browser-launcher\\Setup.cs','scripts\\fixtures\\PairUrlHarness.cs'],{stdio:'inherit'});console.log(execFileSync(exe,[],{encoding:'utf8',timeout:5000}).trim());
}finally{rmSync(work,{recursive:true,force:true})}
