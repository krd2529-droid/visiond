import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const isoDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null;

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({}));
  const projectName=String(body.project_name||'').trim().slice(0,160),topic=String(body.topic||'').trim().slice(0,300),imageCount=Math.floor(Number(body.image_count)),promptCount=Math.floor(Number(body.prompt_count));
  if(!Number.isInteger(imageCount)||imageCount<1||imageCount>1000)return json({error:'จำนวนรูปไม่ถูกต้อง'},400);
  if(!Number.isInteger(promptCount)||promptCount<1||promptCount>1000)return json({error:'จำนวน Prompt ไม่ถูกต้อง'},400);
  const userName=auth.user.name||auth.user.username||auth.user.email||String(auth.user.id);
  const result=await ctx.env.DB.prepare(`INSERT INTO prompt_usage_logs(user_id,user_name,user_role,project_name,topic,image_count,prompt_count) VALUES(?,?,?,?,?,?,?)`).bind(auth.user.id,userName,auth.user.role,projectName,topic,imageCount,promptCount).run();
  return json({ok:true,id:result.meta.last_row_id},201);
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),today=new Date().toISOString().slice(0,10),defaultFrom=new Date(Date.now()-29*86400000).toISOString().slice(0,10),from=isoDate(url.searchParams.get('from'))||defaultFrom,to=isoDate(url.searchParams.get('to'))||today;
  if(from>to)return json({error:'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด'},400);
  const items=(await ctx.env.DB.prepare(`SELECT id,user_name,user_role,project_name,topic,image_count,prompt_count,created_at,datetime(created_at,'+7 hours') local_created_at,date(created_at,'+7 hours') local_day FROM prompt_usage_logs WHERE date(created_at,'+7 hours') BETWEEN ? AND ? ORDER BY created_at DESC,id DESC LIMIT 2000`).bind(from,to).all()).results;
  const totals=await ctx.env.DB.prepare(`SELECT COUNT(*) runs,COALESCE(SUM(image_count),0) images,COALESCE(SUM(prompt_count),0) prompts FROM prompt_usage_logs WHERE date(created_at,'+7 hours') BETWEEN ? AND ?`).bind(from,to).first();
  const summary={runs:Number(totals.runs)||0,images:Number(totals.images)||0,prompts:Number(totals.prompts)||0};
  return json({from,to,summary,items});
}
