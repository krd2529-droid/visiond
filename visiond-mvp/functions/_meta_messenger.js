import {sha256} from './_lib.js';
import {encryptMetaParticipant,metaDataEncryptionConfigured} from './_meta_crypto.js';
import {ensureVision7Schema} from './_vision7_schema.js';

const enc=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
const safe=(v,n=2000)=>String(v||'').normalize('NFKC').trim().slice(0,n);

export async function verifyMetaSignature(secret,raw,header){
  const match=String(header||'').match(/^sha256=([a-f0-9]{64})$/i);
  if(!match||String(secret||'').length<16)return false;
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const actual=hex(await crypto.subtle.sign('HMAC',key,enc.encode(raw))),expected=match[1].toLowerCase();
  let diff=0;for(let i=0;i<actual.length;i++)diff|=actual.charCodeAt(i)^expected.charCodeAt(i);
  return diff===0;
}

export const withinMetaReplyWindow=value=>{const time=Date.parse(String(value||'').replace(' ','T')+'Z');return Number.isFinite(time)&&Date.now()-time<=24*60*60*1000&&Date.now()>=time};
export function metaEventTime(value,now=Date.now()){
  const ms=Number(value),minimum=Date.UTC(2000,0,1),maximum=now+5*60*1000;
  const selected=Number.isFinite(ms)&&ms>=minimum&&ms<=maximum?ms:now;
  return new Date(selected).toISOString().slice(0,19).replace('T',' ');
}
const attachmentSummary=list=>(Array.isArray(list)?list:[]).slice(0,10).map(x=>({type:safe(x?.type,30)}));

export async function ingestMetaWebhook(env,payload){
  await ensureVision7Schema(env);
  if(!metaDataEncryptionConfigured(env))throw new Error('META_DATA_ENCRYPTION_NOT_CONFIGURED');
  const expectedPage=safe(env?.META_PAGE_ID,100);
  if(!/^\d{5,30}$/.test(expectedPage))throw new Error('META_PAGE_ID_NOT_CONFIGURED');
  let accepted=0,duplicates=0,ignored=0,retried=0;
  for(const entry of Array.isArray(payload?.entry)?payload.entry:[]){
    for(const event of Array.isArray(entry?.messaging)?entry.messaging:[]){
      const sender=safe(event?.sender?.id,100),recipient=safe(event?.recipient?.id,100),messageId=safe(event?.message?.mid||event?.postback?.mid,200);
      if(!sender||!recipient||sender===recipient||event?.message?.is_echo||recipient!==expectedPage){ignored++;continue}
      const eventAt=metaEventTime(event?.timestamp),eventKey=messageId||await sha256(`${sender}|${recipient}|${event?.timestamp||0}|${JSON.stringify(event?.postback||event?.message||{}).slice(0,1000)}`);
      const existing=await env.DB.prepare(`SELECT status FROM elon_page_webhook_events WHERE event_key=?`).bind(eventKey).first();
      const reserved=await env.DB.prepare(`INSERT INTO elon_page_webhook_events(event_key,event_type,event_timestamp,status,attempts,last_attempt_at) VALUES(?,?,?,'processing',1,CURRENT_TIMESTAMP) ON CONFLICT(event_key) DO UPDATE SET status='processing',attempts=elon_page_webhook_events.attempts+1,last_attempt_at=CURRENT_TIMESTAMP,error_code='' WHERE elon_page_webhook_events.status='failed'`).bind(eventKey,event?.postback?'postback':'message',eventAt).run();
      if(!reserved.meta?.changes){duplicates++;continue}
      if(existing?.status==='failed')retried++;
      try{
        const participantHash=await sha256(`meta:${sender}`),conversationId=`ep_${participantHash.slice(0,32)}`,ciphertext=await encryptMetaParticipant(env,sender),content=safe(event?.message?.text||event?.postback?.title||event?.postback?.payload||'[ไฟล์แนบ]',2000);
        const metadata=JSON.stringify({attachments:attachmentSummary(event?.message?.attachments),quick_reply:safe(event?.message?.quick_reply?.payload,120),postback:Boolean(event?.postback),event_timestamp:eventAt}).slice(0,1500);
        await env.DB.batch([
          env.DB.prepare(`INSERT INTO elon_page_conversations(id,participant_hash,participant_ref,participant_ciphertext,status,last_customer_message_at,updated_at,expires_at) VALUES(?,?,?,?,'bot_active',?,CURRENT_TIMESTAMP,datetime('now','+60 days')) ON CONFLICT(participant_hash) DO UPDATE SET participant_ciphertext=excluded.participant_ciphertext,last_customer_message_at=CASE WHEN elon_page_conversations.last_customer_message_at IS NULL OR excluded.last_customer_message_at>elon_page_conversations.last_customer_message_at THEN excluded.last_customer_message_at ELSE elon_page_conversations.last_customer_message_at END,updated_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+60 days')`).bind(conversationId,participantHash,'',ciphertext,eventAt),
          env.DB.prepare(`INSERT INTO elon_page_messages(conversation_id,platform_message_id,role,content,mode,metadata,created_at) VALUES(?,?,'customer',?,'page_sales',?,?)`).bind(conversationId,messageId||eventKey,content,metadata,eventAt),
          env.DB.prepare(`INSERT OR IGNORE INTO elon_page_ai_jobs(id,input_message_key,conversation_id) VALUES(?,?,?)`).bind(crypto.randomUUID(),messageId||eventKey,conversationId),
          env.DB.prepare(`UPDATE elon_page_webhook_events SET conversation_id=?,status='processed',processed_at=CURRENT_TIMESTAMP,error_code='' WHERE event_key=?`).bind(conversationId,eventKey)
        ]);
        accepted++;
      }catch(error){
        await env.DB.prepare(`UPDATE elon_page_webhook_events SET status='failed',error_code=?,processed_at=CURRENT_TIMESTAMP WHERE event_key=?`).bind(safe(error?.message,100),eventKey).run();
        throw error;
      }
    }
  }
  return {accepted,duplicates,ignored,retried};
}
