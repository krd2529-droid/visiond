import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {containsExternalLink,purgeExpiredElonData,safeElonOutput} from '../../_elon.js';

export async function onRequestGet(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;await ensureDatabase(ctx.env);await purgeExpiredElonData(ctx.env);
  const result=await ctx.env.DB.prepare(`SELECT c.id,c.title,c.status,c.created_at,c.updated_at,c.ended_at,
    (SELECT content FROM elon_messages m WHERE m.conversation_id=c.id AND m.user_id=c.user_id ORDER BY m.id DESC LIMIT 1) last_message
    FROM elon_conversations c WHERE c.user_id=? AND datetime(c.updated_at)>=datetime('now','-60 days') ORDER BY c.updated_at DESC LIMIT 20`).bind(auth.user.id).all();
  const conversations=(result.results||[]).map(item=>({...item,title:containsExternalLink(item.title,ctx.env)?'ลิงก์ภายนอกถูกบล็อก':item.title,last_message:containsExternalLink(item.last_message,ctx.env)?'[ลิงก์ภายนอกถูกบล็อกเพื่อความปลอดภัย]':safeElonOutput(item.last_message,ctx.env)}));
  return json({conversations},200,{'cache-control':'no-store'});
}
