import assert from 'node:assert/strict';
import {env} from './test-vtools-access.mjs';
import {onRequestPost as checkout} from '../functions/api/orders/index.js';
import {onRequestPost as slip} from '../functions/api/orders/[id]/slip.js';
const db=env.DB;
await db.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(5,'slip@example.invalid','Slip Test','test','customer')").run();
await db.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('slip-test',5,datetime('now','+1 day'))").run();
await db.prepare("INSERT INTO settings(key,value) VALUES('vision3_auto_verify','0') ON CONFLICT(key) DO UPDATE SET value='0'").run();
env.EASYSLIP_API_KEY='test-key-never-sent';env.FILES={async put(){}};
const context=(path,body,params={})=>({env,params,request:new Request('https://visiondonline.com'+path,{method:'POST',headers:{cookie:'vd_session=slip-test',...(body instanceof FormData?{}:{'content-type':'application/json'})},body:body instanceof FormData?body:JSON.stringify(body)})});
async function buy(){const r=await checkout(context('/api/orders',{productSlugs:['vx-30-days-10']}));const data=await r.json();assert.equal(r.status,201,JSON.stringify(data));return db.prepare('SELECT * FROM orders WHERE id=?').bind(data.id).first()}
async function upload(order){const form=new FormData();form.set('slip',new File(['test-only'],'slip.png',{type:'image/png'}));return (await slip(context(`/api/orders/${order.id}/slip`,form,{id:String(order.id)}))).json()}
let order=await buy(),calls=0,mode='valid';const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.easyslip.com/v2/verify/bank');assert.equal(options.headers.authorization,'Bearer test-key-never-sent');calls++;
  assert.equal(options.body.get('matchAmount'),'490.00');assert.equal(options.body.get('checkDuplicate'),'true');assert.equal(options.body.get('matchAccount'),'true');
  if(mode==='failure')throw new Error('test provider unavailable');
  return Response.json({success:true,data:{rawSlip:{transRef:'test-easyslip-ref'},amountInSlip:mode==='amount'?1:490,isAmountMatched:mode!=='amount',isDuplicate:false,matchedAccount:{nameTh:mode==='receiver'?'Wrong Receiver':order.payment_account_name,bankNumber:order.payment_account_number}}});
};
try{
  const paid=await upload(order);assert.equal(paid.auto_approved,true);assert.equal(calls,1,'VX verifies even when Vision3 auto verify disabled');
  assert.equal((await db.prepare('SELECT status FROM orders WHERE id=?').bind(order.id).first()).status,'paid');
  assert.ok(await db.prepare('SELECT order_id FROM vx_access_grants WHERE order_id=?').bind(order.id).first());
  const replay=await upload(order);assert.equal(replay.auto_approved,true);assert.equal(calls,1,'paid replay does not call provider or renew rights');
  order=await buy();
  for(const testMode of ['amount','receiver','valid','failure']){
    mode=testMode;const result=await upload(order);assert.equal(result.auto_approved,false,testMode);
    assert.equal(await db.prepare('SELECT order_id FROM vx_access_grants WHERE order_id=?').bind(order.id).first(),null,testMode+' must never grant access');
  }
  env.EASYSLIP_API_KEY='';const unavailable=await upload(order);assert.equal(unavailable.auto_approved,false);
  assert.equal((await db.prepare('SELECT slip_verification_code FROM orders WHERE id=?').bind(order.id).first()).slip_verification_code,'API_NOT_CONFIGURED');
  console.log('PASS VX EasySlip: automatic verification independent of Vision3; successful slip grants rights; replay, wrong amount/recipient, reused slip, provider failure and missing key never grant extra rights');
}finally{globalThis.fetch=originalFetch}
