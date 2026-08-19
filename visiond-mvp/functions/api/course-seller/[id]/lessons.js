import {json,requireUser} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

const safeExt=name=>{const x=String(name||'').split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g,'');return x?.slice(0,12)||'bin'};
const editable=course=>!course.edit_expires_at||Date.parse(course.edit_expires_at)>Date.now();
async function owned(ctx,user){return ctx.env.DB.prepare("SELECT c.id,c.product_id,c.license_entitlement_id,c.edit_expires_at,c.course_plan FROM courses c JOIN products p ON p.id=c.product_id WHERE c.id=? AND c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL").bind(ctx.params.id,user.id).first()}
async function hasPaidSale(ctx,courseId){return Boolean(await ctx.env.DB.prepare("SELECT id FROM orders WHERE seller_course_id=? AND status IN ('pending_review','paid') LIMIT 1").bind(courseId).first())}
const readySql=`(video_key IS NOT NULL OR pdf_key IS NOT NULL OR EXISTS(SELECT 1 FROM course_lesson_files f WHERE f.lesson_id=course_lessons.id))`;

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const course=await owned(ctx,auth.user);if(!course)return json({error:'ไม่พบคอร์ส'},404);
  await ctx.env.DB.prepare(`DELETE FROM course_lessons WHERE course_id=? AND TRIM(COALESCE(title,''))='' AND NOT ${readySql}`).bind(course.id).run();
  const rows=await ctx.env.DB.prepare(`SELECT id,title,description,sort_order,duration_seconds,CASE WHEN video_key IS NULL THEN 0 ELSE 1 END has_video,CASE WHEN pdf_key IS NULL THEN 0 ELSE 1 END has_legacy_document,CASE WHEN ${readySql} THEN 1 ELSE 0 END is_complete FROM course_lessons WHERE course_id=? ORDER BY sort_order,id`).bind(course.id).all();
  const lessons=rows.results||[],filesByLesson=new Map();
  if(lessons.length){const files=await ctx.env.DB.prepare('SELECT f.id,f.lesson_id,f.file_name,f.mime_type,f.file_size,f.sort_order FROM course_lesson_files f JOIN course_lessons l ON l.id=f.lesson_id WHERE l.course_id=? ORDER BY f.lesson_id,f.sort_order,f.id').bind(course.id).all();for(const file of files.results||[]){const {lesson_id,...asset}=file,key=String(lesson_id),group=filesByLesson.get(key)||[];group.push(asset);filesByLesson.set(key,group)}}
  for(const lesson of lessons){lesson.files=filesByLesson.get(String(lesson.id))||[];lesson.file_count=lesson.files.length+(lesson.has_legacy_document?1:0)}
  return json({items:lessons,editable:editable(course)},200,{'cache-control':'no-store'});
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const course=await owned(ctx,auth.user);if(!course)return json({error:'ไม่พบคอร์ส'},404);
  if(await hasPaidSale(ctx,course.id))return json({error:'หลังมียอดขาย เปลี่ยนแปลงเนื้อหาทั้งหมดไม่ได้ หากแก้ข้อผิดพลาดภายในต้องติดต่อ VisionD เท่านั้น'},409);
  if(!editable(course))return json({error:'หมดระยะเวลาแก้ไข 30 วันแล้ว'},403);
  const form=await ctx.request.formData(),title=String(form.get('title')||'').trim().slice(0,200),description=String(form.get('description')||'').slice(0,5000),duration=Number(form.get('duration_seconds')||0),video=form.get('video'),documents=form.getAll('documents').filter(x=>x instanceof File&&x.size),videoPending=form.get('video_upload_pending')==='1';
  if(!title)return json({error:'กรุณาใส่ชื่อ EP'},400);
  if(!Number.isInteger(duration)||duration<0||duration>86400)return json({error:'ระยะเวลาต้องเป็นวินาทีจำนวนเต็ม 0–86,400'},400);
  if(!video?.size&&!documents.length&&!videoPending)return json({error:'แนบคลิปหรือเอกสารอย่างน้อยหนึ่งไฟล์'},400);
  if(video?.size&&(!['video/mp4','video/webm'].includes(video.type)||video.size>200*1024*1024))return json({error:'คลิปต้องเป็น MP4 หรือ WEBM ไม่เกิน 200 MB'},400);
  if(documents.length>20)return json({error:'แนบไฟล์ประกอบได้ไม่เกิน 20 ไฟล์ต่อครั้ง'},400);
  if(documents.some(file=>file.size>200*1024*1024))return json({error:'ไฟล์ประกอบแต่ละไฟล์ต้องไม่เกิน 200 MB'},400);
  let videoKey=null,uploaded=[],createdLessonId=null;
  try{
    if(video?.size){videoKey=`seller-course-${course.id}-video-${crypto.randomUUID()}.${safeExt(video.name)}`;await ctx.env.FILES.put(videoKey,video.stream(),{httpMetadata:{contentType:video.type}})}
    for(let i=0;i<documents.length;i++){const file=documents[i],key=`seller-course-${course.id}-file-${crypto.randomUUID()}.${safeExt(file.name)}`;await ctx.env.FILES.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'}});uploaded.push({key,file})}
    const statements=[];
    const max=await ctx.env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM course_lessons WHERE course_id=?').bind(course.id).first();
    const result=await ctx.env.DB.prepare('INSERT INTO course_lessons(course_id,title,description,sort_order,video_key,video_mime,duration_seconds) VALUES(?,?,?,?,?,?,?)').bind(course.id,title,description,Number(max.n)+10,videoKey,video?.type||null,duration).run();
    const lessonId=result.meta.last_row_id;createdLessonId=lessonId;
    uploaded.forEach(({key,file},i)=>statements.push(ctx.env.DB.prepare('INSERT INTO course_lesson_files(lesson_id,object_key,file_name,mime_type,file_size,sort_order) VALUES(?,?,?,?,?,?)').bind(lessonId,key,String(file.name||`file-${i+1}`).slice(0,240),file.type||'application/octet-stream',file.size,(i+1)*10)));
    statements.push(ctx.env.DB.prepare(`UPDATE courses SET expected_episodes=(SELECT COUNT(*) FROM course_lessons WHERE course_id=? AND TRIM(COALESCE(title,''))<>'' AND ${readySql}),total_minutes=(SELECT CAST(COALESCE(SUM(duration_seconds),0)/60 AS INTEGER) FROM course_lessons WHERE course_id=?),review_status=CASE WHEN license_entitlement_id IS NULL THEN 'draft' ELSE 'pending' END,submitted_at=CASE WHEN license_entitlement_id IS NULL THEN submitted_at ELSE CURRENT_TIMESTAMP END,active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(course.id,course.id,course.id));statements.push(ctx.env.DB.prepare(`UPDATE products SET pages=(SELECT COUNT(*) FROM course_lessons WHERE course_id=? AND TRIM(COALESCE(title,''))<>'' AND ${readySql}),status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(course.id,course.product_id));await ctx.env.DB.batch(statements);
    return json({ok:true,id:lessonId,file_count:documents.length,message:`บันทึก EP และไฟล์ประกอบ ${documents.length} ไฟล์แล้ว`},201);
  }catch(error){if(createdLessonId)await ctx.env.DB.prepare('DELETE FROM course_lessons WHERE id=? AND course_id=?').bind(createdLessonId,course.id).run().catch(()=>{});if(videoKey)await ctx.env.FILES.delete(videoKey).catch(()=>{});for(const item of uploaded)await ctx.env.FILES.delete(item.key).catch(()=>{});return json({error:'อัปโหลด EP ไม่สำเร็จ กรุณาลองใหม่'},500)}
}
