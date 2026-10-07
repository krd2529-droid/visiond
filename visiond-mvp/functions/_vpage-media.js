import {sha256} from './_lib.js';
import {readRemoteVpageEditorFresh} from './_vpage-provisioning.js';

export const VPAGE_IMAGE_MAX_BYTES=5*1024*1024;
export const VPAGE_IMAGE_MAX_DIMENSION=4096;
export const VPAGE_MEDIA_PER_PAGE_LIMIT=48;
const MEDIA_ID=/^vpm_[a-f0-9]{32}$/;
const PRIVATE={'cache-control':'private, no-store'};

export class VpageMediaError extends Error{
  constructor(message,{status=400,code='VPAGE_MEDIA_INVALID',ambiguous=false}={}){super(message);this.status=status;this.code=code;this.ambiguous=ambiguous}
}

const ascii=(bytes,start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
const u24=(bytes,start,little=false)=>little?bytes[start]|bytes[start+1]<<8|bytes[start+2]<<16:bytes[start]<<16|bytes[start+1]<<8|bytes[start+2];
const u32=(bytes,start,little=false)=>new DataView(bytes.buffer,bytes.byteOffset+start,4).getUint32(0,little);
const crcTable=()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}return table};
const PNG_CRC=crcTable();
const crc32=bytes=>{let c=0xffffffff;for(const byte of bytes)c=PNG_CRC[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0};

function inspectPng(bytes){
  if(bytes.length<57||ascii(bytes,0,8)!=='\x89PNG\r\n\x1a\n')return null;
  let offset=8,width=0,height=0,ihdr=false,idat=false,iend=false;
  while(offset+12<=bytes.length){const length=u32(bytes,offset),type=ascii(bytes,offset+4,4),end=offset+12+length;if(length>VPAGE_IMAGE_MAX_BYTES||end>bytes.length)return null;const chunk=bytes.slice(offset+4,offset+8+length);if(crc32(chunk)!==u32(bytes,offset+8+length))return null;
    if(!ihdr){if(type!=='IHDR'||length!==13)return null;width=u32(bytes,offset+8);height=u32(bytes,offset+12);if(bytes[offset+16]!==8||![0,2,3,4,6].includes(bytes[offset+17]))return null;ihdr=true}
    else if(type==='IDAT')idat=true;
    else if(type==='IEND'){if(length!==0||!idat||end!==bytes.length)return null;iend=true;break}
    else if(!['PLTE','pHYs'].includes(type))return null;
    offset=end;
  }
  return ihdr&&idat&&iend?{mime_type:'image/png',width,height,extension:'png'}:null;
}

function inspectJpeg(bytes){
  if(bytes.length<24||bytes[0]!==0xff||bytes[1]!==0xd8||bytes.at(-2)!==0xff||bytes.at(-1)!==0xd9)return null;
  let offset=2,width=0,height=0,sawScan=false;
  while(offset<bytes.length-2){if(bytes[offset++]!==0xff)return null;while(bytes[offset]===0xff)offset++;const marker=bytes[offset++];if(marker===0xd9)break;if(marker===0x00||marker===0xd8)return null;if(marker>=0xd0&&marker<=0xd7)continue;if(offset+2>bytes.length)return null;const length=bytes[offset]<<8|bytes[offset+1];if(length<2||offset+length>bytes.length)return null;
    if(marker===0xe0){const brand=ascii(bytes,offset+2,5);if(brand!=='JFIF\0'&&ascii(bytes,offset+2,4)!=='JFXX')return null}
    else if((marker>=0xe1&&marker<=0xef)||marker===0xfe)return null;
    if([0xc0,0xc1,0xc2].includes(marker)){if(length<8)return null;height=bytes[offset+3]<<8|bytes[offset+4];width=bytes[offset+5]<<8|bytes[offset+6]}
    if(marker===0xda){sawScan=true;offset+=length;while(offset<bytes.length-1){if(bytes[offset]!==0xff){offset++;continue}const next=bytes[offset+1];if(next===0x00||(next>=0xd0&&next<=0xd7)){offset+=2;continue}if(next===0xd9)return width&&height?{mime_type:'image/jpeg',width,height,extension:'jpg'}:null;break}continue}
    offset+=length;
  }
  return sawScan&&width&&height?{mime_type:'image/jpeg',width,height,extension:'jpg'}:null;
}

function inspectWebp(bytes){
  if(bytes.length<26||ascii(bytes,0,4)!=='RIFF'||ascii(bytes,8,4)!=='WEBP'||u32(bytes,4,true)!==bytes.length-8)return null;
  let offset=12,width=0,height=0,image=false;
  while(offset+8<=bytes.length){const type=ascii(bytes,offset,4),length=u32(bytes,offset+4,true),end=offset+8+length+(length&1);if(end>bytes.length||['EXIF','XMP ','ICCP'].includes(type))return null;const data=offset+8;
    if(type==='VP8X'){if(length!==10)return null;width=1+u24(bytes,data+4,true);height=1+u24(bytes,data+7,true)}
    else if(type==='VP8 '){if(length<10||bytes[data+3]!==0x9d||bytes[data+4]!==0x01||bytes[data+5]!==0x2a)return null;width=(bytes[data+6]|bytes[data+7]<<8)&0x3fff;height=(bytes[data+8]|bytes[data+9]<<8)&0x3fff;image=true}
    else if(type==='VP8L'){if(length<5||bytes[data]!==0x2f)return null;const bits=u32(bytes,data+1,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;image=true}
    else if(type!=='ALPH'&&type!=='ANIM'&&type!=='ANMF')return null;
    offset=end;
  }
  return offset===bytes.length&&image&&width&&height?{mime_type:'image/webp',width,height,extension:'webp'}:null;
}

function inspectVpageImageContainer(bytes,declaredType=''){
  if(!(bytes instanceof Uint8Array)||bytes.length<1)throw new VpageMediaError('ไฟล์รูปไม่ถูกต้อง',{status:422,code:'VPAGE_IMAGE_INVALID'});
  if(bytes.length>VPAGE_IMAGE_MAX_BYTES)throw new VpageMediaError('รูปต้องมีขนาดไม่เกิน 5 MB',{status:413,code:'VPAGE_IMAGE_TOO_LARGE'});
  const item=inspectPng(bytes)||inspectJpeg(bytes)||inspectWebp(bytes);if(!item||item.mime_type!==declaredType)throw new VpageMediaError('รองรับเฉพาะ JPG, PNG หรือ WEBP ที่ถูกต้องและไม่มี metadata',{status:422,code:'VPAGE_IMAGE_INVALID'});
  if(item.width<1||item.height<1||item.width>VPAGE_IMAGE_MAX_DIMENSION||item.height>VPAGE_IMAGE_MAX_DIMENSION||item.width*item.height>16_777_216)throw new VpageMediaError('ขนาดภาพเกินกำหนด',{status:422,code:'VPAGE_IMAGE_DIMENSIONS_INVALID'});
  return{...item,file_size:bytes.length};
}

async function readBoundedVpageImage(response,expectedBytes){
  const reader=response.body?.getReader?.();if(!reader)throw new VpageMediaError('บริการตรวจรูปไม่ส่งข้อมูลภาพ',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'});
  const chunks=[];let total=0;
  try{while(true){const{done,value}=await reader.read();if(done)break;const chunk=value instanceof Uint8Array?value:new Uint8Array(value||0);total+=chunk.byteLength;if(total>VPAGE_IMAGE_MAX_BYTES)throw new VpageMediaError('บริการตรวจรูปส่งไฟล์ใหญ่เกินกำหนด',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'});chunks.push(chunk)}}catch(error){await reader.cancel().catch(()=>undefined);throw error}
  if(total!==expectedBytes)throw new VpageMediaError('บริการตรวจรูปส่งขนาดไฟล์ไม่ตรงกัน',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'});const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return bytes;
}

export async function inspectVpageImage(env,bytes,declaredType='',{signal}={}){
  const source=inspectVpageImageContainer(bytes,declaredType),sanitizer=env?.PORTRAIT_SANITIZER;
  if(!sanitizer||typeof sanitizer.fetch!=='function')throw new VpageMediaError('บริการตรวจความปลอดภัยของรูปยังไม่พร้อม',{status:503,code:'VPAGE_IMAGE_SANITIZER_NOT_CONFIGURED'});
  const controller=new AbortController(),abort=()=>controller.abort(signal?.reason);if(signal?.aborted)abort();else signal?.addEventListener?.('abort',abort,{once:true});const timeout=setTimeout(()=>controller.abort(new DOMException('Vpage image sanitizer timeout','TimeoutError')),15_000);
  try{
    let response;try{response=await sanitizer.fetch('https://portrait-sanitizer.internal/v1/vpage-reencode',{method:'POST',headers:{'content-type':source.mime_type,'x-visiond-sanitizer-protocol':'2','x-visiond-input-bytes':String(bytes.byteLength)},body:bytes,signal:controller.signal})}catch(error){if(signal?.aborted)throw error;throw new VpageMediaError('เชื่อมต่อบริการตรวจรูปไม่สำเร็จ',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'})}
    if(!response?.ok){const invalid=[400,413,415,422].includes(response?.status);throw new VpageMediaError(invalid?'ไฟล์นี้ถอดรหัสเป็นรูปที่ปลอดภัยไม่ได้':'บริการตรวจรูปยังไม่พร้อม',{status:invalid?422:503,code:invalid?'VPAGE_IMAGE_DECODE_FAILED':'VPAGE_IMAGE_SANITIZER_FAILED'})}
    if(String(response.headers?.get?.('content-type')||'').split(';')[0].trim().toLowerCase()!=='image/webp'||response.headers?.get?.('x-visiond-sanitizer')!=='cloudflare-images-v1')throw new VpageMediaError('บริการตรวจรูปส่งชนิดไฟล์ไม่ถูกต้อง',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'});
    const exactInteger=name=>{const value=String(response.headers?.get?.(name)||'');return/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null},contentLength=exactInteger('content-length'),outputBytes=exactInteger('x-visiond-output-bytes'),outputWidth=exactInteger('x-visiond-output-width'),outputHeight=exactInteger('x-visiond-output-height'),outputHash=String(response.headers?.get?.('x-visiond-output-sha256')||'');
    if(contentLength===null||outputBytes===null||contentLength!==outputBytes||outputBytes>VPAGE_IMAGE_MAX_BYTES||outputWidth===null||outputHeight===null||outputWidth>VPAGE_IMAGE_MAX_DIMENSION||outputHeight>VPAGE_IMAGE_MAX_DIMENSION||!Number.isSafeInteger(outputWidth*outputHeight)||outputWidth*outputHeight>16_777_216||!/^[a-f0-9]{64}$/.test(outputHash))throw new VpageMediaError('บริการตรวจรูปส่ง metadata ไม่ถูกต้อง',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'});
    const output=await readBoundedVpageImage(response,outputBytes);let inspected;try{inspected=inspectVpageImageContainer(output,'image/webp')}catch{throw new VpageMediaError('บริการตรวจรูปส่งไฟล์ไม่ถูกต้อง',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'})}const actualHash=await hashVpageBytes(output);if(inspected.width!==outputWidth||inspected.height!==outputHeight||actualHash!==outputHash)throw new VpageMediaError('บริการตรวจรูปส่งข้อมูลยืนยันไม่ตรงกับไฟล์',{status:503,code:'VPAGE_IMAGE_SANITIZER_FAILED'});return{...inspected,bytes:output,content_hash:actualHash};
  }finally{clearTimeout(timeout);signal?.removeEventListener?.('abort',abort)}
}

export async function hashVpageBytes(bytes){const digest=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')}
export const newVpageMediaId=()=>`vpm_${crypto.randomUUID().replaceAll('-','')}`;
export const vpageMediaUrl=(request,id)=>`${new URL(request.url).origin}/api/vpage/media/${id}`;
export const privateMediaHeaders=PRIVATE;

const mediaSlots=payload=>{
  const values=[['hero',payload.product_image_url],['background',payload.background_image_url]];
  for(const [index,item] of (Array.isArray(payload.product_items)?payload.product_items:[]).entries())values.push([`product:${index+1}`,item?.image_url]);
  for(const [index,item] of (Array.isArray(payload.contact_items)?payload.contact_items:[]).entries())values.push([`contact:${index+1}`,item?.image_url]);
  return values;
};
const mediaOrigins=(origin,env)=>{const origins=new Set([new URL(origin).origin,'https://visiondonline.com','https://www.visiondonline.com']);try{origins.add(new URL(String(env.APP_ORIGIN||'')).origin)}catch{}return origins};
const mediaIdFromUrl=(value,origin,env)=>{if(typeof value!=='string'||!value.trim())return null;let url;try{url=new URL(value)}catch{return null}const origins=mediaOrigins(origin,env),knownHosts=new Set([...origins].map(item=>new URL(item).hostname));if(!origins.has(url.origin)){if(knownHosts.has(url.hostname))throw new VpageMediaError('URL รูปของ VisionD ต้องใช้ origin ที่กำหนด',{status:422,code:'VPAGE_MEDIA_URL_INVALID'});return null}const secure=url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname));const match=url.pathname.match(/^\/api\/vpage\/media\/(vpm_[a-f0-9]{32})$/);if(!secure||!match||url.search||url.hash)throw new VpageMediaError('URL รูปของ VisionD ไม่ถูกต้อง',{status:422,code:'VPAGE_MEDIA_URL_INVALID'});return match[1]};

export async function prepareVpageMediaSave(env,{request,ownerId,pageId,vpageId,setNo,key,payload}){
  const origin=new URL(request.url).origin,slots=mediaSlots(payload),refs=[];
  for(const [slotKey,value] of slots){const mediaId=mediaIdFromUrl(value,origin,env);if(mediaId)refs.push({slotKey,mediaId})}
  if(refs.length){const ids=[...new Set(refs.map(item=>item.mediaId))],marks=ids.map(()=>'?').join(','),rows=(await env.DB.prepare(`SELECT id FROM vpage_media WHERE owner_id=? AND page_id=? AND state='ready' AND id IN (${marks}) LIMIT 8`).bind(ownerId,pageId,...ids).all()).results||[],found=new Set(rows.map(row=>row.id));if(ids.some(id=>!found.has(id)))throw new VpageMediaError('รูปไม่ได้อยู่ในคลังของเซลเพจนี้',{status:422,code:'VPAGE_MEDIA_NOT_OWNED'})}
  const requestHash=await sha256(JSON.stringify({page_id:pageId,vpage_id:vpageId,set_no:setNo,payload})),existing=await env.DB.prepare('SELECT id,page_id,vpage_id,set_no,request_hash,state FROM vpage_media_save_ops WHERE owner_id=? AND idempotency_key=?').bind(ownerId,key).first();
  if(existing){if(existing.request_hash!==requestHash||existing.page_id!==pageId||existing.vpage_id!==vpageId||Number(existing.set_no)!==Number(setNo))throw new VpageMediaError('Idempotency key ใช้กับข้อมูลอื่นแล้ว',{status:409,code:'VPAGE_MEDIA_SAVE_IDEMPOTENCY_CONFLICT'});return{id:existing.id,state:existing.state,refs}}
  const live=await env.DB.prepare("SELECT id FROM vpage_media_save_ops WHERE page_id=? AND set_no=? AND state='pending' LIMIT 1").bind(pageId,setNo).first();if(live)throw new VpageMediaError('มีการบันทึกชุดนี้ที่ยังตรวจสอบไม่เสร็จ',{status:409,code:'VPAGE_MEDIA_SAVE_IN_PROGRESS'});
  const id=`vpmo_${crypto.randomUUID().replaceAll('-','')}`,statements=[env.DB.prepare("INSERT INTO vpage_media_save_ops(id,owner_id,page_id,vpage_id,set_no,idempotency_key,request_hash,state) VALUES(?,?,?,?,?,?,?,'pending')").bind(id,ownerId,pageId,vpageId,setNo,key,requestHash),...refs.map(ref=>env.DB.prepare('INSERT INTO vpage_media_pending_refs(op_id,media_id,slot_key) VALUES(?,?,?)').bind(id,ref.mediaId,ref.slotKey))];
  try{await env.DB.batch(statements)}catch{const replay=await env.DB.prepare('SELECT id,page_id,vpage_id,set_no,request_hash,state FROM vpage_media_save_ops WHERE owner_id=? AND idempotency_key=?').bind(ownerId,key).first();if(replay?.request_hash===requestHash&&replay.page_id===pageId&&replay.vpage_id===vpageId&&Number(replay.set_no)===Number(setNo))return{id:replay.id,state:replay.state,refs};throw new VpageMediaError('มีการบันทึกชุดนี้ที่ยังตรวจสอบไม่เสร็จ',{status:409,code:'VPAGE_MEDIA_SAVE_IN_PROGRESS'})}
  return{id,state:'pending',refs};
}

export async function commitVpageMediaSave(env,opId){
  const op=await env.DB.prepare('SELECT id,owner_id,page_id,set_no,state FROM vpage_media_save_ops WHERE id=?').bind(opId).first();if(!op)return;if(op.state==='committed')return;if(op.state!=='pending')throw new VpageMediaError('คำขอบันทึกถูกยกเลิกแล้ว',{status:409,code:'VPAGE_MEDIA_SAVE_CLOSED'});
  const refs=(await env.DB.prepare('SELECT media_id,slot_key FROM vpage_media_pending_refs WHERE op_id=? ORDER BY slot_key LIMIT 8').bind(op.id).all()).results||[],statements=[env.DB.prepare('DELETE FROM vpage_media_refs WHERE page_id=? AND set_no=?').bind(op.page_id,op.set_no),...refs.map(ref=>env.DB.prepare('INSERT INTO vpage_media_refs(page_id,owner_id,set_no,slot_key,media_id) VALUES(?,?,?,?,?)').bind(op.page_id,op.owner_id,op.set_no,ref.slot_key,ref.media_id)),env.DB.prepare("UPDATE vpage_media_save_ops SET state='committed',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending'").bind(op.id),env.DB.prepare('DELETE FROM vpage_media_pending_refs WHERE op_id=?').bind(op.id)];
  await env.DB.batch(statements);
}
export async function failVpageMediaSave(env,opId){await env.DB.batch([env.DB.prepare("UPDATE vpage_media_save_ops SET state='failed',updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending'").bind(opId),env.DB.prepare('DELETE FROM vpage_media_pending_refs WHERE op_id=?').bind(opId)])}

const slotUrl=(set,slot)=>{if(slot==='hero')return set.product_image_url||'';if(slot==='background')return set.background_image_url||'';const [kind,raw]=slot.split(':'),index=Number(raw)-1;return kind==='product'?set.product_items?.[index]?.image_url||'':kind==='contact'?set.contact_items?.[index]?.image_url||'':''};
export async function reconcilePendingVpageMedia(env,mediaId,origin){
  const row=await env.DB.prepare("SELECT o.id,o.owner_id,o.page_id,o.vpage_id,o.set_no FROM vpage_media_pending_refs pr JOIN vpage_media_save_ops o ON o.id=pr.op_id AND o.state='pending' JOIN vpage_pages p ON p.id=o.page_id AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP WHERE pr.media_id=? LIMIT 1").bind(mediaId).first();if(!row)return false;
  let remote;try{remote=await readRemoteVpageEditorFresh(env,{userId:row.owner_id,pageId:row.vpage_id})}catch{return false}const set=remote?.item?.content_sets?.find(item=>Number(item.set_no)===Number(row.set_no));if(!set)return false;
  const refs=(await env.DB.prepare('SELECT media_id,slot_key FROM vpage_media_pending_refs WHERE op_id=? ORDER BY slot_key LIMIT 8').bind(row.id).all()).results||[];
  if(!refs.length||refs.some(ref=>mediaIdFromUrl(slotUrl(set,ref.slot_key),origin,env)!==ref.media_id))return false;
  try{await commitVpageMediaSave(env,row.id);return true}catch{return false}
}

export async function syncVpageMediaActiveSet(env,{pageId,vpageId,ownerId,activeSet=null}){
  let selected=Number(activeSet);if(![1,2].includes(selected)){let remote;try{remote=await readRemoteVpageEditorFresh(env,{userId:ownerId,pageId:vpageId})}catch{return false}selected=Number(remote?.item?.active_set);if(![1,2].includes(selected))return false}
  await env.DB.prepare("UPDATE vpage_pages SET media_active_set=?,media_active_state='synced',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND vpage_id=?").bind(selected,pageId,ownerId,vpageId).run();return true;
}
export async function markVpageMediaActiveSetPending(env,{pageId,ownerId}){await env.DB.prepare("UPDATE vpage_pages SET media_active_state='pending',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(pageId,ownerId).run()}
export async function restoreVpageMediaActiveSet(env,{pageId,ownerId}){await env.DB.prepare("UPDATE vpage_pages SET media_active_state=CASE WHEN media_active_set IN (1,2) THEN 'synced' ELSE 'unknown' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(pageId,ownerId).run()}
export async function reconcileVpageMediaActiveSet(env,mediaId){const page=await env.DB.prepare("SELECT p.id,p.user_id,p.vpage_id FROM vpage_media m JOIN vpage_pages p ON p.id=m.page_id WHERE m.id=? AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP AND p.media_active_state<>'synced' LIMIT 1").bind(mediaId).first();return page?syncVpageMediaActiveSet(env,{pageId:page.id,vpageId:page.vpage_id,ownerId:page.user_id}):false}
export async function committedVpageMedia(env,mediaId){return env.DB.prepare("SELECT m.object_key,m.mime_type,m.file_size,m.content_hash FROM vpage_media m JOIN vpage_pages p ON p.id=m.page_id AND p.user_id=m.owner_id JOIN vpage_media_refs r ON r.media_id=m.id AND r.page_id=m.page_id AND r.set_no=p.media_active_set WHERE m.id=? AND m.state='ready' AND p.status='active' AND p.media_active_state='synced' AND datetime(p.expires_at)>CURRENT_TIMESTAMP LIMIT 1").bind(mediaId).first()}
export async function ownedVpageMedia(env,mediaId,ownerId){return env.DB.prepare("SELECT m.object_key,m.mime_type,m.file_size,m.content_hash FROM vpage_media m JOIN vpage_pages p ON p.id=m.page_id AND p.user_id=m.owner_id WHERE m.id=? AND m.owner_id=? AND m.state='ready' AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP LIMIT 1").bind(mediaId,ownerId).first()}
export const validVpageMediaId=value=>MEDIA_ID.test(String(value||''));
