import { json, currentUser } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const user = await currentUser(ctx);
  const { results } = await ctx.env.DB.prepare(`SELECT c.id,c.subtitle,c.teacher_name,c.total_minutes,c.course_type,c.course_origin,c.platform_tags,c.learner_level,c.expected_episodes,p.id product_id,p.slug,p.title,p.short_description,p.description,p.price,p.cover_url,
    (SELECT COUNT(*) FROM course_lessons l WHERE l.course_id=c.id) lesson_count
    FROM courses c JOIN products p ON p.id=c.product_id
    WHERE c.active=1 AND c.course_type='online_course' AND p.status='published' AND p.deleted_at IS NULL ORDER BY p.id DESC`).all();
  if (user) for (const course of results) {
    const staff = ['boss','admin'].includes(user.role);
    course.owned = staff ? 1 : Number(!!(await ctx.env.DB.prepare('SELECT id FROM entitlements WHERE user_id=? AND product_id=? AND active=1 LIMIT 1').bind(user.id,course.product_id).first()));
    if (course.owned) {
      const progress = await ctx.env.DB.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN cp.completed=1 THEN 1 ELSE 0 END) completed
        FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=? WHERE l.course_id=?`).bind(user.id,course.id).first();
      course.completed_lessons=Number(progress?.completed)||0;
    }
  }
  return json({ items: results },200,{'cache-control':'no-store'});
}
