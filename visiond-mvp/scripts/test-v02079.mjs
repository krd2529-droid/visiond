import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fixture} from './test-v02072.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
function ui(f){const children=[],node={dataset:{},appendChild:n=>children.push(n),set textContent(v){this.text=v;children.length=0}},control={parentElement:{querySelector:()=>node},setAttribute(){},removeAttribute(){}};f.s.document={createElement:()=>({dataset:{},events:{},addEventListener(n,fn){this.events[n]=fn}})};const resumed=[];f.s.commandLauncher.resumeCommand=id=>resumed.push(id);return{children,node,control,resumed}}
// Exact original divergence: final LoginKit receipt must not keep Shop blocked.
{const f=fixture(),first=f.s.run('tiktok');await tick();f.reply(f.pending[0],{status:'process_started',oauth_status:'complete'});assert.equal(await first,true);assert.equal(f.s.requests.size,0);const shop=f.s.run('shop');assert.equal(f.opened.length,2);assert.equal(f.opened[1].provider,'shop');await tick();f.reply(f.pending[1]);assert.equal(await shop,true)}
for(const status of ['pending','claimed','process_started','unknown','failed','cancelled','waiting','expired','complete']){
 const f=fixture(),u=ui(f),first=f.s.run('tiktok',u.control);await tick();f.reply(f.pending[0]);await first;
 const original=[...f.s.requests.values()][0];assert.equal(original.provider,'tiktok');assert.equal(original.intent,'reconnect');
 const check=f.s.run('shop',u.control);await tick();assert.match(f.pending[1].url,/\/status\?/);f.reply(f.pending[1],{status:status==='complete'?'process_started':status==='expired'?'pending':status,oauth_status:status==='complete'?'complete':'issued',expired:status==='expired'});assert.equal(await check,false);assert.equal(f.opened.length,1,'reconciliation does not create new command');
 if(['failed','cancelled','expired','complete'].includes(status)){assert.equal(f.s.requests.size,0);const next=u.children.find(n=>n.textContent==='เชื่อม TikTok Shop ต่อ');assert.ok(next);next.events.click();assert.equal(f.opened.length,2);assert.equal(f.opened[1].provider,'shop');await tick();f.reply(f.pending.at(-1));await tick();continue}
 assert.equal(f.s.requests.size,1);
 const resume=u.children.find(n=>n.textContent==='เปิดคำขอเดิมต่อ');assert.equal(Boolean(resume),['pending','claimed'].includes(status));
 if(resume){resume.events.click();assert.deepEqual(u.resumed,[original.commandId]);assert.equal(f.opened.length,1);assert.equal(f.s.requests.size,1);await tick()}
 const inspect=u.children.find(n=>n.textContent==='ตรวจสถานะคำขอเดิม');
 if(inspect){inspect.events.click();await tick();assert.match(f.pending.at(-1).url,/\/status\?/);f.reply(f.pending.at(-1),{status:'unknown'});await tick()}
}
// Explicit cancellation is separate and backend refusal preserves uncertain work.
{const f=fixture(),u=ui(f),first=f.s.run('shop',u.control);await tick();f.reply(f.pending[0]);await first;const check=f.s.run('shop',u.control);await tick();f.reply(f.pending[1],{status:'waiting'});await check;u.children.find(n=>n.textContent==='ยกเลิกคำขอเดิม').events.click();await tick();assert.equal(f.pending[2].url,'/api/launcher/cancel');f.reply(f.pending[2],{},false);await tick();assert.equal(f.s.requests.size,1)}
// A's late complete cannot clear its saved request or overwrite a newer selected B.
{const f=fixture(),first=f.s.run('tiktok');await tick();f.reply(f.pending[0]);await first;const check=f.s.run('shop');await tick();f.s.selected='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';f.s.rev++;f.reply(f.pending[1],{status:'process_started',oauth_status:'complete'});await check;assert.equal(f.s.requests.size,1);assert.equal(f.opened.length,1)}
// Actual bridge reuses only the supplied UUID, synchronous noopener, no new UUID or payload.
{const w={},opens=[],id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';vm.runInNewContext(readFileSync('public/browser-profile-launcher.js','utf8'),{window:w,URLSearchParams});const b=w.createVisionDCommandLauncher({cryptoApi:{randomUUID(){assert.fail('resume cannot mint a new command')}},openWindow:(...a)=>opens.push(a)});assert.equal(b.resumeCommand(id),id);assert.match(opens[0][0],new RegExp('command_id='+id));assert.equal(opens[0][2],'noopener,noreferrer');assert.throws(()=>b.resumeCommand(id+'&ticket=bad'));assert.equal(opens.length,1)}
console.log('PASS v79 LoginKit complete→Shop, exact pending status/replay, terminal/unknown/waiting/cancel, stale A→B and synchronous same-ID bootstrap');
