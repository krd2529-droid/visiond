import {json,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {purgeExpiredElonData} from '../../../_elon.js';
import {elonWebDb,ensureElonWebSchema} from '../../../_elon_databases.js';

export async function onRequestGet(ctx){
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;await ensureDatabase(ctx.env);await ensureElonWebSchema(ctx.env);await purgeExpiredElonData(ctx.env);
  const db=elonWebDb(ctx.env),conversation=await db.prepare(`SELECT id,subject_id,title,status,created_at,updated_at,ended_at FROM elon_web_conversations WHERE id=? AND datetime(updated_at)>=datetime('now','-60 days')`).bind(ctx.params.id).first();
  if(!conversation)return json({error:'ไม่พบบทสนทนา ELON Web'},404);
  const member=await ctx.env.DB.prepare('SELECT name,username,email FROM users WHERE id=?').bind(Number(conversation.subject_id)).first();
  const rows=await db.prepare('SELECT id,role,content,page_context,created_at FROM elon_web_messages WHERE conversation_id=? ORDER BY id ASC').bind(conversation.id).all();
  return json({conversation:{...conversation,member_name:member?.name||'สมาชิก VisionD',username:member?.username||'',email:member?.email||''},messages:rows.results||[]},200,{'cache-control':'private, no-store'});
}

export async function onRequestPatch(ctx){
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;await ensureElonWebSchema(ctx.env);await purgeExpiredElonData(ctx.env);
  const body=await ctx.request.json().catch(()=>null);if(!body||typeof body.archived!=='boolean')return json({error:'สถานะไม่ถูกต้อง'},400);
  const db=elonWebDb(ctx.env),result=body.archived?await db.prepare("UPDATE elon_web_conversations SET status='archived' WHERE id=?").bind(ctx.params.id).run():await db.prepare("UPDATE elon_web_conversations SET status=CASE WHEN ended_at IS NULL THEN 'active' ELSE 'ended' END WHERE id=? AND status='archived'").bind(ctx.params.id).run();
  if(!result.meta?.changes)return json({error:'ไม่พบบทสนทนา ELON Web'},404);const restored=await db.prepare('SELECT status FROM elon_web_conversations WHERE id=?').bind(ctx.params.id).first();return json({ok:true,status:restored?.status||'archived'});
}
