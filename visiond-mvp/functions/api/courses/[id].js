import { json } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';
import { requireCourseAccess } from '../../_courses.js';

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  const access=await requireCourseAccess(ctx,ctx.params.id); if(access.error)return access.error;
  const { results }=await ctx.env.DB.prepare(`SELECT l.id,l.title,l.description,l.episode_label,l.sort_order,l.duration_seconds,
    CASE WHEN l.video_key IS NULL THEN 0 ELSE 1 END has_video,CASE WHEN l.pdf_key IS NULL THEN 0 ELSE 1 END has_pdf,l.pdf_mime,l.document_name,
    COALESCE(cp.last_position_seconds,0) last_position_seconds,COALESCE(cp.completed,0) completed,cp.updated_at progress_updated_at
    FROM course_lessons l LEFT JOIN course_progress cp ON cp.lesson_id=l.id AND cp.user_id=?
    WHERE l.course_id=? ORDER BY l.sort_order,l.id`).bind(access.user.id,access.course.id).all();
  const filesByLesson=new Map();
  if(results.length){
    const files=await ctx.env.DB.prepare(`SELECT f.id,f.lesson_id,f.file_name,f.mime_type,f.file_size,f.sort_order FROM course_lesson_files f JOIN course_lessons l ON l.id=f.lesson_id WHERE l.course_id=? ORDER BY f.lesson_id,f.sort_order,f.id`).bind(access.course.id).all();
    for(const file of files.results||[]){const {lesson_id,...asset}=file,key=String(lesson_id),group=filesByLesson.get(key)||[];group.push(asset);filesByLesson.set(key,group)}
  }
  for(const lesson of results){lesson.files=filesByLesson.get(String(lesson.id))||[];lesson.file_count=lesson.files.length+(lesson.has_pdf?1:0)}
  const total=results.length,completed=results.filter(lesson=>Number(lesson.completed)===1).length;
  const started=results.filter(lesson=>!Number(lesson.completed)&&lesson.progress_updated_at).sort((a,b)=>String(b.progress_updated_at).localeCompare(String(a.progress_updated_at)))[0];
  const resume=started||results.find(lesson=>!Number(lesson.completed))||null;
  const lastActivity=results.reduce((latest,lesson)=>!lesson.progress_updated_at||String(lesson.progress_updated_at)<=String(latest||'')?latest:lesson.progress_updated_at,null);
  const progress={
    total_lessons:total,
    completed_lessons:completed,
    total,
    completed,
    progress_percent:total?Math.round(completed*100/total):0,
    resume_lesson_id:resume?.id||null,
    resume_position_seconds:Number(resume?.last_position_seconds)||0,
    resume_position:Number(resume?.last_position_seconds)||0,
    last_activity_at:lastActivity,
    last_activity:lastActivity,
    is_completed:total>0&&completed===total
  };
  return json({ course:{...access.course,...progress},lessons:results,progress },200,{'cache-control':'no-store'});
}
