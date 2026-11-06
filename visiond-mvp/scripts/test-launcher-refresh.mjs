import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('public/tiktok-analyzer.js','utf8');
const extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
const functions=extract('async function prepareLauncherReadiness(','function readLauncherStatus(')+extract('async function issueProfileOAuth(','function updateBrowserProfilePanel(');
const oldId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',newId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',otherId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const storage=new Map([['visiond_launcher_helper',newId]]),calls=[];
const context={
 pageViewerId:'2',pageAuthorized:true,launcherPageActive:true,pageWorkspaceDelegated:false,
 launcherReadiness:{owner:'2',helper:{id:oldId},items:[{id:oldId}],expires:Date.now()+30000,after:''},launcherReadinessRequest:null,
 profileOAuthRequests:new Set(),profileOAuthPendingKeys:new Set(),profileHandoffRequests:new Map(),profileControlAttempts:new Map(),profileOAuthPending:false,
 channelOwnership:{capture:()=>null,revision:()=>1,unchanged:()=>true,current:()=>true},commandLauncher:{openCommand:()=>newId},
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
 launcherFetch:async(path,options)=>{calls.push({path,body:options?.body&&JSON.parse(options.body)});if(path==='/api/launcher/helpers')return{ok:true,json:async()=>({items:[{id:otherId},{id:newId}],has_more:false})};if(path==='/api/tiktok/handoff')return{ok:true,json:async()=>({command_id:newId})};throw Error('unexpected path '+path)},
 readLauncherStatus:async()=>({ok:true,json:async()=>({status:'process_started'})}),renderLauncherChoices:()=>{},
 connectionActionStatus:()=>{},helperRecoveryStatus:()=>{},launcherRegisteredMessage:()=>'',launcherOAuthStage:()=>'',
 selectedChannel:()=>null,setTimeout,Date,Map,Set,JSON,Promise,
};
vm.createContext(context);vm.runInContext(functions,context);
assert.equal(await vm.runInContext("issueProfileOAuth('tiktok_new',null)",context),true);
assert.deepEqual(calls.map(call=>call.path),['/api/launcher/helpers','/api/tiktok/handoff']);
assert.equal(calls[1].body.helper_id,newId,'new command must use freshly selected helper, not old in-memory helper');
assert.equal(context.launcherReadiness.helper.id,newId);
console.log('PASS existing Analyzer tab refreshes bounded helper list before new-channel command and uses newly paired ID');
