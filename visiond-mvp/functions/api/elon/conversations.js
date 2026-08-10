import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {containsExternalLink,elonMemberContext,purgeExpiredElonData,safeElonOutput} from '../../_elon.js';
import {elonWebDb,ensureElonWebSchema} from '../../_elon_databases.js';

export async function onRequestGet(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;await ensureDatabase(ctx.env);await ensureElonWebSchema(ctx.env);await purgeExpiredElonData(ctx.env);
  const memberContext=await elonMemberContext(ctx.env,auth.user.id);
  const result=await elonWebDb(ctx.env).prepare(`SELECT c.id,c.title,c.status,c.created_at,COALESCE((SELECT MAX(activity.created_at) FROM elon_web_messages activity WHERE activity.conversation_id=c.id),c.created_at) updated_at,c.ended_at,
    (SELECT content FROM elon_web_messages m WHERE m.conversation_id=c.id AND m.subject_id=c.subject_id ORDER BY m.id DESC LIMIT 1) last_message
    FROM elon_web_conversations c WHERE c.subject_id=? AND datetime(COALESCE((SELECT MAX(m.created_at) FROM elon_web_messages m WHERE m.conversation_id=c.id),c.created_at))>=datetime('now','-60 days') ORDER BY COALESCE((SELECT MAX(m.created_at) FROM elon_web_messages m WHERE m.conversation_id=c.id),c.created_at) DESC LIMIT 20`).bind(String(auth.user.id)).all();
  const conversations=(result.results||[]).map(item=>({...item,title:containsExternalLink(item.title,ctx.env)?'ลิงก์ภายนอกถูกบล็อก':item.title,last_message:containsExternalLink(item.last_message,ctx.env)?'[ลิงก์ภายนอกถูกบล็อกเพื่อความปลอดภัย]':safeElonOutput(item.last_message,ctx.env,memberContext)}));
  return json({conversations},200,{'cache-control':'no-store'});
}
