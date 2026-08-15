import {json,sha256} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {requireVision7User} from '../../../_vision7_auth.js';
import {cleanConversationId,ensureVEasyRuntimeSchema,requireAppSession,verifyRuntimeLease} from '../../../_veasy_runtime.js';

const clean=(value,max)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,max);

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyRuntimeSchema(ctx.env);
  const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const appError=requireAppSession(auth.user);if(appError)return appError;
  const body=await ctx.request.json().catch(()=>({})),conversationId=cleanConversationId(body.conversation_id),participant=clean(body.platform_participant_id,180),platform=clean(body.platform||'facebook',30).toLowerCase(),displayName=clean(body.display_name||'ลูกค้า',120),profileUrl=clean(body.profile_url,500);
  if(!conversationId||participant.length<3||!['facebook','line','instagram'].includes(platform))return json({error:'ข้อมูลบทสนทนาไม่ถูกต้อง',code:'VEASY_CONVERSATION_REGISTER_INVALID'},400);
  const runtime=await verifyRuntimeLease(ctx.env,auth.user,body.shop_id,body.runtime_lease_token);
  if(!runtime)return json({error:'Runtime Lease หมดอายุหรือไม่ใช่ของเครื่องนี้',code:'VEASY_RUNTIME_LEASE_INVALID'},409);
  const participantHash=await sha256(`${platform}:${participant}`);
  try{
    await ctx.env.DB.prepare(`INSERT INTO veasy_conversations(shop_id,id,platform,participant_hash,display_name,profile_url) VALUES(?,?,?,?,?,?) ON CONFLICT(shop_id,id) DO UPDATE SET display_name=excluded.display_name,profile_url=excluded.profile_url,updated_at=CURRENT_TIMESTAMP WHERE veasy_conversations.platform=excluded.platform AND veasy_conversations.participant_hash=excluded.participant_hash`).bind(runtime.shop_id,conversationId,platform,participantHash,displayName,/^https:\/\//i.test(profileUrl)?profileUrl:'').run();
  }catch{return json({error:'ลูกค้าหรือบทสนทนานี้ถูกผูกกับข้อมูลอื่นในร้านแล้ว',code:'VEASY_CONVERSATION_BIND_CONFLICT'},409)}
  const row=await ctx.env.DB.prepare('SELECT shop_id,id,platform,participant_hash,display_name,profile_url,status,created_at,updated_at FROM veasy_conversations WHERE shop_id=? AND id=?').bind(runtime.shop_id,conversationId).first();
  if(!row||row.platform!==platform||row.participant_hash!==participantHash)return json({error:'รหัสบทสนทนานี้ถูกผูกกับลูกค้าคนอื่นแล้ว',code:'VEASY_CONVERSATION_BIND_CONFLICT'},409);
  delete row.participant_hash;
  return json({ok:true,conversation:row},201,{'cache-control':'no-store'});
}
