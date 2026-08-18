import {json,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {V14_RIGHTS,canSellWithRights,ensureVision14Schema} from '../../../_vision14.js';
const headers={'cache-control':'private, no-store'},clean=(value,max=500)=>String(value||'').trim().slice(0,max);
async function authorize(ctx){await ensureDatabase(ctx.env);await ensureVision14Schema(ctx.env);return requireBoss(ctx)}
export async function onRequestPut(ctx){
  const auth=await authorize(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>null),rights=clean(body?.rights_status,40),note=clean(body?.rights_note);
  if(!body||!V14_RIGHTS.includes(rights))return json({error:'สถานะสิทธิ์ไม่ถูกต้อง'},400,headers);
  if(rights==='licensed'&&!note)return json({error:'สิทธิ์แบบได้รับอนุญาตต้องมีหมายเหตุหรือหลักฐานอ้างอิง'},400,headers);
  const current=await ctx.env.DB.prepare('SELECT id FROM vision14_sources WHERE id=?').bind(ctx.params.id).first();
  if(!current)return json({error:'ไม่พบต้นฉบับ'},404,headers);
  const eligible=canSellWithRights(rights)?1:0;
  await ctx.env.DB.prepare("UPDATE vision14_sources SET rights_status=?,rights_note=?,sale_eligible=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(rights,note,eligible,ctx.params.id).run();
  return json({ok:true,sale_eligible:Boolean(eligible)},200,headers);
}
