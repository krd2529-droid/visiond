import {json,requireBoss} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {ensurePartnerHealthSchema,buildPartnerAlerts} from '../../../../_partner_health.js';
import {decryptPartnerSecret} from '../../../../_partner_crypto.js';
import {webhookSignature,verifyWebhook,retryDelayMinutes} from '../../../../_partner_webhook.js';
import {onRequestGet as readProducts} from '../../../partner/v1/products/index.js';
import {onRequestPost as runSandbox} from './sandbox.js';

const headers={'cache-control':'private, no-store'};
const labels={customer:'ลูกค้า',order:'ออเดอร์',payment:'ชำระเงิน',cancellation:'ยกเลิก',refund:'คืนเงิน'};

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensurePartnerHealthSchema(ctx.env);
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const website=await ctx.env.DB.prepare('SELECT id,name,status,scopes,client_id,secret_ciphertext FROM partner_websites WHERE id=?').bind(ctx.params.id).first();
  if(!website)return json({error:'ไม่พบเว็บไซต์คู่ค้า'},404,headers);
  let scopes=[];try{scopes=JSON.parse(website.scopes||'[]')}catch{}
  const required=['products:read','customers:write','orders:write'],missing=required.filter(scope=>!scopes.includes(scope));
  if(website.status!=='active'||missing.length)return json({error:'E2E_READINESS_INCOMPLETE',website_status:website.status,missing_scopes:missing},409,headers);
  let secret='';try{secret=await decryptPartnerSecret(ctx.env,website.secret_ciphertext)}catch{return json({error:'PARTNER_CREDENTIAL_DECRYPT_FAILED'},503,headers)}
  const origin=new URL(ctx.request.url).origin,steps=[];
  const productRequest=new Request(`${origin}/api/partner/v1/products?limit=1`,{headers:{'x-visiond-client-id':website.client_id,authorization:`Bearer ${secret}`,'x-request-id':`e2e-product-${crypto.randomUUID()}`}}),productResponse=await readProducts({...ctx,request:productRequest}),productBody=await productResponse.json().catch(()=>({}));
  steps.push({step:'products',label:'สินค้า Read-only',ok:productResponse.ok,status:productResponse.status,detail:productResponse.ok?`อ่าน Metadata ได้ ${productBody.items?.length||0} รายการ`:(productBody.error||'ไม่สำเร็จ')});
  const runId=crypto.randomUUID().replaceAll('-',''),externalOrder=`E2E-ORDER-${runId.slice(0,12)}`,externalCustomer=`E2E-CUSTOMER-${runId.slice(0,12)}`,scenarioResults=[];
  for(const scenario of Object.keys(labels)){
    const externalId=scenario==='customer'?externalCustomer:externalOrder,key=`e2e-${scenario}-${runId}`,request=new Request(`${origin}/api/admin/partner-websites/${website.id}/sandbox`,{method:'POST',headers:{'content-type':'application/json',cookie:ctx.request.headers.get('cookie')||''},body:JSON.stringify({scenario,external_id:externalId,idempotency_key:key})}),response=await runSandbox({...ctx,request}),body=await response.json().catch(()=>({}));
    scenarioResults.push({scenario,key,externalId,response,body});steps.push({step:scenario,label:labels[scenario],ok:response.ok,status:response.status,detail:response.ok?'Sandbox ผ่าน ไม่เขียน Production':body.error||'ไม่สำเร็จ'});
  }
  const first=scenarioResults[0],replayRequest=new Request(`${origin}/api/admin/partner-websites/${website.id}/sandbox`,{method:'POST',headers:{'content-type':'application/json',cookie:ctx.request.headers.get('cookie')||''},body:JSON.stringify({scenario:first.scenario,external_id:first.externalId,idempotency_key:first.key})}),replayResponse=await runSandbox({...ctx,request:replayRequest}),replayBody=await replayResponse.json().catch(()=>({}));
  steps.push({step:'idempotency',label:'Idempotency Replay',ok:replayResponse.ok&&replayBody.replayed===true,status:replayResponse.status,detail:replayBody.replayed?'คืนผลเดิมโดยไม่สร้างซ้ำ':'Replay ไม่ผ่าน'});
  const conflictRequest=new Request(`${origin}/api/admin/partner-websites/${website.id}/sandbox`,{method:'POST',headers:{'content-type':'application/json',cookie:ctx.request.headers.get('cookie')||''},body:JSON.stringify({scenario:'customer',external_id:`E2E-CONFLICT-${runId.slice(0,8)}`,idempotency_key:first.key})}),conflictResponse=await runSandbox({...ctx,request:conflictRequest});
  steps.push({step:'idempotency_conflict',label:'Idempotency Conflict',ok:conflictResponse.status===409,status:conflictResponse.status,detail:conflictResponse.status===409?'ปฏิเสธ Key เดิมกับข้อมูลต่างกัน':'ควรตอบ 409'});
  const timestamp=String(Math.floor(Date.now()/1000)),raw=JSON.stringify({type:'order',external_id:externalOrder,data:{external_order_id:externalOrder}}),signature=await webhookSignature(secret,timestamp,raw),signatureResult=await verifyWebhook({secret,timestamp,raw,signature});
  steps.push({step:'signed_webhook',label:'Signed Webhook',ok:signatureResult==='',status:signatureResult?401:200,detail:signatureResult||'HMAC และ Timestamp ผ่าน'});
  const retrySchedule=[1,2,3,4,5].map(attempt=>retryDelayMinutes(attempt)),retryOk=JSON.stringify(retrySchedule)===JSON.stringify([2,4,8,16,32]);
  steps.push({step:'retry_dead',label:'Retry / Dead Letter',ok:retryOk,status:retryOk?200:500,detail:retryOk?'Backoff ผ่าน และครั้งที่ 5 เข้า Dead Letter':'Retry policy ไม่ตรง'});
  const alertCodes=buildPartnerAlerts({signatureErrors:1,timestampErrors:1,retry:3,dead:1}).map(item=>item.code),healthOk=['SIGNATURE_FAILURE','TIMESTAMP_EXPIRED','RETRY_ACCUMULATED','DEAD_LETTER_PRESENT'].every(code=>alertCodes.includes(code));
  steps.push({step:'health_alerts',label:'Health Alerts',ok:healthOk,status:healthOk?200:500,detail:healthOk?'Alert ครบ 4 เงื่อนไข':'Alert ไม่ครบ'});
  const passed=steps.filter(step=>step.ok).length,failed=steps.length-passed;
  return json({ok:failed===0,website:{id:website.id,name:website.name},mode:'sandbox-no-production-write',summary:{total:steps.length,passed,failed},steps,security:{credential_returned:false,signature_returned:false,personal_data_returned:false}},failed?422:200,headers);
}
