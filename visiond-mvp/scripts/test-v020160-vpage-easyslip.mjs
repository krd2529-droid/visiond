import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {env} from './test-vtools-access.mjs';
import {onRequestPost as checkout} from '../functions/api/orders/index.js';
import {onRequestPost as uploadSlip} from '../functions/api/orders/[id]/slip.js';
import {onRequestGet as adminOrders} from '../functions/api/admin/orders.js';

const db=env.DB;
await db.exec(await readFile(new URL('../migrations/0123_vpage_credit_purchase.sql',import.meta.url),'utf8'));
await db.prepare("INSERT INTO settings(key,value) VALUES('vision3_auto_verify','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
for(const [key,value] of Object.entries({vpage_bank_name:'Mock Bank',vpage_account_name:'Test Vpage',vpage_account_number:'012-345-6789'}))await db.prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,value).run();
for(let id=5;id<=13;id++){
  await db.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(?,?,?,'test','customer')").bind(id,`vpage-slip-${id}@example.invalid`,`Vpage Slip ${id}`).run();
  await db.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").bind(`vpage-slip-${id}`,id).run();
}
env.EASYSLIP_API_KEY='test-key-never-sent';
env.FILES={...env.FILES,async put(){}};

const context=(path,userId,body,params={},requestEnv=env)=>({
  env:requestEnv,
  params,
  request:new Request(`https://visiondonline.com${path}`,{
    method:'POST',
    headers:{cookie:`vd_session=vpage-slip-${userId}`,'cf-connecting-ip':`192.0.2.${userId}`,...(body instanceof FormData?{}:{'content-type':'application/json'})},
    body:body instanceof FormData?body:JSON.stringify(body)
  })
});
async function buy(userId){
  const response=await checkout(context('/api/orders',userId,{productSlugs:['vpage-credit'],quantities:{'vpage-credit':1}}));
  const data=await response.json();
  assert.equal(response.status,201,JSON.stringify(data));
  return db.prepare('SELECT * FROM orders WHERE id=?').bind(data.id).first();
}
async function submit(order,userId){
  const form=new FormData();
  form.set('slip',new File(['vpage-easyslip-test'],'slip.png',{type:'image/png'}));
  const response=await uploadSlip(context(`/api/orders/${order.id}/slip`,userId,form,{id:String(order.id)}));
  assert.equal(response.status,200);
  return response.json();
}
const countCredits=orderId=>db.prepare('SELECT COUNT(*) count FROM vpage_credits WHERE order_id=?').bind(orderId).first();
const readOrder=id=>db.prepare('SELECT status,slip_verification_status,slip_verification_code FROM orders WHERE id=?').bind(id).first();
const countEvidence=orderId=>db.prepare('SELECT COUNT(*) count FROM order_slip_evidence WHERE order_id=?').bind(orderId).first();

let providerMode='success',providerCalls=0,activeOrder;
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.easyslip.com/v2/verify/bank');
  assert.equal(options.headers.authorization,'Bearer test-key-never-sent');
  assert.equal(options.body.get('matchAmount'),'999.00');
  assert.equal(options.body.get('matchAccount'),'true');
  assert.equal(options.body.get('checkDuplicate'),'true');
  providerCalls++;
  if(providerMode==='unavailable')throw new Error('test provider unavailable');
  const mismatchedAmount=providerMode==='amount';
  const mismatchedReceiver=providerMode==='receiver';
  return Response.json({success:true,data:{
    rawSlip:{transRef:['success','duplicate'].includes(providerMode)?'vpage-success-ref':`vpage-${providerMode}-${activeOrder.id}`},
    amountInSlip:mismatchedAmount?1:999,
    isAmountMatched:!mismatchedAmount,
    isDuplicate:false,
    matchedAccount:{nameTh:mismatchedReceiver?'Wrong Receiver':activeOrder.payment_account_name,bankNumber:activeOrder.payment_account_number}
  }});
};

