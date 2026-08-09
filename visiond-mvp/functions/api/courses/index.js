import { json, currentUser } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const user = await currentUser(ctx);
  const staff = user && ['boss','admin'].includes(user.role);
  const visibility = staff
    ? `1=1`
    : user
      ? `(c.active=1 AND p.status='published' OR EXISTS(SELECT 1 FROM entitlements owned_e WHERE owned_e.user_id=? AND owned_e.product_id=p.id AND owned_e.active=1))`
      : `c.active=1 AND p.status='published'`;
  let query = ctx.env.DB.prepare(`SELECT c.id,c.subtitle,c.teacher_name,c.total_minutes,c.course_type,c.course_origin,c.platform_tags,c.learner_level,c.expected_episodes,c.active,c.review_status,p.status product_status,p.id product_id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id) lesson_count
    FROM courses c JOIN products p ON p.id=c.product_id
    WHERE c.course_type='online_course' AND p.deleted_at IS NULL AND (${visibility}) ORDER BY p.id DESC`);
  if(user&&!staff)query=query.bind(user.id);
  const { results } = await query.all();
  if (user) for (const course of results) {
    course.owned = staff ? 1 : Number(!!(await ctx.env.DB.prepare('SELECT id FROM entitlements WHERE user_id=? AND product_id=? AND active=1 LIMIT 1').bind(user.id,course.product_id).first()));
    if (course.owned) {
      const progress = await ctx.env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN cp.completed=1 THEN 1 ELSE 0 END) completed,MAX(cp.updated_at) last_activity_at
        FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=? WHERE l.course_id=?`).bind(user.id,course.id).first();
      const resume = await ctx.env.DB.prepare(`SELECT l.id lesson_id,COALESCE(cp.last_position_seconds,0) position_seconds,cp.updated_at
        FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=?
        WHERE l.course_id=? AND COALESCE(cp.completed,0)=0
        ORDER BY CASE WHEN cp.updated_at IS NULL THEN 1 ELSE 0 END,cp.updated_at DESC,l.sort_order,l.id LIMIT 1`).bind(user.id,course.id).first();
      course.total_lessons=Number(progress?.total)||0;
      course.completed_lessons=Number(progress?.completed)||0;
      course.total=course.total_lessons;
      course.completed=course.completed_lessons;
      course.progress_percent=course.total_lessons?Math.round(course.completed_lessons*100/course.total_lessons):0;
      course.resume_lesson_id=resume?.lesson_id||null;
      course.resume_position_seconds=Number(resume?.position_seconds)||0;
      course.resume_position=course.resume_position_seconds;
      course.last_activity_at=progress?.last_activity_at||null;
      course.last_activity=course.last_activity_at;
      course.access_blocked=!staff&&course.review_status==='suspended';
    }
  }
  return json({ items: results },200,{'cache-control':'no-store'});
}
