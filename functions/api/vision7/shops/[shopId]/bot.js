import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {requireVision7User} from '../../../../_vision7_auth.js';
import {ensureVEasyRuntimeSchema} from '../../../../_veasy_runtime.js';

const noStore={'cache-control':'no-store'};
async function context(ctx){await ensureDatabase(ctx.env);await ensureVEasyRuntimeSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return {error:auth.error};const shop=await ctx.env.DB.prepare("SELECT id,name,status FROM veasy_shops WHERE id=? AND user_id=?").bind(ctx.params.shopId,auth.user.id).first();if(!shop)return {error:json({error:'ไม่พบร้านที่เป็นเจ้าของ',code:'VEASY_SHOP_NOT_OWNED'},404,noStore)};return {auth,shop}}
async function snapshot(env,shop){
  const channels=(await env.DB.prepare('SELECT platform,status,external_id,updated_at FROM veasy_channels WHERE shop_id=? ORDER BY platform').bind(shop.id).all()).results||[],connected=channels.filter(x=>x.status==='connected'),state=await env.DB.prepare("SELECT state,handoff_platform,started_at,stopped_at,last_error,updated_at FROM veasy_bot_state WHERE shop_id=?").bind(shop.id).first();
  const blockers=[];if(shop.status!=='active')blockers.push('SHOP_INACTIVE');if(!connected.length)blockers.push('NO_CONNECTED_CHANNEL');
  return {shop_id:shop.id,ready:blockers.length===0,blockers,channels,state:state||{state:'stopped',handoff_platform:'',started_at:null,stopped_at:null,last_error:'',updated_at:null}};
}
export async function onRequestGet(ctx){const value=await context(ctx);if(value.error)return value.error;return json(await snapshot(ctx.env,value.shop),200,noStore)}
export async function onRequestPost(ctx){
  const value=await context(ctx);if(value.error)return value.error;const body=await ctx.request.json().catch(()=>({})),action=String(body.action||'').toLowerCase(),platform=['line','facebook'].includes(body.platform)?body.platform:'';let state='';
  if(action==='start'){const current=await snapshot(ctx.env,value.shop);if(!current.ready)return json({error:'ยังเปิดบอทไม่ได้ กรุณาเชื่อมช่องทางแชทก่อน',code:'VEASY_BOT_NOT_READY',blockers:current.blockers},409,noStore);state='running'}
  else if(action==='handoff'){if(!platform)return json({error:'กรุณาเลือก LINE หรือ Facebook',code:'VEASY_HANDOFF_PLATFORM_REQUIRED'},400,noStore);const channel=await ctx.env.DB.prepare("SELECT 1 ok FROM veasy_channels WHERE shop_id=? AND platform=? AND status='connected'").bind(value.shop.id,platform).first();if(!channel)return json({error:'ช่องทางนี้ยังไม่ได้เชื่อมต่อ',code:'VEASY_CHANNEL_NOT_CONNECTED'},409,noStore);state='human_handoff'}
  else if(action==='stop')state='stopped';else return json({error:'คำสั่งบอทไม่ถูกต้อง',code:'VEASY_BOT_ACTION_INVALID'},400,noStore);
  const auditId=crypto.randomUUID();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(`INSERT INTO veasy_bot_state(shop_id,state,handoff_platform,started_at,stopped_at,updated_by) VALUES(?,?,?,CASE WHEN ?='running' THEN CURRENT_TIMESTAMP END,CASE WHEN ?='stopped' THEN CURRENT_TIMESTAMP END,?) ON CONFLICT(shop_id) DO UPDATE SET state=excluded.state,handoff_platform=excluded.handoff_platform,started_at=CASE WHEN excluded.state='running' THEN CURRENT_TIMESTAMP ELSE veasy_bot_state.started_at END,stopped_at=CASE WHEN excluded.state='stopped' THEN CURRENT_TIMESTAMP ELSE veasy_bot_state.stopped_at END,last_error='',updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`).bind(value.shop.id,state,state==='human_handoff'?platform:'',state,state,value.auth.user.id),
    ...(state==='stopped'?[ctx.env.DB.prepare('DELETE FROM veasy_conversation_leases WHERE shop_id=?').bind(value.shop.id),ctx.env.DB.prepare('DELETE FROM veasy_runtime_leases WHERE shop_id=?').bind(value.shop.id)]:[]),
    ctx.env.DB.prepare(`INSERT INTO veasy_audit_log(id,shop_id,actor_user_id,event_type,entity_type,entity_id,detail) VALUES(?,?,?,'bot_state_changed','bot',?,?)`).bind(auditId,value.shop.id,value.auth.user.id,value.shop.id,JSON.stringify({action,state,platform}))
  ]);
  return json({ok:true,...await snapshot(ctx.env,value.shop)},200,noStore);
}
