import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const DEFAULT_TASKS=[
  ['zippo','ลง Zippo'],['catalog','ทำแคตตาล็อก'],['toyskub','Toyskub'],
  ['digital-products','ทำสินค้าดิจิทัล'],['ads','ยิงแอด'],['tiktok-bot','บอท TikTok'],
  ['selling','ขายของ'],['other','กิจกรรมอื่นๆ']
].map(([key,label],sort_order)=>({key,label,sort_order,is_custom:false}));
const DEFAULT_BY_KEY=new Map(DEFAULT_TASKS.map(task=>[task.key,task]));

function validDate(value){
  const text=String(value||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(text))return '';
  const date=new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==text?'':text;
}
function noStore(payload,status=200){return json(payload,status,{'cache-control':'no-store'});}

async function listTasks(env,userId,taskDate){
  const rows=(await env.DB.prepare('SELECT task_key,label,sort_order,is_custom,completed_at FROM daily_personal_tasks WHERE user_id=? AND task_date=? ORDER BY sort_order,id').bind(userId,taskDate).all()).results||[];
  const saved=new Map(rows.map(row=>[row.task_key,row]));
  const defaults=DEFAULT_TASKS.map(task=>({...task,completed_at:saved.get(task.key)?.completed_at||null}));
  const custom=rows.filter(row=>Number(row.is_custom)===1).map(row=>({key:row.task_key,label:row.label,sort_order:Number(row.sort_order),is_custom:true,completed_at:row.completed_at||null}));
  return [...defaults,...custom];
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const taskDate=validDate(new URL(ctx.request.url).searchParams.get('date'));
  if(!taskDate)return noStore({error:'วันที่ไม่ถูกต้อง'},400);
  return noStore({date:taskDate,tasks:await listTasks(ctx.env,auth.user.id,taskDate)});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),taskDate=validDate(body.date);
  if(!taskDate)return noStore({error:'วันที่ไม่ถูกต้อง'},400);
  if(body.action==='add'){
    const label=String(body.label||'').trim().slice(0,100);
    if(!label)return noStore({error:'กรุณากรอกชื่องาน'},400);
    const taskKey=`custom-${crypto.randomUUID()}`;
    const count=await ctx.env.DB.prepare('SELECT COUNT(*) total FROM daily_personal_tasks WHERE user_id=? AND task_date=? AND is_custom=1').bind(auth.user.id,taskDate).first();
    await ctx.env.DB.prepare('INSERT INTO daily_personal_tasks(user_id,task_date,task_key,label,sort_order,is_custom) VALUES(?,?,?,?,?,1)').bind(auth.user.id,taskDate,taskKey,label,1000+Number(count?.total||0)).run();
  }else if(body.action==='toggle'){
    const taskKey=String(body.key||'').trim(),completed=Boolean(body.completed);
    let task=DEFAULT_BY_KEY.get(taskKey);
    if(!task){
      const row=await ctx.env.DB.prepare('SELECT task_key key,label,sort_order,is_custom FROM daily_personal_tasks WHERE user_id=? AND task_date=? AND task_key=? AND is_custom=1').bind(auth.user.id,taskDate,taskKey).first();
      if(!row)return noStore({error:'ไม่พบงานนี้'},404);
      task={...row,is_custom:true};
    }
    await ctx.env.DB.prepare(`INSERT INTO daily_personal_tasks(user_id,task_date,task_key,label,sort_order,is_custom,completed_at,updated_at) VALUES(?,?,?,?,?,?,CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END,CURRENT_TIMESTAMP) ON CONFLICT(user_id,task_date,task_key) DO UPDATE SET completed_at=excluded.completed_at,updated_at=CURRENT_TIMESTAMP`).bind(auth.user.id,taskDate,taskKey,task.label,task.sort_order,task.is_custom?1:0,completed?1:0).run();
  }else return noStore({error:'คำสั่งไม่ถูกต้อง'},400);
  return noStore({ok:true,date:taskDate,tasks:await listTasks(ctx.env,auth.user.id,taskDate)});
}

export async function onRequestDelete(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),taskDate=validDate(body.date),taskKey=String(body.key||'').trim();
  if(!taskDate||!taskKey)return noStore({error:'ข้อมูลไม่ครบ'},400);
  const result=await ctx.env.DB.prepare('DELETE FROM daily_personal_tasks WHERE user_id=? AND task_date=? AND task_key=? AND is_custom=1').bind(auth.user.id,taskDate,taskKey).run();
  if(!Number(result?.meta?.changes))return noStore({error:'ลบได้เฉพาะกิจกรรมที่เพิ่มเอง'},404);
  return noStore({ok:true,date:taskDate,tasks:await listTasks(ctx.env,auth.user.id,taskDate)});
}
