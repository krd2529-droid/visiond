import { json } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { requireCourseAccess } from '../../../_courses.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const access=await requireCourseAccess(ctx,ctx.params.id);if(access.error)return access.error;
  const body=await ctx.request.json().catch(()=>({})),lessonId=Number(body.lesson_id),position=Math.max(0,Math.floor(Number(body.position_seconds)||0)),completed=body.completed?1:0;
  const lesson=await ctx.env.DB.prepare('SELECT id FROM course_lessons WHERE id=? AND course_id=?').bind(lessonId,access.course.id).first();
  if(!lesson)return json({error:'ไม่พบบทเรียน'},404);
  await ctx.env.DB.prepare(`INSERT INTO course_progress(user_id,course_id,lesson_id,last_position_seconds,completed,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id,lesson_id) DO UPDATE SET last_position_seconds=excluded.last_position_seconds,completed=MAX(course_progress.completed,excluded.completed),updated_at=CURRENT_TIMESTAMP`)
    .bind(access.user.id,access.course.id,lessonId,position,completed).run();
  return json({ok:true});
}
