import { json, requireAdmin } from '../../../../_lib.js';
import { ensureDatabase } from '../../../../_schema.js';
import { MAX_COURSE_VIDEO_BYTES } from '../../../../_course_rules.js';

const extension=(name,type)=>String(name||'').split('.').pop()?.toLowerCase()||({"video/mp4":'mp4',"video/webm":'webm',"application/pdf":'pdf',"image/jpeg":'jpg',"image/png":'png'}[type]||'bin');
async function companyCourse(ctx){return ctx.env.DB.prepare("SELECT id FROM courses WHERE id=? AND owner_user_id IS NULL AND COALESCE(course_origin,'company')='company' AND course_type='online_course'").bind(ctx.params.id).first();}
async function syncCourseMinutes(env,courseId){await env.DB.prepare('UPDATE courses SET total_minutes=CAST((COALESCE((SELECT SUM(duration_seconds) FROM course_lessons WHERE course_id=?),0)+59)/60 AS INTEGER),updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(courseId,courseId).run();}
export async function onRequestGet(ctx){await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const course=await companyCourse(ctx);if(!course)return json({error:'ไม่พบคอร์สบริษัท หรือคอร์สนี้ต้องจัดการผ่าน Vision 5'},403);const {results}=await ctx.env.DB.prepare(`SELECT id,title,description,episode_label,sort_order,duration_seconds,pdf_mime,document_name,CASE WHEN video_key IS NULL THEN 0 ELSE 1 END has_video,CASE WHEN pdf_key IS NULL THEN 0 ELSE 1 END has_pdf FROM course_lessons WHERE course_id=? ORDER BY sort_order,id`).bind(course.id).all();return json({items:results});}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const exists=await ctx.env.DB.prepare('SELECT id FROM courses WHERE id=?').bind(ctx.params.id).first();if(!exists)return json({error:'ไม่พบคอร์ส'},404);const course=await companyCourse(ctx);if(!course)return json({error:'คอร์ส Vision 5 ต้องจัดการบทเรียนผ่านหน้าของเจ้าของคอร์สเท่านั้น'},403);
  const form=await ctx.request.formData(),title=String(form.get('title')||'').trim(),episodeLabel=String(form.get('episode_label')||'').trim(),rawDuration=Number(form.get('duration_minutes')),durationSeconds=Number.isFinite(rawDuration)&&rawDuration>=0&&rawDuration<=100000?Math.round(rawDuration*60):0;if(!title)return json({error:'กรุณาใส่ชื่อบทเรียน'},400);if((episodeLabel&&!/^\d+(?:\.\d+)*$/.test(episodeLabel))||episodeLabel.length>20)return json({error:'เลข EP ใช้ตัวเลขและจุดเท่านั้น เช่น 1, 1.1 หรือ 1.2'},400);if(!Number.isFinite(rawDuration)||rawDuration<0||rawDuration>100000)return json({error:'ความยาว EP ไม่ถูกต้อง'},400);
  const video=form.get('video'),pdf=form.get('pdf'),videoPending=String(form.get('video_upload_pending')||'')==='1',draftOnly=String(form.get('draft_only')||'')==='1';if(!video?.size&&!pdf?.size&&!videoPending&&!draftOnly)return json({error:'แนบคลิป เอกสาร PDF, JPEG หรือ PNG อย่างน้อยหนึ่งไฟล์'},400);
  let videoKey=null,pdfKey=null;
  if(video?.size){if(!['video/mp4','video/webm'].includes(video.type)||video.size>MAX_COURSE_VIDEO_BYTES)return json({error:'คลิปต้องเป็น MP4 หรือ WEBM ไม่เกิน 2 GB'},400);videoKey=`course-${course.id}-video-${crypto.randomUUID()}.${extension(video.name,video.type)}`;await ctx.env.FILES.put(videoKey,video.stream(),{httpMetadata:{contentType:video.type}});}
  if(pdf?.size){if(!['application/pdf','image/jpeg','image/png'].includes(pdf.type)||pdf.size>100*1024*1024){if(videoKey)await ctx.env.FILES.delete(videoKey);return json({error:'เอกสารต้องเป็น PDF, JPEG หรือ PNG ไม่เกิน 100 MB'},400);}pdfKey=`course-${course.id}-document-${crypto.randomUUID()}.${extension(pdf.name,pdf.type)}`;try{await ctx.env.FILES.put(pdfKey,pdf.stream(),{httpMetadata:{contentType:pdf.type}})}catch(error){if(videoKey)await ctx.env.FILES.delete(videoKey);throw error}}
  const max=await ctx.env.DB.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM course_lessons WHERE course_id=?').bind(course.id).first();
  try{
    const result=await ctx.env.DB.prepare(`INSERT INTO course_lessons(course_id,title,description,episode_label,sort_order,video_key,pdf_key,video_mime,pdf_mime,document_name,duration_seconds) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(course.id,title,String(form.get('description')||''),episodeLabel||null,Number(max.n)+10,videoKey,pdfKey,video?.type||null,pdfKey?pdf.type:null,pdfKey?String(pdf.name||'document').slice(0,240):'',durationSeconds).run();
    await syncCourseMinutes(ctx.env,course.id);
    return json({ok:true,id:result.meta?.last_row_id,status:videoKey||pdfKey?'ready':'draft'},201);
  }catch(error){
    if(videoKey)await ctx.env.FILES.delete(videoKey).catch(()=>{});
    if(pdfKey)await ctx.env.FILES.delete(pdfKey).catch(()=>{});
    return json({error:'บันทึกบทเรียนไม่สำเร็จ กรุณาลองใหม่'},500);
  }
}
