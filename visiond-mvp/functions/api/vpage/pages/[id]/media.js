import {json,requireUser,sha256} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {hashVpageBytes,inspectVpageImage,newVpageMediaId,privateMediaHeaders,VpageMediaError,VPAGE_IMAGE_MAX_BYTES,VPAGE_MEDIA_PER_PAGE_LIMIT,vpageMediaUrl} from '../../../../_vpage-media.js';
import {validVpageIdempotencyKey} from '../../../../_vpage-provisioning.js';

export const VPAGE_IMAGE_MAX_REQUEST_BYTES=VPAGE_IMAGE_MAX_BYTES+65_536;
const LEASE_MS=2*60*1000;
const item=(request,row)=>({id:row.id,url:vpageMediaUrl(request,row.id),mime_type:row.mime_type,file_size:Number(row.file_size),width:Number(row.width),height:Number(row.height)});
const failure=error=>{const known=error instanceof VpageMediaError;return json({error:known?error.message:'อัปโหลดรูปไม่สำเร็จ',code:known?error.code:'VPAGE_MEDIA_UPLOAD_FAILED'},known?error.status:500,privateMediaHeaders)};
const inProgress=()=>new VpageMediaError('รูปนี้กำลังอัปโหลดจากคำขอเดิม กรุณาลองอีกครั้ง',{status:409,code:'VPAGE_MEDIA_UPLOAD_IN_PROGRESS'});

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const pageId=String(ctx.params?.id||''),key=String(ctx.request.headers.get('idempotency-key')||'').trim();
  if(!/^vpl_[a-f0-9]{32}$/.test(pageId)||!validVpageIdempotencyKey(key))return json({error:'คำขออัปโหลดไม่ถูกต้อง'},400,privateMediaHeaders);
  const page=await ctx.env.DB.prepare("SELECT id FROM vpage_pages WHERE id=? AND user_id=? AND domain_id='dom_smartlinkpage' AND status='active' AND datetime(expires_at)>CURRENT_TIMESTAMP").bind(pageId,auth.user.id).first();
  if(!page)return json({error:'ไม่พบเซลเพจ'},404,privateMediaHeaders);
  if(!ctx.env.FILES)return json({error:'คลังรูปยังไม่พร้อม',code:'VPAGE_MEDIA_STORAGE_NOT_CONFIGURED'},503,privateMediaHeaders);
  const rawLength=String(ctx.request.headers.get('content-length')||'');
  if(!/^[1-9][0-9]*$/.test(rawLength)||!Number.isSafeInteger(Number(rawLength)))return json({error:'ต้องระบุขนาดคำขออัปโหลดที่ถูกต้อง',code:'VPAGE_MEDIA_LENGTH_REQUIRED'},411,privateMediaHeaders);
  if(Number(rawLength)>VPAGE_IMAGE_MAX_REQUEST_BYTES)return json({error:'คำขออัปโหลดใหญ่เกินกำหนด',code:'VPAGE_MEDIA_REQUEST_TOO_LARGE'},413,privateMediaHeaders);
  if(!/^multipart\/form-data(?:;|$)/i.test(String(ctx.request.headers.get('content-type')||'')))return json({error:'ต้องส่งรูปแบบ multipart/form-data'},400,privateMediaHeaders);
  let form,file;try{form=await ctx.request.formData();if([...form.keys()].some(name=>name!=='image')||form.getAll('image').length!==1)return json({error:'คำขออัปโหลดมีฟิลด์ไม่ถูกต้อง'},400,privateMediaHeaders);file=form.get('image')}catch{return json({error:'อ่านไฟล์รูปไม่สำเร็จ'},400,privateMediaHeaders)}
  if(!(file instanceof File)||file.size<1)return json({error:'กรุณาเลือกรูป'},400,privateMediaHeaders);
  if(file.size>VPAGE_IMAGE_MAX_BYTES)return json({error:'รูปต้องมีขนาดไม่เกิน 5 MB',code:'VPAGE_IMAGE_TOO_LARGE'},413,privateMediaHeaders);
  let row=null,leaseToken='',ownsLease=false,replaying=false;
  const releaseLease=async()=>{if(ownsLease&&row)await ctx.env.DB.prepare("UPDATE vpage_media SET lease_expires_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending' AND lease_token=?").bind(row.id,leaseToken).run().catch(()=>undefined)};
  try{
    const sourceBytes=new Uint8Array(await file.arrayBuffer()),declaredType=String(file.type||'').toLowerCase(),sourceHash=await hashVpageBytes(sourceBytes),requestHash=await sha256(`${pageId}\n${declaredType}\n${sourceHash}`);
    row=await ctx.env.DB.prepare('SELECT * FROM vpage_media WHERE owner_id=? AND idempotency_key=?').bind(auth.user.id,key).first();replaying=Boolean(row);
    if(row&&(row.request_hash!==requestHash||row.page_id!==pageId))throw new VpageMediaError('Idempotency key ใช้กับรูปหรือเซลเพจอื่นแล้ว',{status:409,code:'VPAGE_MEDIA_IDEMPOTENCY_CONFLICT'});
    const matches=stored=>stored&&Number(stored.size)===Number(row.file_size)&&stored.customMetadata?.sha256===row.content_hash&&stored.httpMetadata?.contentType===row.mime_type;
    if(row?.state==='deleted'||row?.state==='deleting')throw new VpageMediaError('คำขออัปโหลดนี้ปิดแล้ว',{status:409,code:'VPAGE_MEDIA_REQUEST_CLOSED'});
    if(row){
      let stored;try{stored=await ctx.env.FILES.head(row.object_key)}catch{throw new VpageMediaError('ตรวจสอบรูปในคลังไม่สำเร็จ',{status:502,code:'VPAGE_MEDIA_STORAGE_UNCERTAIN',ambiguous:true})}
      if(matches(stored)){
        if(row.state==='pending')await ctx.env.DB.prepare("UPDATE vpage_media SET state='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending'").bind(row.id).run();
        return json({item:item(ctx.request,{...row,state:'ready'}),replayed:true},200,privateMediaHeaders);
      }
      leaseToken=crypto.randomUUID();const leaseExpiresAt=new Date(Date.now()+LEASE_MS).toISOString();
      const claim=row.state==='ready'
        ?await ctx.env.DB.prepare("UPDATE vpage_media SET state='pending',lease_token=?,lease_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='ready'").bind(leaseToken,leaseExpiresAt,row.id).run()
        :await ctx.env.DB.prepare("UPDATE vpage_media SET lease_token=?,lease_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending' AND datetime(lease_expires_at)<=CURRENT_TIMESTAMP").bind(leaseToken,leaseExpiresAt,row.id).run();
      if(!Number(claim.meta?.changes))throw inProgress();ownsLease=true;
    }
    const info=await inspectVpageImage(ctx.env,sourceBytes,declaredType,{signal:ctx.request.signal}),bytes=info.bytes,contentHash=info.content_hash||await hashVpageBytes(bytes);
    if(!row){
      const current=(await ctx.env.DB.prepare("SELECT id FROM vpage_media WHERE owner_id=? AND page_id=? AND state IN ('pending','ready') ORDER BY id DESC LIMIT ?").bind(auth.user.id,pageId,VPAGE_MEDIA_PER_PAGE_LIMIT+1).all()).results||[];
      if(current.length>=VPAGE_MEDIA_PER_PAGE_LIMIT)throw new VpageMediaError('คลังรูปของเซลเพจนี้เต็ม กรุณาลบรูปที่ไม่ได้ใช้ก่อน',{status:409,code:'VPAGE_MEDIA_LIMIT_REACHED'});
      const id=newVpageMediaId(),objectKey=`vpage-media/${id.slice(4)}.${info.extension}`;leaseToken=crypto.randomUUID();const leaseExpiresAt=new Date(Date.now()+LEASE_MS).toISOString();
      try{
        await ctx.env.DB.prepare("INSERT INTO vpage_media(id,owner_id,page_id,object_key,mime_type,file_size,width,height,content_hash,idempotency_key,request_hash,state,lease_token,lease_expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending',?,?)").bind(id,auth.user.id,pageId,objectKey,info.mime_type,info.file_size,info.width,info.height,contentHash,key,requestHash,leaseToken,leaseExpiresAt).run();
        row={id,owner_id:auth.user.id,page_id:pageId,object_key:objectKey,mime_type:info.mime_type,file_size:info.file_size,width:info.width,height:info.height,content_hash:contentHash,state:'pending'};ownsLease=true;
      }catch{
        row=await ctx.env.DB.prepare('SELECT * FROM vpage_media WHERE owner_id=? AND idempotency_key=?').bind(auth.user.id,key).first();replaying=Boolean(row);
        if(!row||row.request_hash!==requestHash||row.page_id!==pageId)throw new VpageMediaError('คำขออัปโหลดชนกับคำขออื่น',{status:409,code:'VPAGE_MEDIA_IDEMPOTENCY_CONFLICT'});
        let stored;try{stored=await ctx.env.FILES.head(row.object_key)}catch{throw new VpageMediaError('ตรวจสอบรูปในคลังไม่สำเร็จ',{status:502,code:'VPAGE_MEDIA_STORAGE_UNCERTAIN',ambiguous:true})}
        if(matches(stored)){await ctx.env.DB.prepare("UPDATE vpage_media SET state='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending'").bind(row.id).run();return json({item:item(ctx.request,{...row,state:'ready'}),replayed:true},200,privateMediaHeaders)}
        throw inProgress();
      }
    }else{
      const changed=await ctx.env.DB.prepare("UPDATE vpage_media SET mime_type=?,file_size=?,width=?,height=?,content_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending' AND lease_token=?").bind(info.mime_type,info.file_size,info.width,info.height,contentHash,row.id,leaseToken).run();
      if(!Number(changed.meta?.changes))throw inProgress();row={...row,mime_type:info.mime_type,file_size:info.file_size,width:info.width,height:info.height,content_hash:contentHash};
    }
    let stored;
    try{stored=await ctx.env.FILES.head(row.object_key);if(!matches(stored)){await ctx.env.FILES.put(row.object_key,bytes,{httpMetadata:{contentType:row.mime_type},customMetadata:{sha256:row.content_hash}});stored=await ctx.env.FILES.head(row.object_key)}}catch{await releaseLease();throw new VpageMediaError('บันทึกรูปในคลังไม่สำเร็จ',{status:502,code:'VPAGE_MEDIA_STORAGE_UNCERTAIN',ambiguous:true})}
    if(!matches(stored)){await releaseLease();throw new VpageMediaError('ยืนยันไฟล์ในคลังไม่สำเร็จ',{status:502,code:'VPAGE_MEDIA_STORAGE_UNCERTAIN',ambiguous:true})}
    const completed=await ctx.env.DB.prepare("UPDATE vpage_media SET state='ready',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending' AND lease_token=?").bind(row.id,leaseToken).run();
    if(!Number(completed.meta?.changes))throw new VpageMediaError('ยืนยันสถานะอัปโหลดไม่สำเร็จ',{status:502,code:'VPAGE_MEDIA_FINALIZE_UNCERTAIN',ambiguous:true});
    row={...row,state:'ready'};ownsLease=false;return json({item:item(ctx.request,row),replayed:replaying},replaying?200:201,privateMediaHeaders);
  }catch(error){await releaseLease();return failure(error)}
}
