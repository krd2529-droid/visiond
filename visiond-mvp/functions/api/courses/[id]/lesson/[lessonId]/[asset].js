import { json } from '../../../../../_lib.js';
import { ensureDatabase } from '../../../../../_schema.js';
import { requireCourseAccess } from '../../../../../_courses.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const access=await requireCourseAccess(ctx,ctx.params.id);if(access.error)return access.error;
  const lesson=await ctx.env.DB.prepare('SELECT * FROM course_lessons WHERE id=? AND course_id=?').bind(ctx.params.lessonId,access.course.id).first();
  if(!lesson)return json({error:'ไม่พบบทเรียน'},404);
  const isVideo=ctx.params.asset==='video',key=isVideo?lesson.video_key:['pdf','document'].includes(ctx.params.asset)?lesson.pdf_key:null;
  if(!key)return json({error:'ไม่พบไฟล์บทเรียน'},404);
  const head=await ctx.env.FILES.head(key);if(!head)return json({error:'ไฟล์บทเรียนสูญหาย'},404);
  const range=ctx.request.headers.get('range');let object,status=200;
  if(isVideo&&range){
    const unsatisfied=()=>new Response(null,{status:416,headers:{'content-range':`bytes */${head.size}`,'accept-ranges':'bytes'}});
    const match=/^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if(!match||(!match[1]&&!match[2])||head.size<1)return unsatisfied();
    let start,end;
    if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return unsatisfied();start=Math.max(0,head.size-suffix);end=head.size-1}
    else{start=Number(match[1]);const requestedEnd=match[2]?Number(match[2]):head.size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(requestedEnd)||start>=head.size||requestedEnd<start)return unsatisfied();end=Math.min(requestedEnd,head.size-1)}
    object=await ctx.env.FILES.get(key,{range:{offset:start,length:end-start+1}});status=206;const headers=new Headers();head.writeHttpMetadata(headers);headers.set('content-range',`bytes ${start}-${end}/${head.size}`);headers.set('content-length',String(end-start+1));headers.set('accept-ranges','bytes');headers.set('cache-control','private, no-store');headers.set('content-disposition','inline');headers.set('x-content-type-options','nosniff');return new Response(object.body,{status,headers});}
  object=await ctx.env.FILES.get(key);const headers=new Headers();object.writeHttpMetadata(headers);headers.set('content-length',String(head.size));headers.set('accept-ranges','bytes');headers.set('cache-control','private, no-store');headers.set('content-disposition',isVideo?'inline':`${lesson.pdf_mime==='application/pdf'?'inline':'attachment'}; filename="${String(lesson.document_name||'lesson.pdf').replace(/["\r\n]/g,'')}"`);headers.set('x-content-type-options','nosniff');return new Response(object.body,{status,headers});
}
