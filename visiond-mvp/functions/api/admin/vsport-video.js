import {json,requireAdmin} from '../../_lib.js';
import {isSilentVideoWebm} from '../../_vsport-video.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const PART=8*1024*1024,MAX=1536*1024*1024,LEASE_MS=120000;
const number=(value,min,max)=>{const n=Number(value);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null};
const expiry=()=>new Date(Date.now()+LEASE_MS).toISOString();
const changed=result=>Number(result?.meta?.changes||0);
const rowSql='id,owner_id,project_id,idempotency_key,object_key,r2_upload_id,mime_type,file_size,duration_seconds,parts_json,state,updated_at';
const project=(env,id,owner)=>env.DB.prepare('SELECT id FROM vsport_projects WHERE id=? AND owner_id=?').bind(id,owner).first();
const upload=(env,id,owner)=>env.DB.prepare(`SELECT ${rowSql} FROM vsport_video_uploads WHERE id=? AND owner_id=?`).bind(id,owner).first();
const video=(env,id,owner)=>env.DB.prepare('SELECT project_id,owner_id,object_key,mime_type,file_size,duration_seconds,created_at FROM vsport_silent_videos WHERE owner_id=? AND project_id=? LIMIT 1').bind(owner,id).first();
const publicVideo=row=>row?{project_id:row.project_id,file_size:row.file_size,duration_seconds:row.duration_seconds,created_at:row.created_at,url:`/api/admin/vsport-video/${row.project_id}`}:null;
const partsOf=row=>{try{return JSON.parse(row.parts_json||'{}')}catch{return{}}};
const keyFor=(owner,id)=>`vsport/${owner}/${id}/silent-${crypto.randomUUID()}.webm`;
async function authContext(ctx){const auth=await requireAdmin(ctx);if(auth.error){const h=new Headers(auth.error.headers);for(const [k,v] of Object.entries(headers))h.set(k,v);return{error:new Response(auth.error.body,{status:auth.error.status,headers:h})}}return{owner:Number(auth.user.id)}}

export async function onRequestGet(ctx){
  const auth=await authContext(ctx);if(auth.error)return auth.error;
  const params=new URL(ctx.request.url).searchParams,id=number(params.get('project_id'),1,Number.MAX_SAFE_INTEGER),uploadId=params.get('upload_id');
  if(uploadId){const row=await upload(ctx.env,uploadId,auth.owner);if(!row)return json({error:'ไม่พบการอัปโหลด'},404,headers);return json({upload:{id:row.id,project_id:row.project_id,state:row.state,file_size:row.file_size,parts:partsOf(row)},video:row.state==='done'?publicVideo(await video(ctx.env,row.project_id,auth.owner)):null},200,headers)}
  if(!id)return json({error:'รหัสโปรเจกต์ไม่ถูกต้อง'},400,headers);
  if(!await project(ctx.env,id,auth.owner))return json({error:'ไม่พบโปรเจกต์'},404,headers);
  return json({video:publicVideo(await video(ctx.env,id,auth.owner))},200,headers);
}

