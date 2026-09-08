import { json } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { requireCourseAccess } from '../../../_courses.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const access=await requireCourseAccess(ctx,ctx.params.id);if(access.error)return access.error;
  const body=await ctx.request.json().catch(()=>({})),lessonId=Number(body.lesson_id),rawPosition=Number(body.position_seconds),completed=(body.completed===true||body.completed===1)?1:0;
  if(!Number.isInteger(lessonId)||lessonId<1||!Number.isFinite(rawPosition))return json({error:'ข้อมูลความคืบหน้าไม่ถูกต้อง'},400);
  const lesson=await ctx.env.DB.prepare(`SELECT l.id,l.duration_seconds,COALESCE(cp.last_position_seconds,0) saved_position,COALESCE(cp.completed,0) saved_completed
    FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=?
    WHERE l.id=? AND l.course_id=?`).bind(access.user.id,lessonId,access.course.id).first();
  if(!lesson)return json({error:'ไม่พบบทเรียน'},404);
  // Seller-entered duration is descriptive metadata and may be shorter than the
  // actual uploaded video. Do not use it to move a learner backwards on resume.
  const position=Math.min(Math.max(0,Math.floor(rawPosition)),86400);
  if(position<=Number(lesson.saved_position||0)&&completed<=Number(lesson.saved_completed||0)){
    return json({ok:true,changed:false},200,{'cache-control':'no-store'});
  }
  await ctx.env.DB.prepare(`INSERT INTO course_progress(user_id,course_id,lesson_id,last_position_seconds,completed,updated_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(user_id,lesson_id) DO UPDATE SET last_position_seconds=MAX(course_progress.last_position_seconds,excluded.last_position_seconds),completed=MAX(course_progress.completed,excluded.completed),updated_at=CURRENT_TIMESTAMP`)
    .bind(access.user.id,access.course.id,lessonId,position,completed).run();
  return json({ok:true,changed:true,lesson_id:lessonId,position_seconds:Math.max(position,Number(lesson.saved_position)||0),completed:Boolean(completed||Number(lesson.saved_completed))},200,{'cache-control':'no-store'});
}
