import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {env} from './test-vtools-access.mjs';
import vpageService from '../services/vpage/src/index.js';
import {onRequestPost as checkout} from '../functions/api/orders/index.js';
import {onRequestPost as uploadSlip} from '../functions/api/orders/[id]/slip.js';
import {onRequestGet as credits} from '../functions/api/vpage/credits.js';
import {onRequestGet as availability} from '../functions/api/vpage/availability.js';
import {onRequestGet as listPages,onRequestPost as createPage} from '../functions/api/vpage/pages/index.js';
import {onRequestGet as ownerEditor} from '../functions/api/vpage/pages/[id]/editor.js';
import {onRequestPut as ownerSave} from '../functions/api/vpage/pages/[id]/content-sets/[set].js';
import {onRequestPost as ownerSwitch} from '../functions/api/vpage/pages/[id]/active-set.js';
import {onRequestPost as ownerRenew} from '../functions/api/vpage/pages/[id]/renew.js';
import {onRequestGet as bossEditor} from '../functions/api/admin/vpage/pages/[id]/editor.js';
import {onRequestPut as bossSave} from '../functions/api/admin/vpage/pages/[id]/content-sets/[set].js';
import {onRequestPost as bossSwitch} from '../functions/api/admin/vpage/pages/[id]/active-set.js';
import {vpageOwnerRef} from '../functions/_vpage-provisioning.js';

