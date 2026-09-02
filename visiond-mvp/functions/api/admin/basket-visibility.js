import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {loadBasketVisibility,saveBasketVisibility} from '../../_basket_visibility.js';
const headers={'cache-control':'no-store'};
async function auth(ctx){await ensureDatabase(ctx.env);const result=await requireAdmin(ctx);return result.error?{error:result.error}:result}
export async function onRequestGet(ctx){const access=await auth(ctx);if(access.error)return access.error;return json({rule:await loadBasketVisibility(ctx.env)},200,headers)}
export async function onRequestPut(ctx){const access=await auth(ctx);if(access.error)return access.error;try{const rule=await saveBasketVisibility(ctx.env,await ctx.request.json().catch(()=>({})));return json({ok:true,rule,message:rule.mode==='all'?`${rule.action==='open'?'เปิด':'ปิด'}ตะกร้า VisionD ทั้งหมดแล้ว`:`${rule.action==='open'?'เปิด':'ปิด'}เฉพาะชื่อขึ้นต้น ${rule.prefixes.join(', ')} แล้ว`},200,headers)}catch(error){return json({error:error.message||'บันทึกไม่สำเร็จ'},400,headers)}}
