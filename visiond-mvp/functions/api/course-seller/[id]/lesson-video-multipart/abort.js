import {json,requireUser} from '../../../../_lib.js';

export async function onRequestPost(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;const body=await ctx.request.json().catch(()=>({})),key=String(body.key||''),uploadId=String(body.upload_id||''),match=key.match(/^seller-course-(\d+)-lesson-(\d+)-video-[0-9a-f-]+\.(mp4|webm)$/i);if(!match||Number(match[1])!==Number(ctx.params.id)||!uploadId)return json({error:'ข้อมูลไม่ถูกต้อง'},400);
  const lesson=await ctx.env.DB.prepare("SELECT l.id FROM course_lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=? AND l.course_id=? AND c.owner_user_id=? AND c.course_origin='seller_rights'").bind(Number(match[2]),ctx.params.id,auth.user.id).first();if(!lesson)return json({error:'ไม่พบ EP ของคุณ'},404);await ctx.env.FILES.resumeMultipartUpload(key,uploadId).abort();return json({ok:true});
}
