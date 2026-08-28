import {json,requireAdmin} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {MAX_COURSE_VIDEO_BYTES} from '../../../../../_course_rules.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>({})),key=String(body.key||''),uploadId=String(body.upload_id||''),size=Number(body.file_size),parts=Array.isArray(body.parts)?body.parts:[],match=key.match(/^company-course-(\d+)-lesson-(\d+)-video-[0-9a-f-]+\.(mp4|webm)$/i);
  if(!match||Number(match[1])!==Number(ctx.params.id)||!uploadId||!parts.length||size<1||size>MAX_COURSE_VIDEO_BYTES)return json({error:'ข้อมูลการอัปโหลดไม่ถูกต้อง'},400);
  const lesson=await ctx.env.DB.prepare("SELECT l.id,l.video_key FROM course_lessons l JOIN courses c ON c.id=l.course_id JOIN products p ON p.id=c.product_id WHERE l.id=? AND l.course_id=? AND c.owner_user_id IS NULL AND COALESCE(c.course_origin,'company')='company' AND c.course_type='online_course' AND p.deleted_at IS NULL").bind(Number(match[2]),ctx.params.id).first();if(!lesson)return json({error:'ไม่พบ EP ของตะกร้าคอร์สบริษัท'},404);
  await ctx.env.FILES.resumeMultipartUpload(key,uploadId).complete(parts.map(p=>({partNumber:Number(p.part_number),etag:String(p.etag)})));
  try{await ctx.env.DB.prepare('UPDATE course_lessons SET video_key=?,video_mime=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND course_id=?').bind(key,match[3].toLowerCase()==='webm'?'video/webm':'video/mp4',lesson.id,ctx.params.id).run()}catch(error){await ctx.env.FILES.delete(key).catch(()=>{});return json({error:'บันทึกวิดีโอ EP ไม่สำเร็จ'},500)}
  if(lesson.video_key&&lesson.video_key!==key)await ctx.env.FILES.delete(lesson.video_key).catch(()=>{});return json({ok:true,lesson_id:lesson.id,message:'อัปโหลดวิดีโอ EP สำเร็จ'});
}
