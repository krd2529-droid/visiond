import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {env} from './test-vtools-access.mjs';
import {onRequestPost as checkout} from '../functions/api/orders/index.js';
import {onRequestPost as uploadSlip} from '../functions/api/orders/[id]/slip.js';

const db=env.DB;
await db.exec(await readFile(new URL('../migrations/0123_vpage_credit_purchase.sql',import.meta.url),'utf8'));
await db.prepare("INSERT INTO settings(key,value) VALUES('vision3_auto_verify','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
for(let id=5;id<=10;id++){
  await db.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(?,?,?,'test','customer')").bind(id,`vpage-slip-${id}@example.invalid`,`Vpage Slip ${id}`).run();
  await db.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+1 day'))").bind(`vpage-slip-${id}`,id).run();
}
env.EASYSLIP_API_KEY='test-key-never-sent';
env.FILES={...env.FILES,async put(){}};

const context=(path,userId,body,params={})=>({
  env,
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

  const storefront=await readFile(new URL('../public/vpage.js',import.meta.url),'utf8');
  assert.match(storefront,/data\.auto_approved\?'ชำระเงินสำเร็จ เครดิตเข้าบัญชีแล้ว':data\.message/,'UI claims credit only after route auto-approval and preserves manual fallback wording');
  console.log('PASS Vpage EasySlip: success auto-grants exactly one 30-day credit; paid replay, reused transRef, amount/receiver mismatch, missing key and provider failure never grant and stay manual-review safe');
}finally{
  globalThis.fetch=originalFetch;
}
