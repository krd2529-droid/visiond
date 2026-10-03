import {json,requireAdmin} from '../../../_lib.js';

const privateHeaders={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
async function serve(ctx,head){
  const auth=await requireAdmin(ctx);if(auth.error){const headers=new Headers(auth.error.headers);for(const [key,value] of Object.entries(privateHeaders))headers.set(key,value);return new Response(auth.error.body,{status:auth.error.status,headers})}
  const projectId=Number(ctx.params.id);if(!Number.isSafeInteger(projectId)||projectId<1)return json({error:'รหัสโปรเจกต์ไม่ถูกต้อง'},400,privateHeaders);
  const row=await ctx.env.DB.prepare("SELECT v.object_key,v.file_size,v.mime_type FROM vsport_silent_videos v JOIN vsport_projects p ON p.id=v.project_id AND p.owner_id=v.owner_id WHERE v.project_id=? AND v.owner_id=? LIMIT 1").bind(projectId,auth.user.id).first();
  if(!row)return json({error:'ไม่พบวิดีโอส่วนตัว'},404,privateHeaders);
  const size=Number(row.file_size),range=ctx.request.headers.get('range'),download=new URL(ctx.request.url).searchParams.get('download')==='1';let start=0,end=size-1;
  if(range){const match=/^bytes=(\d*)-(\d*)$/u.exec(range);if(!match||!match[1]&&!match[2])return new Response(null,{status:416,headers:{...privateHeaders,'content-range':`bytes */${size}`}});if(match[1]){start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1}else{const suffix=Number(match[2]);start=Math.max(0,size-suffix)}if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start)return new Response(null,{status:416,headers:{...privateHeaders,'content-range':`bytes */${size}`}})}
  const object=head?await ctx.env.FILES?.head(row.object_key):await ctx.env.FILES?.get(row.object_key,range?{range:{offset:start,length:end-start+1}}:undefined);
  if(!object)return json({error:'ไฟล์วิดีโอสูญหาย'},404,privateHeaders);
  const headers=new Headers(privateHeaders);headers.set('content-type','video/webm');headers.set('content-length',String(range?end-start+1:size));headers.set('accept-ranges','bytes');headers.set('content-disposition',`${download?'attachment':'inline'}; filename="vsport-silent-${projectId}.webm"`);if(range)headers.set('content-range',`bytes ${start}-${end}/${size}`);return new Response(head?null:object.body,{status:range?206:200,headers});
}
export const onRequestGet=ctx=>serve(ctx,false);
export const onRequestHead=ctx=>serve(ctx,true);
