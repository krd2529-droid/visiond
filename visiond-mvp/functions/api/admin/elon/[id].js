import {json,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {purgeExpiredElonData} from '../../../_elon.js';

const missingTable=error=>/no such table|not found/i.test(String(error?.message||error));

export async function onRequestGet(ctx){
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);await purgeExpiredElonData(ctx.env);
  try{
    const conversation=await ctx.env.DB.prepare(`SELECT c.id,c.title,c.status,c.created_at,c.updated_at,c.ended_at,u.name member_name,u.username,u.email FROM elon_conversations c JOIN users u ON u.id=c.user_id WHERE c.id=? AND c.updated_at>=datetime('now','-60 days')`).bind(ctx.params.id).first();
    if(!conversation)return json({error:'ไม่พบบทสนทนา ELON'},404);
    const rows=await ctx.env.DB.prepare('SELECT id,role,content,page_context,created_at FROM elon_messages WHERE conversation_id=? ORDER BY id ASC').bind(conversation.id).all();
    return json({conversation,messages:rows.results||[]},200,{'cache-control':'private, no-store'});
  }catch(error){if(missingTable(error))return json({error:'ยังไม่มีข้อมูลบทสนทนา ELON'},404);return json({error:'เปิดบทสนทนา ELON ไม่สำเร็จ'},500)}
}

export async function onRequestPatch(ctx){
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);await purgeExpiredElonData(ctx.env);
  const body=await ctx.request.json().catch(()=>null);if(!body||typeof body.archived!=='boolean')return json({error:'สถานะไม่ถูกต้อง'},400);
  try{
    const result=body.archived
      ?await ctx.env.DB.prepare("UPDATE elon_conversations SET status='archived',updated_at=CURRENT_TIMESTAMP WHERE id=? AND updated_at>=datetime('now','-60 days')").bind(ctx.params.id).run()
      :await ctx.env.DB.prepare("UPDATE elon_conversations SET status=CASE WHEN ended_at IS NULL THEN 'active' ELSE 'ended' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='archived' AND updated_at>=datetime('now','-60 days')").bind(ctx.params.id).run();
    if(!result.meta.changes)return json({error:'ไม่พบบทสนทนา ELON'},404);
    const restored=await ctx.env.DB.prepare('SELECT status FROM elon_conversations WHERE id=?').bind(ctx.params.id).first();
    return json({ok:true,status:restored?.status||'archived'});
  }catch(error){if(missingTable(error))return json({error:'ยังไม่มีข้อมูลบทสนทนา ELON'},404);return json({error:'เปลี่ยนสถานะบทสนทนาไม่สำเร็จ'},500)}
}