export async function onRequestPost(ctx){
  const auth=await authContext(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>null),action=body?.action;
  if(action==='begin'){
    const id=number(body.project_id,1,Number.MAX_SAFE_INTEGER),size=number(body.file_size,512,MAX),duration=Number(body.duration_seconds),token=String(ctx.request.headers.get('Idempotency-Key')||'');
    if(!id||!size||!Number.isFinite(duration)||duration<=0||duration>2101||body.mime_type!=='video/webm'||!/^[\x21-\x7e]{8,128}$/.test(token))return json({error:'ข้อมูลวิดีโอไม่ถูกต้องหรือเกินขนาด 1.5 GiB / 35 นาที'},422,headers);
    if(!await project(ctx.env,id,auth.owner))return json({error:'ไม่พบโปรเจกต์'},404,headers);
    let row=await ctx.env.DB.prepare(`SELECT ${rowSql} FROM vsport_video_uploads WHERE owner_id=? AND idempotency_key=?`).bind(auth.owner,token).first();
    if(row&&(Number(row.project_id)!==id||Number(row.file_size)!==size||Number(row.duration_seconds)!==duration))return json({error:'Idempotency-Key ใช้กับวิดีโออื่นแล้ว'},409,headers);
    if(!row){
      const active=await ctx.env.DB.prepare(`SELECT ${rowSql} FROM vsport_video_uploads WHERE owner_id=? AND project_id=? AND state IN ('initiating','uploading','completing') LIMIT 1`).bind(auth.owner,id).first();
      if(active){
        if(Date.now()-Date.parse(`${String(active.updated_at).replace(' ','T')}Z`)<LEASE_MS)return json({error:'โปรเจกต์นี้มีการอัปโหลดวิดีโออยู่แล้ว'},409,headers);
        // A stale session is fenced in D1 before a replacement can be admitted.
        if(active.r2_upload_id){try{await ctx.env.FILES.resumeMultipartUpload(active.object_key,active.r2_upload_id).abort()}catch{if(!await ctx.env.FILES.head(active.object_key))return json({error:'ยังยกเลิกการอัปโหลดเดิมไม่ได้ กรุณาลองใหม่'},503,headers)}}
        await ctx.env.DB.batch([
          ctx.env.DB.prepare("UPDATE vsport_video_uploads SET state='aborted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND state IN ('initiating','uploading','completing')").bind(active.id,auth.owner),
          ctx.env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='pending',reason='deleted',next_attempt_at=CURRENT_TIMESTAMP WHERE object_key=? AND writer_fence=? AND status='reserved'").bind(active.object_key,active.id)
        ]);
      }
      const uploadId=crypto.randomUUID(),objectKey=keyFor(auth.owner,id),until=expiry();
      try{await ctx.env.DB.batch([
        ctx.env.DB.prepare("INSERT INTO vsport_video_uploads(id,owner_id,project_id,idempotency_key,object_key,mime_type,file_size,duration_seconds) SELECT ?,p.owner_id,p.id,? ,?,'video/webm',?,? FROM vsport_projects p WHERE p.id=? AND p.owner_id=?").bind(uploadId,token,objectKey,size,duration,id,auth.owner),
        ctx.env.DB.prepare("INSERT INTO vsport_object_cleanup_jobs(id,owner_id,project_id,object_key,reason,status,writer_fence,lease_expires_at,next_attempt_at) VALUES(?,?,?,?, 'orphan_guard','reserved',?,?,?)").bind(crypto.randomUUID(),auth.owner,id,objectKey,uploadId,until,until)
      ])}catch{return json({error:'เริ่มบันทึกวิดีโอไม่สำเร็จ'},500,headers)}
      row=await upload(ctx.env,uploadId,auth.owner);
    }
    if(row.state==='done'){const latest=await video(ctx.env,id,auth.owner),superseded=latest?.object_key!==row.object_key;return json({ok:!superseded,error:superseded?'วิดีโอนี้ถูกแทนที่ด้วยงานใหม่แล้ว':undefined,upload_id:row.id,state:'done',superseded,video:publicVideo(latest)},200,headers)}
    if(row.state==='aborted')return json({error:'การอัปโหลดนี้ถูกยกเลิกแล้ว'},409,headers);
    if(!row.r2_upload_id){
      let remote;try{remote=await ctx.env.FILES.createMultipartUpload(row.object_key,{httpMetadata:{contentType:'video/webm'}});const saved=await ctx.env.DB.prepare("UPDATE vsport_video_uploads SET r2_upload_id=?,state='uploading',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND r2_upload_id='' AND state='initiating'").bind(remote.uploadId,row.id,auth.owner).run();if(!changed(saved))throw new Error('UPLOAD_CLAIM_LOST');row=await upload(ctx.env,row.id,auth.owner)}catch{if(remote)try{await remote.abort()}catch{}return json({error:'เปิดการอัปโหลด R2 ไม่สำเร็จ กรุณาลองใหม่'},503,headers)}
    }
    return json({ok:true,upload_id:row.id,state:row.state,part_size:PART,parts:partsOf(row)},200,headers);
  }
  if(action==='complete'){
    const row=await upload(ctx.env,String(body.upload_id||''),auth.owner);if(!row)return json({error:'ไม่พบการอัปโหลด'},404,headers);
    if(row.state==='done'){const latest=await video(ctx.env,row.project_id,auth.owner),superseded=latest?.object_key!==row.object_key;return json({ok:!superseded,error:superseded?'วิดีโอนี้ถูกแทนที่ด้วยงานใหม่แล้ว':undefined,video:publicVideo(latest),replayed:true,superseded},200,headers)}
    if(!['uploading','completing'].includes(row.state)||!row.r2_upload_id)return json({error:'สถานะการอัปโหลดไม่พร้อม'},409,headers);
    if(!await project(ctx.env,row.project_id,auth.owner))return json({error:'ไม่พบโปรเจกต์'},404,headers);
    const count=Math.ceil(row.file_size/PART),receipts=partsOf(row),parts=[];
    for(let n=1;n<=count;n++){const item=receipts[n];if(!item||item.size!==(n<count?PART:row.file_size-(n-1)*PART)||typeof item.etag!=='string'||n===1&&!item.silent)return json({error:`ชิ้นวิดีโอ ${n} ยังไม่ครบหรือไม่ใช่วิดีโอเงียบ`},409,headers);parts.push({partNumber:n,etag:item.etag})}
    await ctx.env.DB.prepare("UPDATE vsport_video_uploads SET state='completing',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND state='uploading'").bind(row.id,auth.owner).run();
    await ctx.env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET lease_expires_at=?,next_attempt_at=? WHERE object_key=? AND writer_fence=? AND status='reserved'").bind(expiry(),expiry(),row.object_key,row.id).run();
    let object=await ctx.env.FILES.head(row.object_key);
    if(!object){try{object=await ctx.env.FILES.resumeMultipartUpload(row.object_key,row.r2_upload_id).complete(parts)}catch{object=await ctx.env.FILES.head(row.object_key)}}
    if(!object||Number(object.size)!==Number(row.file_size))return json({error:'ยังยืนยันไฟล์วิดีโอที่ R2 ไม่ได้ กรุณาลองบันทึกซ้ำ'},503,headers);
    const old=await video(ctx.env,row.project_id,auth.owner),oldKey=old?.object_key!==row.object_key?old?.object_key:null;
    let results;try{results=await ctx.env.DB.batch([
      ...(oldKey?[ctx.env.DB.prepare("INSERT INTO vsport_object_cleanup_jobs(id,owner_id,project_id,object_key,reason,status,next_attempt_at) SELECT ?,?,?,?,'deleted','pending',? WHERE EXISTS(SELECT 1 FROM vsport_video_uploads u JOIN vsport_object_cleanup_jobs g ON g.object_key=u.object_key AND g.writer_fence=u.id AND g.status='reserved' WHERE u.id=? AND u.owner_id=? AND u.state='completing') ON CONFLICT(object_key) DO UPDATE SET reason='deleted',status='pending',next_attempt_at=excluded.next_attempt_at").bind(crypto.randomUUID(),auth.owner,row.project_id,oldKey,new Date().toISOString(),row.id,auth.owner)]:[]),
      ctx.env.DB.prepare("INSERT INTO vsport_silent_videos(project_id,owner_id,object_key,mime_type,file_size,duration_seconds) SELECT p.id,p.owner_id,?,'video/webm',?,? FROM vsport_projects p JOIN vsport_video_uploads u ON u.project_id=p.id AND u.owner_id=p.owner_id AND u.id=? AND u.state='completing' JOIN vsport_object_cleanup_jobs g ON g.object_key=u.object_key AND g.writer_fence=u.id AND g.status='reserved' WHERE p.id=? AND p.owner_id=? ON CONFLICT(project_id) DO UPDATE SET object_key=excluded.object_key,mime_type=excluded.mime_type,file_size=excluded.file_size,duration_seconds=excluded.duration_seconds,created_at=CURRENT_TIMESTAMP").bind(row.object_key,row.file_size,row.duration_seconds,row.id,row.project_id,auth.owner),
      ctx.env.DB.prepare("UPDATE vsport_video_uploads SET state='done',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND state='completing'").bind(row.id,auth.owner),
      ctx.env.DB.prepare("DELETE FROM vsport_object_cleanup_jobs WHERE object_key=? AND writer_fence=? AND status='reserved'").bind(row.object_key,row.id)
    ])}catch{return json({error:'ไฟล์ถึง R2 แล้ว แต่ยังยืนยันฐานข้อมูลไม่ได้ กรุณาลองบันทึกซ้ำ'},503,headers)}
    if(!changed(results[oldKey?1:0])||!changed(results[oldKey?2:1]))return json({error:'การอัปโหลดนี้ถูกแทนที่แล้ว'},409,headers);
    if(oldKey){try{await ctx.env.FILES.delete(oldKey);await ctx.env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='done',completed_at=CURRENT_TIMESTAMP,next_attempt_at=NULL WHERE object_key=? AND status='pending'").bind(oldKey).run()}catch{}}
    return json({ok:true,video:publicVideo(await video(ctx.env,row.project_id,auth.owner))},200,headers);
  }
  return json({error:'คำสั่งไม่ถูกต้อง'},400,headers);
}

export async function onRequestPut(ctx){
  const auth=await authContext(ctx);if(auth.error)return auth.error;
  const params=new URL(ctx.request.url).searchParams,row=await upload(ctx.env,String(params.get('upload_id')||''),auth.owner),part=number(params.get('part'),1,192);
  if(!row)return json({error:'ไม่พบการอัปโหลด'},404,headers);
  const count=Math.ceil(row.file_size/PART),expected=part&&part<=count?(part<count?PART:row.file_size-(part-1)*PART):0;
  if(row.state!=='uploading'||!row.r2_upload_id||!expected||Number(ctx.request.headers.get('content-length'))!==expected)return json({error:'ชิ้นวิดีโอหรือสถานะไม่ถูกต้อง'},422,headers);
  if(!await project(ctx.env,row.project_id,auth.owner))return json({error:'ไม่พบโปรเจกต์'},404,headers);
  const guard=await ctx.env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET lease_expires_at=?,next_attempt_at=? WHERE object_key=? AND writer_fence=? AND status='reserved'").bind(expiry(),expiry(),row.object_key,row.id).run();
  if(!changed(guard))return json({error:'สิทธิ์บันทึกไฟล์หมดอายุ'},409,headers);
  const bytes=await ctx.request.arrayBuffer();if(bytes.byteLength!==expected)return json({error:'ขนาดชิ้นวิดีโอไม่ตรง'},422,headers);
  if(part===1&&!isSilentVideoWebm(bytes))return json({error:'ไฟล์ต้องเป็น WebM ที่มีวิดีโอหนึ่งแทร็กและไม่มีเสียง'},415,headers);
  let uploaded;try{uploaded=await ctx.env.FILES.resumeMultipartUpload(row.object_key,row.r2_upload_id).uploadPart(part,bytes)}catch{return json({error:'บันทึกชิ้นวิดีโอไม่สำเร็จ กรุณาลองใหม่'},503,headers)}
  const current=await upload(ctx.env,row.id,auth.owner);if(!current||current.state!=='uploading')return json({error:'สถานะการอัปโหลดเปลี่ยนแล้ว'},409,headers);
  const parts=partsOf(current);parts[part]={etag:uploaded.etag,size:expected,...(part===1?{silent:true}:{})};
  const saved=await ctx.env.DB.prepare("UPDATE vsport_video_uploads SET parts_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND state='uploading'").bind(JSON.stringify(parts),row.id,auth.owner).run();
  return changed(saved)?json({ok:true,part,etag:uploaded.etag},200,headers):json({error:'บันทึกหลักฐานชิ้นวิดีโอไม่สำเร็จ กรุณาลองใหม่'},503,headers);
}

export async function onRequestDelete(ctx){
  const auth=await authContext(ctx);if(auth.error)return auth.error;
  const id=new URL(ctx.request.url).searchParams.get('upload_id'),row=await upload(ctx.env,String(id||''),auth.owner);
  if(!row)return json({error:'ไม่พบการอัปโหลด'},404,headers);
  if(row.state==='done'||row.state==='completing')return json({error:'วิดีโอนี้กำลังยืนยันหรือบันทึกแล้ว'},409,headers);
  if(row.r2_upload_id){try{await ctx.env.FILES.resumeMultipartUpload(row.object_key,row.r2_upload_id).abort()}catch{return json({error:'ยกเลิก R2 ไม่สำเร็จ กรุณาลองใหม่'},503,headers)}}
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE vsport_video_uploads SET state='aborted',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND state IN ('initiating','uploading')").bind(row.id,auth.owner),
    ctx.env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='done',next_attempt_at=NULL,completed_at=CURRENT_TIMESTAMP WHERE object_key=? AND writer_fence=? AND status='reserved'").bind(row.object_key,row.id)
  ]);
  return json({ok:true},200,headers);
}
