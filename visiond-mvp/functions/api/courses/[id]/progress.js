import { json } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { requireCourseAccess } from '../../../_courses.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const access=await requireCourseAccess(ctx,ctx.params.id);if(access.error)return access.error;
  const body=await ctx.request.json().catch(()=>({})),lessonId=Number(body.lesson_id),rawPosition=Number(body.position_seconds),completed=(body.completed===true||body.completed===1)?1:0;
  if(!Number.isInteger(lessonId)||lessonId<1||!Number.isFinite(rawPosition))return json({error:'ข้อมูลความคืบหน้าไม่ถูกต้อง'},400);
  const lesson=await ctx.env.DB.prepare('SELECT id,duration_seconds FROM course_lessons WHERE id=? AND course_id=?').bind(lessonId,access.course.id).first();
  if(!lesson)return json({error:'ไม่พบบทเรียน'},404);
  const position=Math.min(Math.max(0,Math.floor(rawPosition)),Math.max(0,Number(lesson.duration_seconds)||0)||86400);
  await ctx.env.DB.prepare(`INSERT INTO course_progress(user_id,course_id,lesson_id,last_position_seconds,completed,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id,lesson_id) DO UPDATE SET last_position_seconds=excluded.last_position_seconds,completed=MAX(course_progress.completed,excluded.completed),updated_at=CURRENT_TIMESTAMP`)
    .bind(access.user.id,access.course.id,lessonId,position,completed).run();
  const summary=await ctx.env.DB.prepare(`SELECT COUNT(*) total_lessons,SUM(CASE WHEN cp.completed=1 THEN 1 ELSE 0 END) completed_lessons,MAX(cp.updated_at) last_activity_at
    FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=? WHERE l.course_id=?`).bind(access.user.id,access.course.id).first();
  const resume=await ctx.env.DB.prepare(`SELECT l.id lesson_id,COALESCE(cp.last_position_seconds,0) position_seconds
    FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=?
    WHERE l.course_id=? AND COALESCE(cp.completed,0)=0
    ORDER BY CASE WHEN cp.updated_at IS NULL THEN 1 ELSE 0 END,cp.updated_at DESC,l.sort_order,l.id LIMIT 1`).bind(access.user.id,access.course.id).first();
  const total=Number(summary?.total_lessons)||0,done=Number(summary?.completed_lessons)||0;
  const resumePosition=Number(resume?.position_seconds)||0,lastActivity=summary?.last_activity_at||null;
  return json({ok:true,progress:{total_lessons:total,completed_lessons:done,total,completed:done,progress_percent:total?Math.round(done*100/total):0,resume_lesson_id:resume?.lesson_id||null,resume_position_seconds:resumePosition,resume_position:resumePosition,last_activity_at:lastActivity,last_activity:lastActivity,is_completed:total>0&&done===total}},200,{'cache-control':'no-store'});
}
