import {json,requireAdmin} from '../../_lib.js';
import {isElonV7Enabled,isElonWebEnabled,setElonEnabled} from '../../_elon_databases.js';
const noStore={'cache-control':'no-store'};
const boss=async ctx=>{const auth=await requireAdmin(ctx);if(auth.error)return auth;if(auth.user.role!=='boss')return {error:json({error:'เฉพาะ Boss จัดการสวิตช์ ELON ได้'},403,noStore)};return auth};
async function state(env){
  const read=async fn=>{try{return {configured:true,enabled:await fn(env)}}catch(error){return {configured:false,enabled:false,error:String(error?.message||'BINDING_REQUIRED')}}};
  return {web:await read(isElonWebEnabled),v7:await read(isElonV7Enabled)};
}
export async function onRequestGet(ctx){const auth=await boss(ctx);if(auth.error)return auth.error;return json({items:await state(ctx.env)},200,noStore)}
export async function onRequestPut(ctx){
  const auth=await boss(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>null),target=String(body?.target||''),enabled=body?.enabled;
  if(!['web','v7'].includes(target)||typeof enabled!=='boolean')return json({error:'ข้อมูลสวิตช์ไม่ถูกต้อง'},400,noStore);
  try{await setElonEnabled(ctx.env,target,enabled)}catch(error){return json({error:`ยังไม่ได้ตั้งฐาน ${target==='web'?'ELON_WEB_DB':'ELON_V7_DB'}`},503,noStore)}
  return json({items:await state(ctx.env)},200,noStore);
}