class BoundStatement{
  constructor(sqlite,sql){this.sqlite=sqlite;this.sql=sql;this.args=[]}
  bind(...args){this.args=args;return this}
  async first(){return this.sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return{results:this.sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const result=this.sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const d1=sqlite=>({
  prepare(sql){return new BoundStatement(sqlite,sql)},
  async exec(sql){sqlite.exec(sql)},
  async batch(statements){
    sqlite.exec('BEGIN');
    try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results}
    catch(error){sqlite.exec('ROLLBACK');throw error}
  }
});

for(const migration of ['0123_vpage_credit_purchase.sql','0124_vpage_provisioning.sql','0125_vpage_editor.sql','0126_vpage_renewal.sql','0127_vpage_media.sql']){
  await env.DB.exec(await readFile(new URL(`../migrations/${migration}`,import.meta.url),'utf8'));
}
for(const user of [
  [20,'flow-owner@example.invalid','Flow Owner','customer','flow-owner'],
  [21,'flow-other@example.invalid','Flow Other','customer','flow-other'],
  [22,'flow-admin@example.invalid','Flow Admin','admin','flow-admin'],
  [23,'flow-boss@example.invalid','Flow Boss','boss','flow-boss']
]){
  await env.DB.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(?,?,?,'test',?)").bind(...user.slice(0,4)).run();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").bind(user[4],user[0]).run();
}
await env.DB.prepare("INSERT INTO settings(key,value) VALUES('vision3_auto_verify','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
env.EASYSLIP_API_KEY='synthetic-local-key-never-sent';
env.FILES={...env.FILES,async put(){}};

const serviceSqlite=new DatabaseSync(':memory:');
serviceSqlite.exec('PRAGMA foreign_keys=ON;');
for(const migration of ['0001_vpage_service.sql','0002_vpage_editor.sql','0003_vpage_multi_items.sql']){
  serviceSqlite.exec(await readFile(new URL(`../services/vpage/migrations/${migration}`,import.meta.url),'utf8'));
}
const secret='domain-one-e2e-secret-at-least-32-characters';
const keyId='visiond-main-v1';
const serviceEnv={VPAGE_DB:d1(serviceSqlite),VPAGE_SHARED_SECRET:secret,VPAGE_KEY_ID:keyId};
Object.assign(env,{VPAGE_API_BASE:'https://vpage.local',VPAGE_SHARED_SECRET:secret,VPAGE_KEY_ID:keyId});

const sessionByUser={20:'flow-owner',21:'flow-other',22:'flow-admin',23:'flow-boss'};
const context=(path,{userId=20,method='GET',body,key,params={},ip=`192.0.2.${userId}`}={})=>({
  env,
  params,
  request:new Request(`https://visiondonline.test${path}`,{
    method,
    headers:{cookie:`vd_session=${sessionByUser[userId]}`,'cf-connecting-ip':ip,...(body&&!((body instanceof FormData))?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},
    body:body instanceof FormData?body:body===undefined?undefined:JSON.stringify(body)
  })
});
const readJson=async response=>({status:response.status,data:await response.json(),headers:response.headers});
const count=async(sql,...args)=>Number((await env.DB.prepare(sql).bind(...args).first()).count);

const nativeFetch=globalThis.fetch;
let providerCalls=0,activePaymentOrderId=0,renewFailure='',renewRemoteCalls=0,resumeRemoteCalls=0;
globalThis.fetch=async(url,init={})=>{
  const target=String(url);
  if(target==='https://api.easyslip.com/v2/verify/bank'){
    providerCalls++;
    assert.equal(init.headers.authorization,'Bearer synthetic-local-key-never-sent');
    assert.equal(init.body.get('matchAmount'),'999.00');
    assert.equal(init.body.get('matchAccount'),'true');
    assert.equal(init.body.get('checkDuplicate'),'true');
    const order=await env.DB.prepare('SELECT payment_account_name,payment_account_number FROM orders WHERE id=?').bind(activePaymentOrderId).first();
    return Response.json({success:true,data:{rawSlip:{transRef:`domain-one-flow-${providerCalls}`},amountInSlip:999,isAmountMatched:true,isDuplicate:false,matchedAccount:{nameTh:order.payment_account_name,bankNumber:order.payment_account_number}}});
  }
  if(target.startsWith('https://vpage.local/')){
    const request=new Request(url,init),pathname=new URL(request.url).pathname,isRenew=request.method==='POST'&&pathname.endsWith('/renew'),isResume=request.method==='POST'&&pathname.endsWith('/resume');
    if(isRenew){renewRemoteCalls++;if(renewFailure==='definitive')return Response.json({error:'definitive renewal rejection',code:'VPAGE_RENEWAL_REJECTED'},{status:409});if(renewFailure==='before')throw new Error('simulated renewal timeout before remote commit')}
    if(isResume){resumeRemoteCalls++;if(renewFailure==='resume-definitive')return Response.json({error:'simulated resume denial after committed renewal',code:'VPAGE_RESUME_DENIED'},{status:409});if(renewFailure==='resume-5xx')return Response.json({error:'simulated resume service failure',code:'VPAGE_RESUME_FAILED'},{status:503});if(renewFailure==='resume-timeout')throw new Error('simulated resume timeout after committed renewal');if(renewFailure==='resume-malformed')return Response.json({item:{id:pathname.split('/').at(-2),status:'active',expires_at:'not-a-date'}})}
    const response=await vpageService.fetch(request,serviceEnv);
    if(isRenew&&renewFailure==='after')throw new Error('simulated renewal response loss after remote commit');
    if(isRenew&&renewFailure==='in-progress')return Response.json({error:'simulated concurrent renewal committed without visible response',code:'VPAGE_IDEMPOTENCY_IN_PROGRESS'},{status:409});
    return response;
  }
  return nativeFetch(url,init);
};

let purchaseAttempt=0;
async function purchase(userId){
  const ip=`198.51.100.${++purchaseAttempt}`;
  const orderResponse=await readJson(await checkout(context('/api/orders',{userId,method:'POST',body:{productSlugs:['vpage-credit'],quantities:{'vpage-credit':1}}})));
  assert.equal(orderResponse.status,201,JSON.stringify(orderResponse.data));
  assert.equal(orderResponse.data.total,99900,'the integrated purchase remains exactly THB 999');
  activePaymentOrderId=orderResponse.data.id;
  const slip=new FormData();
  slip.set('slip',new File(['synthetic-vpage-slip'],'synthetic-slip.png',{type:'image/png'}));
  const paid=await readJson(await uploadSlip(context(`/api/orders/${orderResponse.data.id}/slip`,{userId,method:'POST',body:slip,params:{id:String(orderResponse.data.id)},ip})));
  assert.equal(paid.status,200);
  assert.equal(paid.data.auto_approved,true,`synthetic EasySlip result grants the credit without manual approval: ${JSON.stringify(paid.data)}`);
  assert.equal(await count('SELECT COUNT(*) count FROM vpage_credits WHERE order_id=?',orderResponse.data.id),1);
  return orderResponse.data;
}

const encoder=new TextEncoder();
const hex=value=>[...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
async function signedLifecycle(action,pageId,ownerRef,key){
  const path=`/api/v1/pages/${pageId}/${action}`,raw='{}',timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID().replaceAll('-','');
  const canonical=['vpage-v1','POST',path,keyId,timestamp,nonce,ownerRef,await digest(raw)].join('\n');
  const cryptoKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=hex(await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(canonical)));
  return readJson(await vpageService.fetch(new Request(`https://vpage.local${path}`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':key,'x-vpage-key-id':keyId,'x-vpage-timestamp':timestamp,'x-vpage-nonce':nonce,'x-vpage-owner-ref':ownerRef,'x-vpage-signature':signature},body:raw}),serviceEnv));
}

const content=(label,{youtube='',itemImages=false}={})=>({
  expected_revision:0,
  product_image_url:`https://images.example/${label}-hero.jpg`,
  detail_text:`รายละเอียด ${label}`,
  text_size:'medium',
  text_style:'normal',
  youtube_url:youtube,
  background_image_url:`https://images.example/${label}-background.jpg`,
  product_items:[
    {destination_url:`https://shop.example/${label}-one`,image_url:itemImages?`https://images.example/${label}-one.jpg`:''},
    {destination_url:`https://shop.example/${label}-two`,image_url:''}
  ],
  contact_items:[
    {contact_type:'facebook',destination_url:`https://facebook.com/${label}.page`,image_url:itemImages?`https://images.example/${label}-facebook.jpg`:''},
    {contact_type:'line',destination_url:`https://line.me/R/ti/p/@${label}`,image_url:''}
  ]
});

try{
  const ownerOrder=await purchase(20);
  let ledger=await readJson(await credits(context('/api/vpage/credits')));
  assert.equal(ledger.status,200);
  assert.equal(ledger.data.balance,1,'one approved order yields exactly one available credit');

  const replaySlip=new FormData();
  replaySlip.set('slip',new File(['synthetic-vpage-slip'],'synthetic-slip.png',{type:'image/png'}));
  const replayPaid=await readJson(await uploadSlip(context(`/api/orders/${ownerOrder.id}/slip`,{method:'POST',body:replaySlip,params:{id:String(ownerOrder.id)}})));
  assert.equal(replayPaid.data.auto_approved,true);
  assert.equal(providerCalls,1,'paid slip replay never calls EasySlip or grants again');
  assert.equal(await count('SELECT COUNT(*) count FROM vpage_credits WHERE order_id=?',ownerOrder.id),1);

  const available=await readJson(await availability(context('/api/vpage/availability?domain_id=dom_smartlinkpage&slug=domain-one-shop')));
  assert.equal(available.status,200);
  assert.equal(available.data.available,true);
  const createBody={domain_id:'dom_smartlinkpage',slug:'domain-one-shop',display_name:'ร้าน Domain One'};
  const created=await readJson(await createPage(context('/api/vpage/pages',{method:'POST',body:createBody,key:'domain-one-create-0000000000000001'})));
  assert.equal(created.status,201,JSON.stringify(created.data));
  assert.equal(created.data.item.public_url,'https://smartlinkpage.com/domain-one-shop');
  const localId=created.data.item.id;
  const remoteId=created.data.item.vpage_id;
  ledger=await readJson(await credits(context('/api/vpage/credits')));
  assert.equal(ledger.data.balance,0);
  assert.equal(ledger.data.items[0].status,'consumed');
  assert.equal(await count('SELECT COUNT(*) count FROM vpage_pages WHERE user_id=20'),1);
  assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='domain-one-shop'").get().count,1);

  const createReplay=await readJson(await createPage(context('/api/vpage/pages',{method:'POST',body:createBody,key:'domain-one-create-0000000000000001'})));
  assert.equal(createReplay.status,200);
  assert.equal(createReplay.data.replayed,true);
  assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='domain-one-shop'").get().count,1);

  await purchase(21);
  const duplicateSlug=await readJson(await createPage(context('/api/vpage/pages',{userId:21,method:'POST',body:{...createBody,display_name:'ร้านอื่น'},key:'domain-one-create-other-00000001'})));
  assert.equal(duplicateSlug.status,409);
  assert.equal(duplicateSlug.data.code,'VPAGE_SLUG_CONFLICT');
  assert.equal((await env.DB.prepare('SELECT status FROM vpage_credits WHERE user_id=21').first()).status,'available','duplicate slug retains the other owner credit');
  assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='domain-one-shop'").get().count,1);

  const initialEditor=await readJson(await ownerEditor(context(`/api/vpage/pages/${localId}/editor`,{params:{id:localId}})));
  assert.equal(initialEditor.status,200);
  assert.equal(initialEditor.data.item.display_name,'ร้าน Domain One');
  assert.equal(initialEditor.data.item.content_sets.length,2);
  const setOne=content('set-one',{youtube:'https://www.youtube.com/watch?v=abcdefghijk',itemImages:true});
  const setTwo=content('set-two');
  const savedOne=await readJson(await ownerSave(context(`/api/vpage/pages/${localId}/content-sets/1`,{method:'PUT',body:setOne,key:'domain-one-save-set-one-000001',params:{id:localId,set:'1'}})));
  const savedTwo=await readJson(await ownerSave(context(`/api/vpage/pages/${localId}/content-sets/2`,{method:'PUT',body:setTwo,key:'domain-one-save-set-two-000002',params:{id:localId,set:'2'}})));
  assert.deepEqual([savedOne.status,savedTwo.status],[200,200]);
  assert.deepEqual(savedTwo.data.item.product_items.map(item=>item.destination_url),setTwo.product_items.map(item=>item.destination_url));
  assert.deepEqual(savedTwo.data.item.contact_items.map(item=>item.contact_type),['facebook','line']);

  const ownerSwitched=await readJson(await ownerSwitch(context(`/api/vpage/pages/${localId}/active-set`,{method:'POST',body:{active_set:2},key:'domain-one-owner-switch-000001',params:{id:localId}})));
  assert.equal(ownerSwitched.status,200);
  assert.equal(ownerSwitched.data.item.active_set,2);
  let publicResponse=await vpageService.fetch(new Request('https://smartlinkpage.com/domain-one-shop'),serviceEnv);
  let publicHtml=await publicResponse.text();
  assert.equal(publicResponse.status,200);
  assert.match(publicHtml,/รายละเอียด set-two/);
  assert.doesNotMatch(publicHtml,/รายละเอียด set-one/);
  assert.doesNotMatch(publicHtml,/<iframe|class="video"/,'empty YouTube has no public DOM or accessibility node');
  assert.equal((publicHtml.match(/class="item-card"/g)||[]).length,4);
  assert.equal((publicHtml.match(/class="item-card"[^>]*>[\s\S]*?<img/g)||[]).length,0,'omitted item images create no item image node');

  assert.equal((await readJson(await ownerEditor(context(`/api/vpage/pages/${localId}/editor`,{userId:21,params:{id:localId}})))).status,404,'cross-owner read is non-enumerating');
  assert.equal((await readJson(await bossEditor(context(`/api/admin/vpage/pages/${localId}/editor`,{userId:22,params:{id:localId}})))).status,403,'admin is not Boss');
  const bossLoaded=await readJson(await bossEditor(context(`/api/admin/vpage/pages/${localId}/editor`,{userId:23,params:{id:localId}})));
  assert.equal(bossLoaded.status,200);
  assert.equal(bossLoaded.data.item.content_sets[0].detail_text,'รายละเอียด set-one');
  const bossSetOne={...setOne,expected_revision:savedOne.data.item.revision,detail_text:'รายละเอียด Boss ชุดหนึ่ง'};
  const bossSaved=await readJson(await bossSave(context(`/api/admin/vpage/pages/${localId}/content-sets/1`,{userId:23,method:'PUT',body:bossSetOne,key:'domain-one-boss-save-0000001',params:{id:localId,set:'1'}})));
  assert.equal(bossSaved.status,200);
  const bossSwitched=await readJson(await bossSwitch(context(`/api/admin/vpage/pages/${localId}/active-set`,{userId:23,method:'POST',body:{active_set:1},key:'domain-one-boss-switch-00001',params:{id:localId}})));
  assert.equal(bossSwitched.status,200);
  assert.equal(bossSwitched.data.item.active_set,1);
  publicResponse=await vpageService.fetch(new Request('https://smartlinkpage.com/domain-one-shop'),serviceEnv);
  publicHtml=await publicResponse.text();
  assert.match(publicHtml,/รายละเอียด Boss ชุดหนึ่ง/);
  assert.match(publicHtml,/youtube-nocookie\.com\/embed\/abcdefghijk/);
  assert.match(publicHtml,/ร้าน Domain One/);
  assert.equal(bossSwitched.data.item.slug,'domain-one-shop');
  assert.equal(bossSwitched.data.item.public_url,'https://smartlinkpage.com/domain-one-shop');

  const ownerRef=await vpageOwnerRef(20);
  serviceSqlite.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").run(remoteId);
  await env.DB.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").bind(localId).run();
  assert.equal((await vpageService.fetch(new Request('https://smartlinkpage.com/domain-one-shop'),serviceEnv)).status,404,'expiry removes the public page');
  assert.equal((await readJson(await ownerEditor(context(`/api/vpage/pages/${localId}/editor`,{params:{id:localId}})))).status,404,'expiry removes owner edit access');
  let expiredList=await readJson(await listPages(context('/api/vpage/pages?limit=24')));
  assert.equal(expiredList.data.items[0].lifecycle_status,'expired','VisionD reports an expired state instead of active');
  await purchase(20);
  const renewalKey='domain-one-owner-renew-0000001';
  const renewed=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:renewalKey,params:{id:localId}})));
  assert.equal(renewed.status,200,JSON.stringify(renewed.data));
  assert.equal(renewed.data.item.status,'active');
  assert.equal(renewed.data.item.lifecycle_status,'active');
  assert.ok(new Date(renewed.data.item.expires_at)>new Date());
  assert.ok(Math.abs((new Date(renewed.data.item.expires_at).getTime()-Date.now())-30*86400000)<5000,'expired renewal grants exactly 30 days from confirmation time');
  assert.equal(await count("SELECT COUNT(*) count FROM vpage_credits WHERE user_id=20 AND status='consumed'"),2,'renewal consumes exactly one additional credit');
  const renewedReplay=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:renewalKey,params:{id:localId}})));
  assert.equal(renewedReplay.status,200);
  assert.equal(renewedReplay.data.replayed,true);
  assert.equal(renewedReplay.data.item.expires_at,renewed.data.item.expires_at,'owner renewal replay cannot extend twice');
  assert.equal(await count("SELECT COUNT(*) count FROM vpage_credits WHERE user_id=20 AND status='consumed'"),2,'owner renewal replay cannot consume twice');
  assert.equal((await vpageService.fetch(new Request('https://smartlinkpage.com/domain-one-shop'),serviceEnv)).status,200,'renewal restores public access');
  assert.equal((await readJson(await ownerEditor(context(`/api/vpage/pages/${localId}/editor`,{params:{id:localId}})))).status,200,'renewal restores edit access');

  const suspended=await signedLifecycle('suspend',remoteId,ownerRef,'domain-one-suspend-000001');
  assert.equal(suspended.status,200);
  await env.DB.prepare("UPDATE vpage_pages SET status='suspended' WHERE id=?").bind(localId).run();
  expiredList=await readJson(await listPages(context('/api/vpage/pages?limit=24')));
  assert.equal(expiredList.data.items[0].lifecycle_status,'suspended');
  await purchase(20);const suspendedExpiry=serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at;
  const resumedByRenewal=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-suspended-renew-001',params:{id:localId}})));
  assert.equal(resumedByRenewal.status,200);
  assert.equal(resumedByRenewal.data.item.status,'active','renewing a suspended page resumes it server-side');
  assert.equal(new Date(resumedByRenewal.data.item.expires_at).getTime()-new Date(suspendedExpiry).getTime(),30*86400000,'suspended renewal extends the existing term by exactly 30 days');
  assert.equal((await vpageService.fetch(new Request('https://smartlinkpage.com/domain-one-shop'),serviceEnv)).status,200);
  assert.equal(await count("SELECT COUNT(*) count FROM vpage_credits WHERE user_id=20 AND status='consumed'"),3);

  const suspendedAgain=await signedLifecycle('suspend',remoteId,ownerRef,'domain-one-suspend-resume-failure');
  assert.equal(suspendedAgain.status,200);await env.DB.prepare("UPDATE vpage_pages SET status='suspended' WHERE id=?").bind(localId).run();await purchase(20);
  const beforeResumeFailure=serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at;renewFailure='resume-definitive';
  const resumeFailed=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-resume-failure-renew',params:{id:localId}})));
  assert.equal(resumeFailed.status,202,'renew success followed by resume rejection is an ambiguous partial commit');assert.equal(resumeFailed.data.code,'VPAGE_RENEWAL_REPAIR_REQUIRED');
  const committedBeforeResume=serviceSqlite.prepare('SELECT expires_at,status FROM vpage_pages WHERE id=?').get(remoteId);assert.notEqual(committedBeforeResume.expires_at,beforeResumeFailure,'remote renewal already extended the term');assert.equal(committedBeforeResume.status,'suspended');
  const storedResumeFailure=await env.DB.prepare("SELECT state,remote_status,remote_expires_at FROM vpage_renewal_requests WHERE idempotency_key='domain-one-resume-failure-renew'").first();assert.deepEqual({state:storedResumeFailure.state,remote_status:storedResumeFailure.remote_status,remote_expires_at:storedResumeFailure.remote_expires_at},{state:'remote_committed',remote_status:'suspended',remote_expires_at:committedBeforeResume.expires_at},'partial commit persists the confirmed renewal and keeps only resume repair pending');
  const localResumeFailure=await env.DB.prepare('SELECT status,expires_at,last_error_code FROM vpage_pages WHERE id=?').bind(localId).first();assert.deepEqual({status:localResumeFailure.status,expires_at:localResumeFailure.expires_at,last_error_code:localResumeFailure.last_error_code},{status:'suspended',expires_at:committedBeforeResume.expires_at,last_error_code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},'local page truthfully persists the confirmed term while remaining suspended');
  assert.equal((await readJson(await credits(context('/api/vpage/credits')))).data.balance,0,'partial commit never releases the held credit');
  const renewCallsAfterConfirmed=renewRemoteCalls;
  for(const mode of ['resume-5xx','resume-timeout','resume-malformed']){renewFailure=mode;const stillPending=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',params:{id:localId}})));assert.equal(stillPending.status,202,`${mode} remains repairable`);assert.equal(stillPending.data.code,'VPAGE_RENEWAL_REPAIR_REQUIRED');const persisted=await env.DB.prepare("SELECT state,remote_status,remote_expires_at FROM vpage_renewal_requests WHERE idempotency_key='domain-one-resume-failure-renew'").first();assert.deepEqual({state:persisted.state,remote_status:persisted.remote_status,remote_expires_at:persisted.remote_expires_at},{state:'remote_committed',remote_status:'suspended',remote_expires_at:committedBeforeResume.expires_at});assert.equal((await readJson(await credits(context('/api/vpage/credits')))).data.balance,0);assert.equal(renewRemoteCalls,renewCallsAfterConfirmed,'resume repair never repeats the confirmed renewal')}
  renewFailure='';const callsBeforeResumeRepair=renewRemoteCalls,resumeCallsBeforeRepair=resumeRemoteCalls,resumeRepaired=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',params:{id:localId}})));
  assert.equal(resumeRepaired.status,200);assert.equal(serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at,committedBeforeResume.expires_at,'repair resumes without a second extension');assert.equal(renewRemoteCalls,callsBeforeResumeRepair,'confirmed renewal repair never calls renew again');assert.equal(resumeRemoteCalls,resumeCallsBeforeRepair+1);assert.equal(await count("SELECT COUNT(*) count FROM vpage_credits WHERE user_id=20 AND status='consumed'"),4,'repair consumes the one held credit exactly once');

  serviceSqlite.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").run(remoteId);
  await env.DB.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").bind(localId).run();
  const noCredit=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-no-credit-renew-01',params:{id:localId}})));
  assert.equal(noCredit.status,409);
  assert.equal(noCredit.data.code,'VPAGE_CREDIT_REQUIRED');
  const forgedRenewal=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',body:{credit_id:999,status:'active',expires_at:'2099-01-01'},key:'domain-one-forged-renew-001',params:{id:localId}})));
  assert.equal(forgedRenewal.status,400);assert.equal(forgedRenewal.data.code,'VPAGE_RENEWAL_BODY_FORBIDDEN','renewal never trusts browser credit, status or expiry fields');
  assert.equal((await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{userId:21,method:'POST',key:'domain-one-cross-owner-renew',params:{id:localId}})))).status,404);
  assert.equal((await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{userId:22,method:'POST',key:'domain-one-admin-renew-0001',params:{id:localId}})))).status,404,'admin is not the owning customer');

  await purchase(20);renewFailure='definitive';
  const rejected=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-definitive-renew',params:{id:localId}})));
  assert.equal(rejected.status,409);assert.equal(rejected.data.code,'VPAGE_RENEWAL_REJECTED');
  assert.equal((await env.DB.prepare("SELECT status FROM vpage_credits WHERE user_id=20 ORDER BY id DESC LIMIT 1").first()).status,'available','definitive remote rejection releases the credit');
  assert.equal((await env.DB.prepare("SELECT state FROM vpage_renewal_requests WHERE idempotency_key='domain-one-definitive-renew'").first()).state,'released');

  renewFailure='before';
  const uncertain=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-timeout-renew-001',params:{id:localId}})));
  assert.equal(uncertain.status,202);assert.equal(uncertain.data.code,'VPAGE_RENEWAL_REPAIR_REQUIRED');
  const heldLedger=await readJson(await credits(context('/api/vpage/credits')));
  assert.equal(heldLedger.data.balance,0,'ambiguous renewal holds rather than spends or exposes the credit');
  assert.equal(heldLedger.data.items[0].status,'renewing');
  renewFailure='';const recovered=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',params:{id:localId}})));
  assert.equal(recovered.status,200,'reload-safe repair resumes with the server-stored renewal key');
  assert.equal((await env.DB.prepare("SELECT state FROM vpage_renewal_requests WHERE idempotency_key='domain-one-timeout-renew-001'").first()).state,'committed');

  serviceSqlite.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").run(remoteId);
  await env.DB.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").bind(localId).run();
  await purchase(20);renewFailure='after';const beforeLossExpiry=serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at;
  const lost=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-response-loss-renew',params:{id:localId}})));
  assert.equal(lost.status,202);const committedRemoteExpiry=serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at;assert.notEqual(committedRemoteExpiry,beforeLossExpiry);
  renewFailure='';const recoveredLoss=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',params:{id:localId}})));
  assert.equal(recoveredLoss.status,200);assert.equal(serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at,committedRemoteExpiry,'remote response loss retry cannot extend twice');

  serviceSqlite.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").run(remoteId);
  await env.DB.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").bind(localId).run();
  await purchase(20);renewFailure='in-progress';const beforeInProgress=serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at;
  const inProgress=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-in-progress-renew',params:{id:localId}})));
  assert.equal(inProgress.status,202,'remote idempotency-in-progress is ambiguous because another request may have committed');assert.equal(inProgress.data.code,'VPAGE_RENEWAL_REPAIR_REQUIRED');
  const inProgressCommittedExpiry=serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at;assert.notEqual(inProgressCommittedExpiry,beforeInProgress);assert.equal((await env.DB.prepare("SELECT state FROM vpage_renewal_requests WHERE idempotency_key='domain-one-in-progress-renew'").first()).state,'held');
  renewFailure='';const recoveredInProgress=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',params:{id:localId}})));
  assert.equal(recoveredInProgress.status,200);assert.equal(serviceSqlite.prepare('SELECT expires_at FROM vpage_pages WHERE id=?').get(remoteId).expires_at,inProgressCommittedExpiry,'in-progress repair replays rather than extending twice');

  serviceSqlite.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").run(remoteId);
  await env.DB.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").bind(localId).run();
  await purchase(20);const originalBatch=env.DB.batch.bind(env.DB);let failFinaliseOnce=true;
  env.DB.batch=async statements=>{if(failFinaliseOnce&&statements.some(statement=>String(statement.sql||'').includes("UPDATE vpage_credits SET status='consumed'"))){failFinaliseOnce=false;throw new Error('simulated local renewal commit uncertainty')}return originalBatch(statements)};
  const localUncertain=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:'domain-one-local-uncertain-renew',params:{id:localId}})));
  assert.equal(localUncertain.status,202);assert.equal((await env.DB.prepare("SELECT state FROM vpage_renewal_requests WHERE idempotency_key='domain-one-local-uncertain-renew'").first()).state,'remote_committed');
  const callsBeforeLocalRepair=renewRemoteCalls,localRecovered=await readJson(await ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',params:{id:localId}})));
  env.DB.batch=originalBatch;assert.equal(localRecovered.status,200);assert.equal(renewRemoteCalls,callsBeforeLocalRepair,'local commit repair finalises without another remote extension');

  serviceSqlite.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").run(remoteId);
  await env.DB.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").bind(localId).run();
  await purchase(20);const consumedBeforeRace=await count("SELECT COUNT(*) count FROM vpage_credits WHERE user_id=20 AND status='consumed'"),raceKey='domain-one-concurrent-renew-001';
  const race=await Promise.all([ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:raceKey,params:{id:localId}})),ownerRenew(context(`/api/vpage/pages/${localId}/renew`,{method:'POST',key:raceKey,params:{id:localId}}))]).then(responses=>Promise.all(responses.map(readJson)));
  assert.deepEqual(race.map(item=>item.status),[200,200]);assert.equal(await count("SELECT COUNT(*) count FROM vpage_credits WHERE user_id=20 AND status='consumed'"),consumedBeforeRace+1,'concurrent replay spends exactly one credit');
  assert.equal(race[0].data.item.expires_at,race[1].data.item.expires_at,'concurrent replay extends exactly once');

  const ownerPages=await readJson(await listPages(context('/api/vpage/pages?limit=24')));
  assert.equal(ownerPages.status,200);
  assert.equal(ownerPages.data.items.length,1);
  assert.equal(ownerPages.data.items[0].display_name,'ร้าน Domain One');
  assert.equal(serviceSqlite.prepare('SELECT COUNT(*) count FROM vpage_set_audit WHERE page_id=?').get(remoteId).count,2,'owner and Boss switches create exactly two audit events');
  const renewalPlan=(await env.DB.prepare("EXPLAIN QUERY PLAN SELECT * FROM vpage_renewal_requests INDEXED BY idx_vpage_renewals_owner_page WHERE user_id=? AND page_id=? AND state IN ('held','remote_committed') ORDER BY id DESC LIMIT 1").bind(20,localId).all()).results.map(row=>row.detail).join(' | ');
  const renewalCreditPlan=(await env.DB.prepare("EXPLAIN QUERY PLAN SELECT c.id FROM vpage_credits c INDEXED BY idx_vpage_credits_owner_status WHERE c.user_id=? AND c.status='available' AND NOT EXISTS(SELECT 1 FROM vpage_credit_claims x WHERE x.credit_id=c.id AND x.state IN ('held','committed')) AND NOT EXISTS(SELECT 1 FROM vpage_renewal_requests r WHERE r.credit_id=c.id AND r.state IN ('held','remote_committed')) ORDER BY c.id LIMIT 1").bind(20).all()).results.map(row=>row.detail).join(' | ');
  const renewalListPlan=(await env.DB.prepare("EXPLAIN QUERY PLAN SELECT p.id FROM vpage_pages p LEFT JOIN vpage_renewal_requests r ON r.page_id=p.id AND r.user_id=p.user_id AND r.state IN ('held','remote_committed') WHERE p.user_id=? ORDER BY p.id DESC LIMIT 24").bind(20).all()).results.map(row=>row.detail).join(' | ');
  assert.match(renewalPlan,/idx_vpage_renewals_owner_page/);
  assert.match(renewalCreditPlan,/idx_vpage_credits_owner_status/);assert.match(renewalCreditPlan,/idx_vpage_claims_credit_live/);assert.match(renewalCreditPlan,/idx_vpage_renewals_credit_live/);
  assert.match(renewalListPlan,/idx_vpage_pages_owner_cursor/);assert.match(renewalListPlan,/idx_vpage_renewals_owner_page/);assert.doesNotMatch(renewalPlan+renewalCreditPlan+renewalListPlan,/SCAN vpage_/);
  console.log('PASS Vpage domain-1 full runtime flow: synthetic EasySlip purchase, one credit/page, owner/Boss two-set public switching, expired/suspended owner renewal, replay, timeout/response-loss/local-commit repair and concurrency safety');
}finally{
  globalThis.fetch=nativeFetch;
  serviceSqlite.close();
}
