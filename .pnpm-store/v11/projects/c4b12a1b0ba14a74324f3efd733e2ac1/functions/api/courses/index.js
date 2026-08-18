import { json, currentUser } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const user = await currentUser(ctx);
  const userId = Number(user?.id) || 0;
  const staff = Boolean(user && ['boss', 'admin'].includes(user.role));

  // Keep this endpoint at one data query regardless of the number of courses.
  // lesson_state is also the common source for aggregate progress and resume.
  const { results = [] } = await ctx.env.DB.prepare(`
    WITH
    owned_products AS (
      SELECT product_id
      FROM entitlements
      WHERE user_id=? AND active=1
      GROUP BY product_id
    ),
    lesson_state AS (
      SELECT l.id lesson_id,l.course_id,l.sort_order,
        COALESCE(cp.completed,0) completed,
        COALESCE(cp.last_position_seconds,0) position_seconds,
        cp.updated_at
      FROM course_lessons l
      LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=?
    ),
    progress AS (
      SELECT course_id,COUNT(*) total_lessons,
        SUM(CASE WHEN completed=1 THEN 1 ELSE 0 END) completed_lessons,
        MAX(updated_at) last_activity_at
      FROM lesson_state
      GROUP BY course_id
    ),
    resume_candidates AS (
      SELECT course_id,lesson_id,position_seconds,updated_at,
        ROW_NUMBER() OVER (
          PARTITION BY course_id
          ORDER BY CASE WHEN updated_at IS NULL THEN 1 ELSE 0 END,
            updated_at DESC,sort_order,lesson_id
        ) resume_rank
      FROM lesson_state
      WHERE completed=0
    )
    SELECT c.id,c.subtitle,c.teacher_name,c.total_minutes,c.course_type,c.course_plan,
      c.course_origin,c.platform_tags,c.learner_level,c.expected_episodes,
      c.active,c.review_status,p.status product_status,p.id product_id,p.slug,
      p.title,p.short_description,p.description,p.price,p.cover_url,
      COALESCE(pr.total_lessons,0) lesson_count,
      CASE WHEN op.product_id IS NULL THEN 0 ELSE 1 END owned,
      ? can_preview,
      COALESCE(pr.total_lessons,0) total_lessons,
      COALESCE(pr.completed_lessons,0) completed_lessons,
      COALESCE(pr.total_lessons,0) total,
      COALESCE(pr.completed_lessons,0) completed,
      CASE WHEN COALESCE(pr.total_lessons,0)>0
        THEN ROUND(COALESCE(pr.completed_lessons,0)*100.0/pr.total_lessons)
        ELSE 0 END progress_percent,
      rc.lesson_id resume_lesson_id,
      COALESCE(rc.position_seconds,0) resume_position_seconds,
      COALESCE(rc.position_seconds,0) resume_position,
      pr.last_activity_at,
      pr.last_activity_at last_activity,
      CASE WHEN op.product_id IS NOT NULL AND ?=0 AND c.review_status='suspended'
        THEN 1 ELSE 0 END access_blocked
    FROM courses c
    JOIN products p ON p.id=c.product_id
    LEFT JOIN owned_products op ON op.product_id=p.id
    LEFT JOIN progress pr ON pr.course_id=c.id
    LEFT JOIN resume_candidates rc ON rc.course_id=c.id AND rc.resume_rank=1
    WHERE c.course_type='online_course' AND p.deleted_at IS NULL
      AND (?=1 OR (c.active=1 AND p.status='published') OR op.product_id IS NOT NULL)
    ORDER BY p.id DESC
  `).bind(userId, userId, staff ? 1 : 0, staff ? 1 : 0, staff ? 1 : 0).all();

  return json({ items: results }, 200, { 'cache-control': 'no-store' });
}
