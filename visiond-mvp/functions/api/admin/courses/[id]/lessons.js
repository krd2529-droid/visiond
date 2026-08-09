import { json, requireAdmin } from '../../../../_lib.js';
import { ensureDatabase } from '../../../../_schema.js';

const extension=(name,type)=>String(name||'').split('.').pop()?.toLowerCase()||({"video/mp4":'mp4',"video/webm":'webm',"application/pdf":'pdf'}[type]||'bin');
async function companyCourse(ctx){return ctx.env.DB.prepare("SELECT id FROM courses WHERE id=? AND owner_user_id IS NULL AND COALESCE(course_origin,'company')='company' AND course_type='online_course'").bind(ctx.params.id).first();}
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const course=await companyCourse(ctx);if(!course)return json({error:'ไม่พบคอร์สบริษัท หรือคอร์สนี้ต้องจัดการผ่าน Vision 5'},403);const {results}=await ctx.env.DB.prepare(`SELECT id,title,description,sort_order,duration_seconds,CASE WHEN video_key IS NULL THEN 0 ELSE 1 END has_video,CASE WHEN pdf_key IS NULL THEN 0 ELSE 1 END has_pdf FROM course_lessons WHERE course_id=? ORDER BY sort_order,id`).bind(course.id).all();return json({items:results});}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const exists=await ctx.env.DB.prepare('SELECT id FROM courses WHERE id=?').bind(ctx.params.id).first();if(!exists)return json({error:'ไม่พบคอร์ส'},404);const course=await companyCourse(ctx);if(!course)return json({error:'คอร์ส Vision 5 ต้องจัดการบทเรียนผ่านหน้าของเจ้าของคอร์สเท่านั้น'},403);
  const form=await ctx.request.formData(),title=String(form.get('title')||'').trim();if(!title)return json({error:'กรุณาใส่ชื่อบทเรียน'},400);
  const video=form.get('video'),pdf=form.get('pdf');if(!video?.size&&!pdf?.size)return json({error:'แนบคลิปหรือ PDF อย่างน้อยหนึ่งไฟล์'},400);
  let videoKey=null,pdfKey=null;
  if(video?.size){if(!['video/mp4','video/webm'].includes(video.type)||video.size>200*1024*1024)return json({error:'คลิปต้องเป็น MP4 หรือ WEBM ไม่เกิน 200 MB'},400);videoKey=`course-${course.id}-video-${crypto.randomUUID()}.${extension(video.name,video.type)}`;await ctx.env.FILES.put(videoKey,await video.arrayBuffer(),{httpMetadata:{contentType:video.type}});}
  if(pdf?.size){if(pdf.type!=='application/pdf'||pdf.size>100*1024*1024){if(videoKey)await ctx.env.FILES.delete(videoKey);return json({error:'สไลด์ต้องเป็น PDF ไม่เกิน 100 MB'},400);}pdfKey=`course-${course.id}-slide-${crypto.randomUUID()}.pdf`;await ctx.env.FILES.put(pdfKey,await pdf.arrayBuffer(),{httpMetadata:{contentType:'application/pdf'}});}
  const max=await ctx.env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM course_lessons WHERE course_id=?').bind(course.id).first();
  const result=await ctx.env.DB.prepare(`INSERT INTO course_lessons(course_id,title,description,sort_order,video_key,pdf_key,video_mime,pdf_mime,duration_seconds) VALUES(?,?,?,?,?,?,?,?,?)`).bind(course.id,title,String(form.get('description')||''),Number(max.n)+10,videoKey,pdfKey,video?.type||null,pdfKey?'application/pdf':null,Math.max(0,Number(form.get('duration_seconds'))||0)).run();
  await ctx.env.DB.prepare('UPDATE courses SET total_minutes=(SELECT CAST(COALESCE(SUM(duration_seconds),0)/60 AS INTEGER) FROM course_lessons WHERE course_id=?),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(course.id,course.id).run();return json({ok:true,id:result.meta.last_row_id},201);
}
