import {json,requireUser} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {MAX_COURSE_VIDEO_BYTES,COURSE_VIDEO_CHUNK_BYTES} from '../../../../_course_rules.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),lessonId=Number(body.lesson_id),size=Number(body.file_size),name=String(body.file_name||''),type=String(body.file_type||''),quality=Number(body.quality);
  if(!Number.isInteger(lessonId)||!['video/mp4','video/webm'].includes(type)||!Number.isFinite(size)||size<1||size>MAX_COURSE_VIDEO_BYTES||![480,720].includes(quality))return json({error:'คลิปต้องเป็น MP4/WEBM ขนาดไม่เกิน 2 GB และเลือกคุณภาพ 720p หรือ 480p'},400);
  const lesson=await ctx.env.DB.prepare("SELECT l.id,l.course_id FROM course_lessons l JOIN courses c ON c.id=l.course_id JOIN products p ON p.id=c.product_id WHERE l.id=? AND l.course_id=? AND c.owner_user_id=? AND c.course_origin='seller_rights' AND p.deleted_at IS NULL").bind(lessonId,ctx.params.id,auth.user.id).first();if(!lesson)return json({error:'ไม่พบ EP ของคุณ'},404);
  const ext=type==='video/webm'?'webm':'mp4',key=`seller-course-${lesson.course_id}-lesson-${lesson.id}-video-${crypto.randomUUID()}.${ext}`;
  const upload=await ctx.env.FILES.createMultipartUpload(key,{httpMetadata:{contentType:type},customMetadata:{courseId:String(lesson.course_id),lessonId:String(lesson.id),userId:String(auth.user.id),fileSize:String(size),quality:String(quality),fileName:name.slice(0,200)}});
  return json({key,upload_id:upload.uploadId,chunk_size:COURSE_VIDEO_CHUNK_BYTES,max_size:MAX_COURSE_VIDEO_BYTES});
}
