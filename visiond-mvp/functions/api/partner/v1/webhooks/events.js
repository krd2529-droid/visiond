import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {decryptPartnerSecret} from '../../../../_partner_crypto.js';
import {ensurePartnerWebhookSchema,processWebhookEvent,queueWebhook,verifyWebhook,webhookEnvelope,webhookLog,webhookRequestHash,webhookSignatureHash} from '../../../../_partner_webhook.js';
const headers={'cache-control':'no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensurePartnerWebhookSchema(ctx.env);
  const raw=await ctx.request.text(),clientId=String(ctx.request.headers.get('x-visiond-client-id')||'').trim(),timestamp=String(ctx.request.headers.get('x-visiond-timestamp')||''),signature=String(ctx.request.headers.get('x-visiond-signature')||''),website=clientId?await ctx.env.DB.prepare('SELECT id,status,scopes,client_id,secret_ciphertext FROM partner_websites WHERE client_id=?').bind(clientId).first():null;
  if(!website||website.status!=='active')return json({error:'PARTNER_CREDENTIAL_INVALID'},401,headers);
  const secret=await decryptPartnerSecret(ctx.env,website.secret_ciphertext),verification=await verifyWebhook({secret,timestamp,raw,signature});
  if(verification)return json({error:verification},401,headers);
  let body=null;try{body=JSON.parse(raw)}catch{return json({error:'WEBHOOK_JSON_INVALID'},400,headers)}
  const envelope=webhookEnvelope(body,ctx.request);if(!envelope)return json({error:'WEBHOOK_EVENT_INVALID'},400,headers);
  const required=envelope.type==='customer'?'customers:write':'orders:write',scopes=JSON.parse(website.scopes||'[]');if(!scopes.includes(required))return json({error:'PARTNER_SCOPE_DENIED',required_scope:required},403,headers);
  const signatureHash=await webhookSignatureHash(signature),requestHash=await webhookRequestHash(envelope),prior=await ctx.env.DB.prepare('SELECT id,status,response_status,request_hash FROM partner_webhook_events WHERE website_id=? AND (idempotency_key=? OR signature_hash=?)').bind(website.id,envelope.key,signatureHash).first();
  if(prior){if(prior.request_hash!==requestHash)return json({error:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD'},409,headers);return json({ok:true,idempotent_replay:true,event_id:prior.id,status:prior.status,response_status:prior.response_status},200,headers)}
  let id;try{id=await queueWebhook(ctx.env,{websiteId:website.id,envelope,signatureHash,requestHash})}catch(error){const duplicate=String(error).includes('UNIQUE');return json({error:duplicate?'WEBHOOK_REPLAY_DETECTED':'WEBHOOK_QUEUE_FAILED'},duplicate?409:500,headers)}
  await webhookLog(ctx.env,{websiteId:website.id,eventId:id,type:envelope.type,externalId:envelope.externalId,message:'รับ Signed Webhook แล้ว',status:202});
  const row=await ctx.env.DB.prepare('SELECT e.*,w.client_id FROM partner_webhook_events e JOIN partner_websites w ON w.id=e.website_id WHERE e.id=?').bind(id).first(),result=await processWebhookEvent(ctx,row,secret);
  return json({ok:result.ok,event_id:id,status:result.status,response_status:result.response_status,error:result.error||undefined},result.ok?200:202,headers);
}
