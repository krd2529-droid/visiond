import {json,requireBoss} from '../../../../_lib.js';
export async function onRequestPut(ctx){
  const a=await requireBoss(ctx); if(a.error)return a.error;
  const id=Number(ctx.params.id); const body=await ctx.request.json().catch(()=>({}));
  const role=String(body.role||'').toLowerCase();
  if(!['boss','admin','user'].includes(role))return json({error:'ระดับสมาชิกไม่ถูกต้อง'},400);
  if(id===a.user.id && role!=='boss')return json({error:'Boss ไม่สามารถลดสิทธิ์ตัวเองจากหน้านี้'},400);
  const target=await ctx.env.DB.prepare('SELECT id,role FROM users WHERE id=?').bind(id).first();
  if(!target)return json({error:'ไม่พบสมาชิก'},404);
  if(target.role==='boss' && id!==a.user.id)return json({error:'ไม่อนุญาตให้แก้ Boss คนอื่นจากหน้านี้'},403);
  await ctx.env.DB.prepare('UPDATE users SET role=? WHERE id=?').bind(role,id).run();
  return json({ok:true});
}
