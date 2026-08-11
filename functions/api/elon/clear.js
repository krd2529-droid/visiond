import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {purgeExpiredElonData} from '../../_elon.js';
import {elonWebDb,ensureElonWebSchema} from '../../_elon_databases.js';

const conversationId=value=>/^ew_[a-f0-9-]{20,64}$/i.test(String(value||''))?String(value):'';

export async function onRequestPost(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;await ensureDatabase(ctx.env);await ensureElonWebSchema(ctx.env);await purgeExpiredElonData(ctx.env);
  const body=await ctx.request.json().catch(()=>({})),id=conversationId(body.conversation_id);
  if(!id)return json({error:'ไม่พบรหัสบทสนทนา'},400);
  const result=await elonWebDb(ctx.env).prepare(`UPDATE elon_web_conversations SET status='ended',ended_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND subject_id=? AND status='active'`).bind(id,String(auth.user.id)).run();
  if(!result.meta?.changes)return json({error:'ไม่พบบทสนทนานี้ หรือบทสนทนาสิ้นสุดแล้ว'},404);
  return json({ok:true,conversation_id:id,status:'ended'});
}

// Transcripts are audit records retained for 60 days. Members may end a chat
// with POST, but cannot permanently delete it before retention expires.
export async function onRequestDelete(){
  return json({error:'ไม่อนุญาตให้ลบประวัติถาวร ระบบจะเก็บไว้ 60 วันและลบอัตโนมัติ'},405,{'allow':'POST','cache-control':'no-store'});
}
