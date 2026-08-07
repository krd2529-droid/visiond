import { json } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';
import { requireCourseAccess } from '../../_courses.js';

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const access=await requireCourseAccess(ctx,ctx.params.id); if(access.error)return access.error;
  const { results }=await ctx.env.DB.prepare(`SELECT l.id,l.title,l.description,l.sort_order,l.duration_seconds,
    CASE WHEN l.video_key IS NULL THEN 0 ELSE 1 END has_video,CASE WHEN l.pdf_key IS NULL THEN 0 ELSE 1 END has_pdf,
    COALESCE(cp.last_position_seconds,0) last_position_seconds,COALESCE(cp.completed,0) completed,cp.updated_at progress_updated_at
    FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=?
    WHERE l.course_id=? ORDER BY l.sort_order,l.id`).bind(access.user.id,access.course.id).all();
  return json({ course:access.course,lessons:results },200,{'cache-control':'no-store'});
}