try{
  activeOrder=await buy(5);
  const success=await submit(activeOrder,5);
  assert.equal(success.persisted,true,'success is returned only with an explicit durable acknowledgement');
  assert.equal(success.order_status,'paid');
  assert.equal(success.auto_approved,true,'valid EasySlip result auto-approves Vpage');
  assert.equal(success.count,1);
  assert.deepEqual({...await readOrder(activeOrder.id)},{status:'paid',slip_verification_status:'verified',slip_verification_code:'OK'});
  assert.deepEqual({...await countCredits(activeOrder.id)},{count:1});
  const credit=await db.prepare('SELECT status,service_days FROM vpage_credits WHERE order_id=?').bind(activeOrder.id).first();
  assert.deepEqual({...credit},{status:'available',service_days:30},'auto approval grants one 30-day credit');

  const replay=await submit(activeOrder,5);
  assert.equal(replay.auto_approved,true);
  assert.equal(providerCalls,1,'paid replay skips EasySlip and cannot renew credit');
  assert.deepEqual({...await countCredits(activeOrder.id)},{count:1},'paid replay remains exactly one credit');

  activeOrder=await buy(6);providerMode='duplicate';
  const duplicate=await submit(activeOrder,6);
  assert.equal(duplicate.persisted,true);
  assert.equal(duplicate.order_status,'pending_review');
  assert.equal(duplicate.auto_approved,false);
  assert.match(duplicate.message,/ตรวจสอบ/,'duplicate response truthfully reports manual review');
  assert.deepEqual({...await readOrder(activeOrder.id)},{status:'pending_review',slip_verification_status:'manual',slip_verification_code:'LOCAL_DUPLICATE'});
  assert.deepEqual({...await countCredits(activeOrder.id)},{count:0},'reused transRef cannot grant credit');

  for(const scenario of [{userId:7,mode:'amount',code:'AMOUNT_MISMATCH'},{userId:8,mode:'receiver',code:'ACCOUNT_MISMATCH'}]){
    activeOrder=await buy(scenario.userId);providerMode=scenario.mode;
    const mismatch=await submit(activeOrder,scenario.userId);
    assert.equal(mismatch.auto_approved,false,scenario.mode);
    assert.match(mismatch.message,/ตรวจสอบ/,`${scenario.mode} response truthfully reports manual review`);
    assert.deepEqual({...await readOrder(activeOrder.id)},{status:'pending_review',slip_verification_status:'manual',slip_verification_code:scenario.code});
    assert.deepEqual({...await countCredits(activeOrder.id)},{count:0},`${scenario.mode} mismatch cannot grant credit`);
  }

  activeOrder=await buy(9);env.EASYSLIP_API_KEY='';
  const notConfigured=await submit(activeOrder,9);
  assert.equal(notConfigured.auto_approved,false);
  assert.match(notConfigured.message,/ตรวจสอบ/,'missing-key response truthfully reports manual review');
  assert.deepEqual({...await readOrder(activeOrder.id)},{status:'pending_review',slip_verification_status:'manual',slip_verification_code:'API_NOT_CONFIGURED'});
  assert.deepEqual({...await countCredits(activeOrder.id)},{count:0},'missing API key safely waits for manual review');

  activeOrder=await buy(10);env.EASYSLIP_API_KEY='test-key-never-sent';providerMode='unavailable';
  const unavailable=await submit(activeOrder,10);
  assert.equal(unavailable.auto_approved,false);
  assert.match(unavailable.message,/ตรวจสอบ/,'provider-error response truthfully reports manual review');
  assert.deepEqual({...await readOrder(activeOrder.id)},{status:'pending_review',slip_verification_status:'manual',slip_verification_code:'VERIFY_ERROR'});
  assert.deepEqual({...await countCredits(activeOrder.id)},{count:0},'provider exception safely waits for manual review');
  const adminResponse=await adminOrders({env,request:new Request('https://visiondonline.com/api/admin/orders',{headers:{cookie:'vd_session=vx-4'}})}),adminData=await adminResponse.json(),adminItem=adminData.items.find(item=>Number(item.id)===Number(activeOrder.id));
  assert.equal(adminResponse.status,200);assert.equal(adminItem.status,'pending_review');assert.match(adminItem.slip_url,/^\/api\/admin\/slip\?key=/,'authoritative admin response exposes the persisted slip');
  const callsAfterFallback=providerCalls,evidenceAfterFallback=(await countEvidence(activeOrder.id)).count;
  providerMode='retry';
  const retry=await submit(activeOrder,10);
  assert.equal(retry.persisted,true);assert.equal(retry.order_status,'paid');assert.equal(retry.auto_approved,true);
  assert.equal(providerCalls,callsAfterFallback+1,'a deliberate retry after a definitive provider failure can verify again');
  assert.equal((await countEvidence(activeOrder.id)).count,evidenceAfterFallback+1,'a deliberate retry is retained as a separate auditable attempt');
  assert.equal((await countCredits(activeOrder.id)).count,1,'retry success grants exactly one credit');
  activeOrder=await buy(11);providerMode='success';let storedKey='',deletedKey='';const realBatch=env.DB.batch.bind(env.DB),realPut=env.FILES.put,realDelete=env.FILES.delete;
  env.FILES.put=async key=>{storedKey=key};env.FILES.delete=async key=>{deletedKey=key};env.DB.batch=async()=>{throw new Error('test persistence failure')};
  const failedForm=new FormData();failedForm.set('slip',new File(['persist-failure'],'slip.png',{type:'image/png'}));
  const failedResponse=await uploadSlip(context(`/api/orders/${activeOrder.id}/slip`,11,failedForm,{id:String(activeOrder.id)})),failedData=await failedResponse.json();
  assert.equal(failedResponse.status,503);assert.equal(failedData.persisted,false);assert.ok(storedKey);assert.equal(deletedKey,storedKey,'failed DB persistence cleans the just-uploaded object');
  assert.deepEqual({...await readOrder(activeOrder.id)},{status:'awaiting_payment',slip_verification_status:'not_checked',slip_verification_code:null});
  assert.equal((await countEvidence(activeOrder.id)).count,0);
  env.DB.batch=realBatch;env.FILES.put=realPut;if(realDelete)env.FILES.delete=realDelete;else delete env.FILES.delete;

  activeOrder=await buy(12);let uncertainStored='',uncertainDeleted='';
  const uncertainEnv={...env,FILES:{...env.FILES,async put(key){uncertainStored=key},async delete(key){uncertainDeleted=key}},DB:{
    exec:(...args)=>env.DB.exec(...args),batch:async()=>{throw new Error('test uncertain persistence outcome')},
    prepare(sql){if(String(sql).includes('AND slip_key=?'))throw new Error('test readback unavailable');return env.DB.prepare(sql)}
  }};
  const uncertainForm=new FormData();uncertainForm.set('slip',new File(['uncertain-persist'],'slip.png',{type:'image/png'}));
  const uncertainResponse=await uploadSlip(context(`/api/orders/${activeOrder.id}/slip`,12,uncertainForm,{id:String(activeOrder.id)},uncertainEnv)),uncertainData=await uncertainResponse.json();
  assert.equal(uncertainResponse.status,503);assert.equal(uncertainData.persisted,false);assert.ok(uncertainStored);assert.equal(uncertainDeleted,'','an unknown D1 outcome never deletes a possibly referenced object');

  activeOrder=await buy(13);providerMode='grant-fail';let batchCount=0;
  const grantFailEnv={...env,DB:{exec:(...args)=>env.DB.exec(...args),prepare:(...args)=>env.DB.prepare(...args),async batch(statements){batchCount++;if(batchCount===3)throw new Error('test grant failure');return env.DB.batch(statements)}}};
  const grantFailForm=new FormData();grantFailForm.set('slip',new File(['grant-failure'],'slip.png',{type:'image/png'}));
  const grantFailResponse=await uploadSlip(context(`/api/orders/${activeOrder.id}/slip`,13,grantFailForm,{id:String(activeOrder.id)},grantFailEnv)),grantFailData=await grantFailResponse.json();
  assert.equal(grantFailResponse.status,200);assert.equal(grantFailData.persisted,true);assert.equal(grantFailData.auto_approved,false);assert.equal(grantFailData.order_status,'pending_review');assert.equal(grantFailData.verification_status,'manual');assert.equal(grantFailData.verification_code,'GRANT_NOT_CONFIRMED');
  assert.deepEqual({...await readOrder(activeOrder.id)},{status:'pending_review',slip_verification_status:'manual',slip_verification_code:'GRANT_NOT_CONFIRMED'});assert.equal((await countCredits(activeOrder.id)).count,0,'grant failure cannot claim or create credit');

  const storefront=await readFile(new URL('../public/vpage.js',import.meta.url),'utf8');
  assert.match(storefront,/data\.persisted!==true/,'UI requires the server persistence acknowledgement');
  console.log('PASS Vpage EasySlip: success auto-grants exactly one 30-day credit; paid replay, reused transRef, amount/receiver mismatch, missing key and provider failure never grant and stay manual-review safe');
}finally{
  globalThis.fetch=originalFetch;
}
