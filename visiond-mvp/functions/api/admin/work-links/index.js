import {json,requireAdmin} from '../../../_lib.js';

const headers={'cache-control':'private, no-store'};
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

async function authorize(ctx){
  const auth=await requireAdmin(ctx);
  if(auth.error)return auth;
  await ctx.env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_work_links(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  try{await ctx.env.DB.prepare("ALTER TABLE admin_work_links ADD COLUMN platform TEXT NOT NULL DEFAULT ''").run()}catch(error){if(!String(error).toLowerCase().includes('duplicate column'))throw error}
  return auth;
}

function validUrl(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return ''}
}

async function list(ctx){
  const params=new URL(ctx.request.url).searchParams,limit=Math.min(24,Math.max(1,Number(params.get('limit'))||24)),raw=String(params.get('cursor')||''),split=raw.lastIndexOf('|'),after=split>0?{at:raw.slice(0,split),id:Number(raw.slice(split+1))}:null,where=[],bindings=[];if(after){where.push('(updated_at<? OR (updated_at=? AND id<?))');bindings.push(after.at,after.at,after.id)}
  const result=await ctx.env.DB.prepare(`SELECT id,label,url,platform,note,created_at,updated_at FROM admin_work_links${where.length?' WHERE '+where.join(' AND '):''} ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(...bindings,limit+1).all(),rows=result.results||[],items=rows.slice(0,limit),last=items.at(-1);
  return {items,pagination:{limit,has_more:rows.length>limit,next_cursor:rows.length>limit&&last?`${last.updated_at}|${last.id}`:null}};
}

export async function onRequestGet(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  return json(await list(ctx),200,headers);
}

export async function onRequestPost(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),label=clean(body.label,120),url=validUrl(clean(body.url,2000)),platform=clean(body.platform,60),note=clean(body.note,500);
  if(!label||!url||!platform)return json({error:'กรุณากรอกชื่องาน แพลตฟอร์ม และลิงก์ http:// หรือ https:// ให้ถูกต้อง'},400,headers);
  await ctx.env.DB.prepare('INSERT INTO admin_work_links(label,url,platform,note,created_by) VALUES(?,?,?,?,?)').bind(label,url,platform,note,auth.user.id).run();
  return json({ok:true,...await list(ctx)},201,headers);
}

export async function onRequestPatch(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),id=Number(body.id),label=clean(body.label,120),url=validUrl(clean(body.url,2000)),platform=clean(body.platform,60),note=clean(body.note,500);
  if(!Number.isInteger(id)||id<1||!label||!url||!platform)return json({error:'ข้อมูลลิงก์ไม่ถูกต้อง'},400,headers);
  const result=await ctx.env.DB.prepare('UPDATE admin_work_links SET label=?,url=?,platform=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(label,url,platform,note,id).run();
  if(!Number(result.meta?.changes))return json({error:'ไม่พบลิงก์นี้'},404,headers);
  return json({ok:true,...await list(ctx)},200,headers);
}

export async function onRequestDelete(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),id=Number(body.id);
  if(!Number.isInteger(id)||id<1)return json({error:'รหัสลิงก์ไม่ถูกต้อง'},400,headers);
  const result=await ctx.env.DB.prepare('DELETE FROM admin_work_links WHERE id=?').bind(id).run();
  if(!Number(result.meta?.changes))return json({error:'ไม่พบลิงก์นี้'},404,headers);
  return json({ok:true,...await list(ctx)},200,headers);
}
