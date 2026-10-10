import {json,requireUser} from '../../../_lib.js';
import {ensureVpageCreateSchema} from '../../../_vpage-create-schema.js';
import {ensureDatabase} from '../../../_schema.js';
import {hashVpageBytes,inspectVpageImage,newVpageMediaId,VpageMediaError,VPAGE_IMAGE_MAX_BYTES,privateMediaHeaders,vpageMediaUrl} from '../../../_vpage-media.js';
import {uploadRemoteVpageMedia,validVpageIdempotencyKey,VpageRemoteError} from '../../../_vpage-provisioning.js';

const fail=error=>json({error:error instanceof VpageMediaError||error instanceof VpageRemoteError?error.message:'อัปโหลดรูปไม่สำเร็จ',code:error?.code||'VPAGE_MEDIA_UPLOAD_FAILED'},Number(error?.status)||500,privateMediaHeaders);
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;await ensureVpageCreateSchema(ctx.env);
  const cursor=new URL(ctx.request.url).searchParams.get('cursor');if(cursor!==null&&!/^vpm_[a-f0-9]{32}$/.test(cursor))return json({error:'เคอร์เซอร์ไม่ถูกต้อง'},400,privateMediaHeaders);
  const rows=(await (cursor?ctx.env.DB.prepare("SELECT id,file_size,width,height,state FROM vpage_owner_assets WHERE owner_id=? AND state IN ('pending','ready') AND id<? ORDER BY id DESC LIMIT 25").bind(auth.user.id,cursor):ctx.env.DB.prepare("SELECT id,file_size,width,height,state FROM vpage_owner_assets WHERE owner_id=? AND state IN ('pending','ready') ORDER BY id DESC LIMIT 25").bind(auth.user.id)).all()).results||[];
  const hasMore=rows.length>24;if(hasMore)rows.pop();return json({items:rows.map(row=>({id:row.id,url:row.state==='ready'?`https://smartlinkpage.com/media/${row.id}`:'',preview_url:row.state==='ready'?vpageMediaUrl(ctx.request,row.id):'',file_size:Number(row.file_size),width:Number(row.width),height:Number(row.height),state:row.state})),pagination:{next_cursor:hasMore?rows.at(-1)?.id:null,has_more:hasMore}},200,privateMediaHeaders);
}
async function boundedMultipart(request,limit,expected){const reader=request.body?.getReader?.();if(!reader)throw new VpageMediaError('ไม่พบข้อมูลไฟล์');const chunks=[];let size=0;try{while(true){const{done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel().catch(()=>{});throw new VpageMediaError('ไฟล์ใหญ่เกินกำหนด',{status:413,code:'VPAGE_MEDIA_REQUEST_TOO_LARGE'})}chunks.push(value)}}catch(error){await reader.cancel().catch(()=>{});throw error}if(size!==expected)throw new VpageMediaError('ขนาดคำขอไม่ตรงกับไฟล์',{status:400,code:'VPAGE_MEDIA_LENGTH_MISMATCH'});const output=new Uint8Array(size);let offset=0;for(const chunk of chunks){output.set(chunk,offset);offset+=chunk.byteLength}return new Response(output,{headers:{'content-type':request.headers.get('content-type')}}).formData()}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;await ensureVpageCreateSchema(ctx.env);
  const key=String(ctx.request.headers.get('idempotency-key')||'').trim(),length=Number(ctx.request.headers.get('content-length'));
  if(!validVpageIdempotencyKey(key))return json({error:'คำขออัปโหลดไม่ถูกต้อง'},400,privateMediaHeaders);
  if(!Number.isSafeInteger(length)||length<1||length>VPAGE_IMAGE_MAX_BYTES+65_536)return json({error:'ไฟล์ใหญ่เกินกำหนด'},413,privateMediaHeaders);
  if(!/^multipart\/form-data(?:;|$)/i.test(String(ctx.request.headers.get('content-type')||'')))return json({error:'ต้องส่งไฟล์รูป'},400,privateMediaHeaders);
  if(!ctx.env.FILES)return json({error:'คลังรูปยังไม่พร้อม'},503,privateMediaHeaders);
  try{
    const form=await boundedMultipart(ctx.request,VPAGE_IMAGE_MAX_BYTES+65_536,length);if([...form.keys()].some(name=>name!=='image')||form.getAll('image').length!==1)throw new VpageMediaError('คำขอมีฟิลด์ไม่ถูกต้อง');
    const file=form.get('image');if(!(file instanceof File)||file.size<1||file.size>VPAGE_IMAGE_MAX_BYTES)throw new VpageMediaError('รูปต้องมีขนาดไม่เกิน 5 MiB',{status:413});
    const source=new Uint8Array(await file.arrayBuffer()),sourceHash=await hashVpageBytes(source);
    let row=await ctx.env.DB.prepare('SELECT id,object_key,source_hash,content_hash,file_size,width,height,state FROM vpage_owner_assets WHERE owner_id=? AND idempotency_key=?').bind(auth.user.id,key).first();
    if(row&&row.source_hash!==sourceHash)throw new VpageMediaError('คำขอเดิมใช้กับรูปอื่นแล้ว',{status:409,code:'VPAGE_MEDIA_IDEMPOTENCY_CONFLICT'});
    if(row&&['deleting','deleted'].includes(row.state))throw new VpageMediaError('รูปนี้ถูกลบแล้ว',{status:409,code:'VPAGE_MEDIA_CLOSED'});
    let info=null;if(row){const stored=await ctx.env.FILES.get(row.object_key);if(stored&&Number(stored.size)===Number(row.file_size)&&stored.customMetadata?.sha256===row.content_hash&&stored.httpMetadata?.contentType==='image/webp'){const bytes=new Uint8Array(await stored.arrayBuffer());if(await hashVpageBytes(bytes)===row.content_hash)info={bytes,content_hash:row.content_hash,file_size:Number(row.file_size),width:Number(row.width),height:Number(row.height)}}}
    if(!info){info=await inspectVpageImage(ctx.env,source,String(file.type||'').toLowerCase(),{signal:ctx.request.signal});if(row&&info.content_hash!==row.content_hash)throw new VpageMediaError('ไฟล์เดิมต้องตรวจสอบก่อนอัปโหลดซ้ำ',{status:409,code:'VPAGE_MEDIA_REPLAY_MISMATCH'})}
    if(!row){
      const count=(await ctx.env.DB.prepare("SELECT id FROM vpage_owner_assets WHERE owner_id=? AND state IN ('pending','ready') ORDER BY id DESC LIMIT 49").bind(auth.user.id).all()).results||[];
      if(count.length>=48)throw new VpageMediaError('คลังรูปเต็ม กรุณาลบรูปที่ไม่ได้ใช้ก่อน',{status:409,code:'VPAGE_MEDIA_LIMIT_REACHED'});
      const id=newVpageMediaId(),objectKey=`vpage-owner/${id.slice(4)}.webp`;
      try{await ctx.env.DB.prepare("INSERT INTO vpage_owner_assets(id,owner_id,object_key,source_hash,content_hash,mime_type,file_size,width,height,idempotency_key,state) VALUES(?,?,?,?,?,'image/webp',?,?,?,?,'pending')").bind(id,auth.user.id,objectKey,sourceHash,info.content_hash,info.file_size,info.width,info.height,key).run();row={id,object_key:objectKey,source_hash:sourceHash,content_hash:info.content_hash,file_size:info.file_size,width:info.width,height:info.height,state:'pending'}}catch{throw new VpageMediaError('รูปกำลังอัปโหลดจากคำขอเดิม',{status:409,code:'VPAGE_MEDIA_IN_PROGRESS'})}
    }
    const matches=obj=>obj&&Number(obj.size)===info.file_size&&obj.customMetadata?.sha256===info.content_hash&&obj.httpMetadata?.contentType==='image/webp';
    let local=await ctx.env.FILES.head(row.object_key);if(!matches(local)){await ctx.env.FILES.put(row.object_key,info.bytes,{httpMetadata:{contentType:'image/webp'},customMetadata:{sha256:info.content_hash}});local=await ctx.env.FILES.head(row.object_key)}
    if(!matches(local))throw new VpageMediaError('ยืนยันไฟล์ใน VisionD ไม่สำเร็จ',{status:502,code:'VPAGE_MEDIA_LOCAL_UNCERTAIN'});
    await uploadRemoteVpageMedia(ctx.env,{userId:auth.user.id,id:row.id,bytes:info.bytes,width:info.width,height:info.height});
    await ctx.env.DB.prepare("UPDATE vpage_owner_assets SET state='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND state='pending'").bind(row.id,auth.user.id).run();
    return json({item:{id:row.id,url:`https://smartlinkpage.com/media/${row.id}`,preview_url:vpageMediaUrl(ctx.request,row.id),width:info.width,height:info.height,file_size:info.file_size},replayed:row.state==='ready'},row.state==='ready'?200:201,privateMediaHeaders);
  }catch(error){return fail(error)}
}
