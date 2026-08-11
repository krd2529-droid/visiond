import {json} from '../../../_lib.js';
import {decryptChannelValue,lineSignatureValid} from '../../../_channel_crypto.js';
import {cleanWebhookProvider} from '../../../_webhook_hub.js';
import {processLineEvent} from '../../../_veasy_line_ai.js';

const out=(data,status)=>json(data,status,{'cache-control':'no-store'});
async function find(ctx){
  const provider=cleanWebhookProvider(ctx.params.provider),publicId=String(ctx.params.publicId||'');
  if(!provider||!/^wh_[a-f0-9]{48}$/.test(publicId))return null;
  return ctx.env.DB.prepare(`SELECT e.id,e.shop_id,e.status,e.adapter_state,s.name shop_name,c.secret_ciphertext,c.token_ciphertext
    FROM veasy_webhook_endpoints e
    JOIN veasy_shops s ON s.id=e.shop_id
    LEFT JOIN veasy_channel_credentials c ON c.shop_id=e.shop_id AND c.provider=e.provider
    WHERE e.provider=? AND e.public_id=?`).bind(provider,publicId).first();
}
export async function onRequestPost(ctx){
  const x=await find(ctx);
  if(!x||x.status==='revoked')return out({error:'ไม่พบ Webhook'},404);
  if(ctx.params.provider!=='line')return out({error:'Provider Adapter ยังไม่ถูกติดตั้ง',code:'WEBHOOK_ADAPTER_REQUIRED'},503);
  if(!x.secret_ciphertext)return out({error:'LINE ยังไม่พร้อม'},503);
  const raw=await ctx.request.text(),signature=ctx.request.headers.get('x-line-signature');
  let valid=false;
  try{valid=await lineSignatureValid(await decryptChannelValue(ctx.env,x.secret_ciphertext),raw,signature)}catch{}
  const requestId=crypto.randomUUID();
  if(!valid){
    ctx.waitUntil(ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE veasy_webhook_endpoints SET failed_count=failed_count+1,last_event_at=CURRENT_TIMESTAMP WHERE id=?").bind(x.id),
      ctx.env.DB.prepare("INSERT INTO veasy_webhook_events(id,endpoint_id,request_id,signature_status,processing_status,error_code) VALUES(?,?,?,'invalid','rejected','LINE_SIGNATURE_INVALID')").bind(crypto.randomUUID(),x.id,requestId)
    ]).catch(()=>{}));
    return out({error:'ลายเซ็น LINE ไม่ถูกต้อง'},401);
  }
  let payload={};try{payload=JSON.parse(raw)}catch{return out({error:'JSON ไม่ถูกต้อง'},400)}
  const events=Array.isArray(payload.events)?payload.events:[];
  // LINE Verify must work before Use webhook is enabled. A valid signature is
  // the authorization boundary; no event data is accepted or stored here.
  if(events.length===0)return out({ok:true},200);
  if(x.status==='paused')return out({error:'Webhook ถูกพักไว้',code:'WEBHOOK_PAUSED'},503);
  if(x.status!=='active'||x.adapter_state!=='ready')return out({error:'ลิงก์ถูกสร้างแล้ว แต่ Provider Adapter ยังไม่พร้อมรับข้อความ',code:'WEBHOOK_PROVIDER_NOT_CONNECTED'},503);
  const statements=[ctx.env.DB.prepare("UPDATE veasy_webhook_endpoints SET received_count=received_count+?,last_event_at=CURRENT_TIMESTAMP WHERE id=?").bind(events.length,x.id)];
  for(const e of events.slice(0,100))statements.push(ctx.env.DB.prepare("INSERT OR IGNORE INTO veasy_webhook_events(id,endpoint_id,request_id,external_event_id,signature_status,processing_status,event_type) VALUES(?,?,?,?, 'valid','received',?)").bind(crypto.randomUUID(),x.id,`${requestId}:${crypto.randomUUID()}`,String(e.webhookEventId||''),String(e.type||'')));
  ctx.waitUntil((async()=>{await ctx.env.DB.batch(statements);for(const event of events.slice(0,100))await processLineEvent(ctx.env,x,event)})().catch(error=>console.error('VEASY_LINE_BATCH_FAILED',String(error?.message||error).slice(0,100))));
  return out({ok:true},200);
}
export async function onRequestGet(){return out({error:'Method not allowed'},405)}
