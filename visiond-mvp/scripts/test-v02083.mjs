import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fixture} from './test-v02072.mjs';
const source=readFileSync('public/tiktok-analyzer.js','utf8'),panel=source.split('\n').find(line=>line.includes('insertAdjacentHTML("afterend",\'<section id="analysisChannelPicker"'));
let html='';vm.runInNewContext(panel,{$:()=>({insertAdjacentHTML:(_,s)=>{html=s}})});
assert.doesNotMatch(html,/launcher-setup|data-open-channel-profile/,'ready panel must contain only refresh action');
assert.equal((html.match(/<button/g)||[]).length,1);assert.match(html,/data-refresh-profile/);
console.log('PASS v83 ready controls only refresh (v86 placement inside channel picker)');
assert.doesNotMatch(source,/เริ่มคำขอที่เลือก|กดปุ่มด้านล่างเพื่อทำขั้นตอนที่เลือก/);
assert.match(source,/connectionActionStatus\(control,launcherOAuthStage\(result\)\+' · ยังเก็บคำขอเดิมไว้/);
assert.match(source,/if\(!helper\)\{helperRecoveryStatus\(control,launcherRegisteredMessage\(\)\)/);
const tick=()=>new Promise(r=>setImmediate(r));
for(const status of ['pending','claimed','unknown','process_started','failed','cancelled']){
 const f=fixture(),first=f.s.run('shop');await tick();f.reply(f.pending[0]);await first;const before=f.s.selected;
 f.s.state={selected:before};f.s.loadChannels=async()=>{};f.s.browserProfileUuid=/^[a-f0-9-]+$/;
 vm.runInContext('let profileRefreshRequest=null;'+source.slice(source.indexOf('const refreshProfileStatus='),source.indexOf('$("[data-refresh-profile]")?.addEventListener'))+';this.refresh=refreshProfileStatus;',f.s);
 const refresh=f.s.refresh();await tick();f.reply(f.pending[1],{status,expired:true});await refresh;
 assert.equal(f.s.requests.size,0,'expired '+status+' clears exact pending during refresh');assert.equal(f.s.state.selected,before);assert.equal(f.statuses.at(-1)[0],'คำขอหมดอายุแล้ว');
 const next=f.s.run('shop');assert.equal(f.opened.length,2,'next explicit Shop action starts fresh without intermediate button');await tick();f.reply(f.pending[2]);await next;
}
for(const status of ['pending','claimed','unknown','process_started']){
 const f=fixture(),first=f.s.run('shop');await tick();f.reply(f.pending[0]);await first;
 f.s.state={selected:f.s.selected};f.s.loadChannels=async()=>{};f.s.browserProfileUuid=/^[a-f0-9-]+$/;
 vm.runInContext('let profileRefreshRequest=null;'+source.slice(source.indexOf('const refreshProfileStatus='),source.indexOf('$("[data-refresh-profile]")?.addEventListener'))+';this.refresh=refreshProfileStatus;',f.s);
 const refresh=f.s.refresh();await tick();f.reply(f.pending[1],{status});await refresh;assert.equal(f.s.requests.size,1,'live/uncertain request remains protected');assert.equal(f.opened.length,1);
}
const label={textContent:''};vm.runInNewContext(source.slice(source.indexOf('function updateBrowserProfilePanel()'),source.indexOf('const tiktokShopNavigation ='))+';updateBrowserProfilePanel();',{$:()=>label,selectedChannel:()=>({name:'ช่องล่าง'})});assert.equal(label.textContent,'โปรไฟล์ของช่อง ช่องล่าง');assert.doesNotMatch(label.textContent,/เข้าสู่|กดเชื่อม/);
console.log('PASS v83 expired status-first cleanup, next explicit Shop, active/unknown retention');
