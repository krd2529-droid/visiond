import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {purgeExpiredElonData} from '../../../_elon.js';

const emptyStats={total:0,active:0,out_of_scope:0,errors:0};
const missingTable=error=>/no such table|not found/i.test(String(error?.message||error));

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);await purgeExpiredElonData(ctx.env);
  try{
    const stats=await ctx.env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM elon_messages m WHERE m.conversation_id=c.id AND (m.page_context LIKE '%out_of_scope%' OR (m.role='assistant' AND (m.content LIKE '%นอกขอบเขต%' OR m.content LIKE '%เฉพาะเรื่องเกี่ยวกับ%')))) THEN 1 ELSE 0 END) out_of_scope,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM elon_messages m WHERE m.conversation_id=c.id AND (m.page_context LIKE '%"error"%' OR (m.role='assistant' AND (m.content LIKE '%ระบบขัดข้อง%' OR m.content LIKE '%ลองใหม่ภายหลัง%')))) THEN 1 ELSE 0 END) errors
      FROM elon_conversations c WHERE c.updated_at>=datetime('now','-60 days')`).first();
    const summary={total:Number(stats?.total)||0,active:Number(stats?.active)||0,out_of_scope:Number(stats?.out_of_scope)||0,errors:Number(stats?.errors)||0};
    if(auth.user.role!=='boss')return json({stats:summary,items:[],can_view_transcripts:false},200,{'cache-control':'private, no-store'});
    const url=new URL(ctx.request.url),q=String(url.searchParams.get('q')||'').trim().slice(0,100),status=String(url.searchParams.get('status')||'').trim();
    const page=Math.max(1,Math.min(10000,Number.parseInt(url.searchParams.get('page')||'1',10)||1)),limit=100,offset=(page-1)*limit;
    const binds=[],where=["c.updated_at>=datetime('now','-60 days')"];
    if(q){where.push("(u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)");const like=`%${q}%`;binds.push(like,like,like)}
    if(['active','ended','archived'].includes(status)){where.push('c.status=?');binds.push(status)}
    if(status==='out_of_scope')where.push("EXISTS(SELECT 1 FROM elon_messages f WHERE f.conversation_id=c.id AND (f.page_context LIKE '%out_of_scope%' OR (f.role='assistant' AND (f.content LIKE '%นอกขอบเขต%' OR f.content LIKE '%เฉพาะเรื่องเกี่ยวกับ%'))))");
    if(status==='error')where.push("EXISTS(SELECT 1 FROM elon_messages f WHERE f.conversation_id=c.id AND (f.page_context LIKE '%\"error\"%' OR (f.role='assistant' AND (f.content LIKE '%ระบบขัดข้อง%' OR f.content LIKE '%ลองใหม่ภายหลัง%'))))");
    const countRow=await ctx.env.DB.prepare(`SELECT COUNT(*) total FROM elon_conversations c JOIN users u ON u.id=c.user_id ${where.length?'WHERE '+where.join(' AND '):''}`).bind(...binds).first();
    const total=Number(countRow?.total)||0;
    const sql=`SELECT c.id,c.title,c.status,c.created_at,c.updated_at,u.name member_name,u.username,u.email,
      (SELECT COUNT(*) FROM elon_messages m WHERE m.conversation_id=c.id) message_count,
      (SELECT content FROM elon_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_message,
      (SELECT COUNT(*) FROM elon_messages m WHERE m.conversation_id=c.id AND (m.page_context LIKE '%out_of_scope%' OR (m.role='assistant' AND (m.content LIKE '%นอกขอบเขต%' OR m.content LIKE '%เฉพาะเรื่องเกี่ยวกับ%')))) out_of_scope_count,
      (SELECT COUNT(*) FROM elon_messages m WHERE m.conversation_id=c.id AND (m.page_context LIKE '%\"error\"%' OR (m.role='assistant' AND (m.content LIKE '%ระบบขัดข้อง%' OR m.content LIKE '%ลองใหม่ภายหลัง%')))) error_count
      FROM elon_conversations c JOIN users u ON u.id=c.user_id ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`;
    const rows=await ctx.env.DB.prepare(sql).bind(...binds,limit,offset).all();
    return json({stats:summary,items:rows.results||[],pagination:{page,limit,total,total_pages:Math.max(1,Math.ceil(total/limit))},can_view_transcripts:true},200,{'cache-control':'private, no-store'});
  }catch(error){if(missingTable(error))return json({stats:emptyStats,items:[],can_view_transcripts:auth.user.role==='boss'},200,{'cache-control':'private, no-store'});return json({error:'โหลดข้อมูล ELON ไม่สำเร็จ'},500)}
}
