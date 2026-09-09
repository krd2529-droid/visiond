import {json,requireAdmin} from '../../../_lib.js';

const headers={'cache-control':'private, no-store'};
const clean=(value,max=500)=>String(value??'').trim().slice(0,max);
const cursorTimePattern=/^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/;
const firstPage={limit:24,after:null};

class WorkLinksRequestError extends Error{
  constructor(message,code){super(message);this.code=code}
}

async function authorize(ctx){return requireAdmin(ctx,{includeCourseOwner:false})}
function privateResponse(response){const next=new Response(response.body,response);next.headers.set('cache-control','private, no-store');return next}

function validUrl(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)?url.href:''}catch{return ''}
}

function validCursorTime(value){
  if(!cursorTimePattern.test(value))return false;
  const parsed=new Date(`${value.replace(' ','T')}Z`);
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,19).replace('T',' ')===value.slice(0,19)
}

function pageParams(requestUrl){
  const params=new URL(requestUrl).searchParams,limitValue=params.get('limit');
  if(limitValue!==null&&!/^(?:[1-9]|1\d|2[0-4])$/.test(limitValue))throw new WorkLinksRequestError('จำนวนรายการต่อหน้าไม่ถูกต้อง','WORK_LINKS_LIMIT_INVALID');
  const limit=limitValue===null?24:Number(limitValue),raw=params.get('cursor');
  if(raw===null||raw==='')return{limit,after:null};
  if(raw.length>128)throw new WorkLinksRequestError('ตัวชี้หน้ารายการไม่ถูกต้อง','WORK_LINKS_CURSOR_INVALID');
  const split=raw.lastIndexOf('|'),at=split>0?raw.slice(0,split):'',idValue=split>0?raw.slice(split+1):'';
  if(!validCursorTime(at)||!/^[1-9]\d*$/.test(idValue))throw new WorkLinksRequestError('ตัวชี้หน้ารายการไม่ถูกต้อง','WORK_LINKS_CURSOR_INVALID');
  const id=Number(idValue);
  if(!Number.isSafeInteger(id))throw new WorkLinksRequestError('ตัวชี้หน้ารายการไม่ถูกต้อง','WORK_LINKS_CURSOR_INVALID');
  return{limit,after:{at,id}};
}

function listStatement(ctx,page){
  const bindings=[];
  let where='';
  if(page.after){where=' WHERE (updated_at,id)<(?,?)';bindings.push(page.after.at,page.after.id)}
  return ctx.env.DB.prepare(`SELECT id,label,url,platform,note,created_at,updated_at FROM admin_work_links${where} ORDER BY updated_at DESC,id DESC LIMIT ?`).bind(...bindings,page.limit+1)
}
function listResult(result,page){
  const rows=result.results||[],items=rows.slice(0,page.limit),last=items.at(-1);
  return{items,pagination:{limit:page.limit,has_more:rows.length>page.limit,next_cursor:rows.length>page.limit&&last?`${last.updated_at}|${last.id}`:null}};
}
async function list(ctx,page=pageParams(ctx.request.url)){return listResult(await listStatement(ctx,page).all(),page)}

function schemaUnavailable(error){return /no such table:\s*(?:main\.)?admin_work_links|no such column:\s*(?:admin_work_links\.)?(?:platform|updated_at)|table\s+admin_work_links\s+has no column named\s+(?:platform|updated_at)/i.test(String(error?.message||error))}
function errorResponse(error){
  if(error instanceof WorkLinksRequestError)return json({error:error.message,code:error.code},400,headers);
  if(schemaUnavailable(error))return json({error:'ระบบลิงก์งานยังไม่พร้อม กรุณาติดตั้ง migration แล้วลองใหม่',code:'WORK_LINKS_SCHEMA_REQUIRED'},503,headers);
  return json({error:'ไม่สามารถทำรายการลิงก์งานได้ กรุณาลองใหม่',code:'WORK_LINKS_FAILED'},500,headers);
}

export async function onRequestGet(ctx){
  try{const auth=await authorize(ctx);if(auth.error)return privateResponse(auth.error);return json(await list(ctx),200,headers)}catch(error){return errorResponse(error)}
}

export async function onRequestPost(ctx){
  try{
    const auth=await authorize(ctx);if(auth.error)return privateResponse(auth.error);
    pageParams(ctx.request.url);
    const body=await ctx.request.json().catch(()=>({})),label=clean(body.label,120),url=validUrl(clean(body.url,2000)),platform=clean(body.platform,60),note=clean(body.note,500);
    if(!label||!url||!platform)return json({error:'กรุณากรอกชื่องาน แพลตฟอร์ม และลิงก์ http:// หรือ https:// ให้ถูกต้อง'},400,headers);
    const result=await ctx.env.DB.batch([ctx.env.DB.prepare('INSERT INTO admin_work_links(label,url,platform,note,created_by) VALUES(?,?,?,?,?)').bind(label,url,platform,note,auth.user.id),listStatement(ctx,firstPage)]);
    return json({ok:true,...listResult(result[1],firstPage)},201,headers);
  }catch(error){return errorResponse(error)}
}

export async function onRequestPatch(ctx){
  try{
    const auth=await authorize(ctx);if(auth.error)return privateResponse(auth.error);
    pageParams(ctx.request.url);
    const body=await ctx.request.json().catch(()=>({})),id=Number(body.id),label=clean(body.label,120),url=validUrl(clean(body.url,2000)),platform=clean(body.platform,60),note=clean(body.note,500);
    if(!Number.isSafeInteger(id)||id<1||!label||!url||!platform)return json({error:'ข้อมูลลิงก์ไม่ถูกต้อง'},400,headers);
    const result=await ctx.env.DB.batch([ctx.env.DB.prepare('UPDATE admin_work_links SET label=?,url=?,platform=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(label,url,platform,note,id),listStatement(ctx,firstPage)]);
    if(!Number(result[0].meta?.changes))return json({error:'ไม่พบลิงก์นี้'},404,headers);
    return json({ok:true,...listResult(result[1],firstPage)},200,headers);
  }catch(error){return errorResponse(error)}
}

export async function onRequestDelete(ctx){
  try{
    const auth=await authorize(ctx);if(auth.error)return privateResponse(auth.error);
    pageParams(ctx.request.url);
    const body=await ctx.request.json().catch(()=>({})),id=Number(body.id);
    if(!Number.isSafeInteger(id)||id<1)return json({error:'รหัสลิงก์ไม่ถูกต้อง'},400,headers);
    const result=await ctx.env.DB.batch([ctx.env.DB.prepare('DELETE FROM admin_work_links WHERE id=?').bind(id),listStatement(ctx,firstPage)]);
    if(!Number(result[0].meta?.changes))return json({error:'ไม่พบลิงก์นี้'},404,headers);
    return json({ok:true,...listResult(result[1],firstPage)},200,headers);
  }catch(error){return errorResponse(error)}
}
