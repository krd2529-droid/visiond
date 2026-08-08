import { json, requireAdmin } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),course=await ctx.env.DB.prepare('SELECT * FROM courses WHERE id=?').bind(ctx.params.id).first();if(!course)return json({error:'ไม่พบคอร์ส'},404);
  const price=Math.round(Number(body.price_baht)*100);if(!body.title||!Number.isFinite(price)||price<0)return json({error:'ข้อมูลคอร์สไม่ถูกต้อง'},400);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare('UPDATE courses SET subtitle=?,teacher_name=?,active=?,course_type=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(String(body.subtitle||''),String(body.teacher_name||''),body.active?1:0,body.course_type==='resale_rights'?'resale_rights':'online_course',course.id),
    ctx.env.DB.prepare('UPDATE products SET title=?,short_description=?,description=?,price=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(String(body.title).trim(),String(body.short_description||''),String(body.description||''),price,body.active?'published':'draft',course.product_id)
  ]);return json({ok:true});
}
