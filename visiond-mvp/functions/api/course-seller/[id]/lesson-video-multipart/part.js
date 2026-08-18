import {json,requireUser} from '../../../../_lib.js';
import {COURSE_VIDEO_CHUNK_BYTES} from '../../../../_course_rules.js';

export async function onRequestPut(ctx){
  const auth=await requireUser(ctx);if(auth.error)return auth.error;const url=new URL(ctx.request.url),key=url.searchParams.get('key')||'',uploadId=url.searchParams.get('upload_id')||'',partNumber=Number(url.searchParams.get('part_number')),match=key.match(/^seller-course-(\d+)-lesson-(\d+)-video-[0-9a-f-]+\.(mp4|webm)$/i);
  if(!match||Number(match[1])!==Number(ctx.params.id)||!uploadId||!Number.isInteger(partNumber)||partNumber<1||partNumber>10000||!ctx.request.body)return json({error:'ข้อมูลชิ้นส่วนไม่ถูกต้อง'},400);
  const contentLength=Number(ctx.request.headers.get('content-length')||0);if(contentLength>COURSE_VIDEO_CHUNK_BYTES)return json({error:'ชิ้นส่วนวิดีโอใหญ่เกิน 25 MB'},413);
  const lesson=await ctx.env.DB.prepare("SELECT l.id FROM course_lessons l JOIN courses c ON c.id=l.course_id WHERE l.id=? AND l.course_id=? AND c.owner_user_id=? AND c.course_origin='seller_rights'").bind(Number(match[2]),ctx.params.id,auth.user.id).first();if(!lesson)return json({error:'ไม่พบ EP ของคุณ'},404);
  const part=await ctx.env.FILES.resumeMultipartUpload(key,uploadId).uploadPart(partNumber,ctx.request.body);return json({part_number:part.partNumber,etag:part.etag});
}
