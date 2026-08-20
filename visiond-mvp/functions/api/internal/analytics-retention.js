import {json} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {maintainAnalyticsRetention} from '../../_analytics.js';
import {purgeExpiredTrash} from '../../_trash.js';

const noStore={'cache-control':'private, no-store'};
async function digest(value){return new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))}
async function validToken(request,secret){
  const expected=String(secret||''),header=request.headers.get('authorization')||'',provided=header.startsWith('Bearer ')?header.slice(7):'';
  if(expected.length<32||!provided||provided.length>512)return false;
  const [a,b]=await Promise.all([digest(expected),digest(provided)]);let different=a.length===b.length?0:1;
  for(let i=0;i<Math.min(a.length,b.length);i++)different|=a[i]^b[i];
  return different===0;
}
export async function onRequestPost(ctx){
  if(!(await validToken(ctx.request,ctx.env.ANALYTICS_CLEANUP_TOKEN)))return json({error:'ไม่อนุญาต'},401,noStore);
  await ensureDatabase(ctx.env);
  const result=await maintainAnalyticsRetention(ctx.env),trash=await purgeExpiredTrash(ctx.env);
  return json({ok:true,...result,trash,completed_at:new Date().toISOString()},200,noStore);
}
export async function onRequestGet(){return json({error:'ใช้ POST เท่านั้น'},405,{...noStore,allow:'POST'})}
