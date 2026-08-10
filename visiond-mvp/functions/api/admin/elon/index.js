import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {purgeExpiredElonData} from '../../../_elon.js';
import {elonWebDb,ensureElonWebSchema} from '../../../_elon_databases.js';

const emptyStats={total:0,active:0,out_of_scope:0,errors:0};

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);await ensureElonWebSchema(ctx.env);await purgeExpiredElonData(ctx.env);
  const db=elonWebDb(ctx.env);
  try{
    const stats=await db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) active,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM elon_web_messages m WHERE m.conversation_id=c.id AND m.page_context LIKE '%out_of_scope%') THEN 1 ELSE 0 END) out_of_scope,
      SUM(CASE WHEN EXISTS(SELECT 1 FROM elon_web_messages m WHERE m.conversation_id=c.id AND m.page_context LIKE '%"error"%') THEN 1 ELSE 0 END) errors
      FROM elon_web_conversations c WHERE datetime(COALESCE((SELECT MAX(x.created_at) FROM elon_web_messages x WHERE x.conversation_id=c.id),c.created_at))>=datetime('now','-60 days')`).first();
    const summary={total:Number(stats?.total)||0,active:Number(stats?.active)||0,out_of_scope:Number(stats?.out_of_scope)||0,errors:Number(stats?.errors)||0};
    if(auth.user.role!=='boss')return json({stats:summary,items:[],can_view_transcripts:false},200,{'cache-control':'private, no-store'});
    const url=new URL(ctx.request.url),q=String(url.searchParams.get('q')||'').trim().toLowerCase().slice(0,100),status=String(url.searchParams.get('status')||'').trim();
    const rows=await db.prepare(`SELECT c.id,c.subject_type,c.subject_id,c.title,c.status,c.created_at,COALESCE((SELECT MAX(x.created_at) FROM elon_web_messages x WHERE x.conversation_id=c.id),c.created_at) updated_at,
      (SELECT COUNT(*) FROM elon_web_messages m WHERE m.conversation_id=c.id) message_count,
      (SELECT content FROM elon_web_messages m WHERE m.conversation_id=c.id ORDER BY m.id DESC LIMIT 1) last_message,
      (SELECT COUNT(*) FROM elon_web_messages m WHERE m.conversation_id=c.id AND m.page_context LIKE '%out_of_scope%') out_of_scope_count,
      (SELECT COUNT(*) FROM elon_web_messages m WHERE m.conversation_id=c.id AND m.page_context LIKE '%"error"%') error_count
      FROM elon_web_conversations c WHERE datetime(COALESCE((SELECT MAX(x.created_at) FROM elon_web_messages x WHERE x.conversation_id=c.id),c.created_at))>=datetime('now','-60 days') ORDER BY updated_at DESC LIMIT 500`).all();
    const raw=rows.results||[],ids=[...new Set(raw.filter(x=>x.subject_type!=='guest').map(x=>Number(x.subject_id)).filter(Number.isInteger))];
    const users=new Map();if(ids.length){const found=await ctx.env.DB.prepare(`SELECT id,name,username,email FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();for(const user of found.results||[])users.set(Number(user.id),user)}
    let items=raw.map(item=>({...item,member_name:users.get(Number(item.subject_id))?.name||'สมาชิก VisionD',username:users.get(Number(item.subject_id))?.username||'',email:users.get(Number(item.subject_id))?.email||''}));
    if(['active','ended','archived'].includes(status))items=items.filter(item=>item.status===status);
    if(status==='out_of_scope')items=items.filter(item=>Number(item.out_of_scope_count)>0);if(status==='error')items=items.filter(item=>Number(item.error_count)>0);
    if(q)items=items.filter(item=>[item.member_name,item.username,item.email,item.title,item.last_message].some(value=>String(value||'').toLowerCase().includes(q)));
    const page=Math.max(1,Number.parseInt(url.searchParams.get('page')||'1',10)||1),limit=100,total=items.length,start=(page-1)*limit;
    return json({stats:summary,items:items.slice(start,start+limit),pagination:{page,limit,total,total_pages:Math.max(1,Math.ceil(total/limit))},can_view_transcripts:true},200,{'cache-control':'private, no-store'});
  }catch{return json({stats:emptyStats,items:[],can_view_transcripts:auth.user.role==='boss',configuration_error:'ELON_WEB_DB_REQUIRED'},503,{'cache-control':'private, no-store'})}
}
