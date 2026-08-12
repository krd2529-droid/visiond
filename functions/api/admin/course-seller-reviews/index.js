import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const profiles=await ctx.env.DB.prepare("SELECT id,name,email,phone,seller_bank_name,seller_account_name,seller_account_number,seller_payment_status,seller_payment_submitted_at FROM users WHERE seller_payment_status IN ('pending','rejected') ORDER BY seller_payment_submitted_at DESC").all();
  const courses=await ctx.env.DB.prepare(`SELECT c.id,c.owner_user_id,c.teacher_name,c.contact_info,c.platform_tags,c.learner_level,c.expected_episodes,c.review_status,c.review_note,c.submitted_at,c.edit_expires_at,p.title,p.short_description,p.description,p.price,p.cover_url,u.name owner_name,u.email owner_email,u.seller_payment_status,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id) lesson_count,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id AND (TRIM(COALESCE(l.title,''))='' OR (l.video_key IS NULL AND l.pdf_key IS NULL AND NOT EXISTS(SELECT 1 FROM course_lesson_files f WHERE f.lesson_id=l.id)))) incomplete_lesson_count
    FROM courses c JOIN products p ON p.id=c.product_id JOIN users u ON u.id=c.owner_user_id WHERE c.course_type='online_course' AND c.course_origin='seller_rights' AND c.review_status IN ('pending','changes_requested','approved','suspended') AND p.deleted_at IS NULL ORDER BY CASE c.review_status WHEN 'pending' THEN 0 WHEN 'changes_requested' THEN 1 WHEN 'suspended' THEN 2 ELSE 3 END,c.submitted_at DESC,c.id DESC`).all();
  return json({profiles:profiles.results||[],courses:courses.results||[]});
}
