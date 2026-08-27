import {json,requireAdmin} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const course=await ctx.env.DB.prepare(`SELECT c.id,c.product_id,c.expected_episodes,c.total_minutes,c.teacher_name,c.payment_bank_name,c.payment_account_name,c.payment_account_number,p.title,p.price,p.status FROM courses c JOIN products p ON p.id=c.product_id WHERE c.id=? AND c.owner_user_id IS NULL AND COALESCE(c.course_origin,'company')='company' AND c.course_type='online_course' AND p.deleted_at IS NULL`).bind(ctx.params.id).first();
  if(!course)return json({error:'ไม่พบตะกร้าคอร์ส VisionD หรือคอร์สนี้ต้องผ่านระบบผู้ขาย'},403);
  const lessons=await ctx.env.DB.prepare(`SELECT COUNT(*) total,COALESCE(SUM(duration_seconds),0) total_seconds FROM course_lessons WHERE course_id=? AND TRIM(COALESCE(title,''))<>'' AND (video_key IS NOT NULL OR pdf_key IS NOT NULL)`).bind(course.id).first(),count=Number(lessons?.total||0),expected=Number(course.expected_episodes||1);
  if(!String(course.title||'').trim()||!String(course.teacher_name||'').trim())return json({error:'กรุณากรอกชื่อคอร์สและชื่อผู้สอนให้ครบ'},409);
  if(!Number.isInteger(Number(course.expected_episodes))||Number(course.expected_episodes)<1||Number(course.total_minutes)<1||Number(course.price)<0)return json({error:'กรุณากรอกราคา เวลาเนื้อหา และจำนวน EP ให้ถูกต้องก่อนเผยแพร่'},409);
  if(count<expected)return json({error:`เพิ่ม EP พร้อมคลิปหรือเอกสารให้ครบ ${expected} EP ก่อนเผยแพร่ (ตอนนี้ ${count} EP)`},409);
  if(!course.payment_bank_name||!course.payment_account_name||!course.payment_account_number)return json({error:'ข้อมูลบัญชีรับเงินของคอร์สไม่ครบ'},409);
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE courses SET active=1,review_status='approved',approved_at=CURRENT_TIMESTAMP,approved_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_user_id IS NULL AND COALESCE(course_origin,'company')='company'").bind(auth.user.id,course.id),
    ctx.env.DB.prepare("UPDATE products SET status='published',pages=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(count,course.product_id)
  ]);
  return json({ok:true,id:course.id,status:'published',review_status:'approved',lesson_count:count},200,{'cache-control':'no-store'});
}
