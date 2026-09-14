const MAX_AVATAR_BYTES=2*1024*1024;
const allowedMime=new Set(['image/jpeg','image/png','image/webp']);
const allowedHost=hostname=>/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:tiktokcdn\.com|tiktokcdn-us\.com)$/i.test(hostname);
const cleanId=value=>/^[0-9a-f-]{36}$/i.test(String(value||''))?String(value):'';

function providerAvatarUrl(value){
  let url;try{url=new URL(String(value||''))}catch{return null}
  if(url.protocol!=='https:'||url.username||url.password||url.port&&!['443'].includes(url.port)||!allowedHost(url.hostname)||url.hostname.endsWith('.localhost'))return null;
  return url;
}

function imageKind(bytes){
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return{mime:'image/jpeg',ext:'jpg'};
  if(bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value))return{mime:'image/png',ext:'png'};
  if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return{mime:'image/webp',ext:'webp'};
  return null;
}

const abortReason=signal=>signal?.reason instanceof Error?signal.reason:new Error('AVATAR_DOWNLOAD_ABORTED');
async function boundedBytes(response,{signal}={}){
  const declaredHeader=response.headers.get('content-length'),declared=Number(declaredHeader);
  if(declaredHeader!==null&&declaredHeader!==''&&Number.isFinite(declared)&&(declared<1||declared>MAX_AVATAR_BYTES))throw new Error('AVATAR_SIZE_INVALID');
  if(signal?.aborted)throw abortReason(signal);
  if(!response.body?.getReader){const bytes=new Uint8Array(await response.arrayBuffer());if(signal?.aborted)throw abortReason(signal);if(!bytes.length||bytes.length>MAX_AVATAR_BYTES)throw new Error('AVATAR_SIZE_INVALID');return bytes}
  const reader=response.body.getReader(),chunks=[];let size=0,complete=false;
  try{
    while(true){
      let onAbort;
      const aborted=new Promise((_,reject)=>{if(!signal)return;onAbort=()=>{reader.cancel(abortReason(signal)).catch(()=>{});reject(abortReason(signal))};signal.addEventListener('abort',onAbort,{once:true})});
      let part;try{part=await(signal?Promise.race([reader.read(),aborted]):reader.read())}finally{if(onAbort)signal.removeEventListener('abort',onAbort)}
      if(signal?.aborted)throw abortReason(signal);
      const {done,value}=part;if(done){complete=true;break}const chunk=value instanceof Uint8Array?value:new Uint8Array(value);size+=chunk.length;if(size>MAX_AVATAR_BYTES){await reader.cancel().catch(()=>{});throw new Error('AVATAR_SIZE_INVALID')}chunks.push(chunk)
    }
  }finally{if(!complete)await reader.cancel(signal?.aborted?abortReason(signal):new Error('AVATAR_DOWNLOAD_INCOMPLETE')).catch(()=>{});reader.releaseLock?.()}
  if(!size)throw new Error('AVATAR_SIZE_INVALID');
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
}

const hex=buffer=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,'0')).join('');
export const tikTokAvatarMediaUrl=row=>row?.id&&/^[0-9a-f]{64}$/i.test(String(row.avatar_revision||''))?`/api/admin/tiktok-avatar/${encodeURIComponent(row.id)}?v=${row.avatar_revision}`:'';

export async function mirrorTikTokAvatar(env,connection,sourceUrl,fetchImpl=fetch,{stillAuthorized,downloadTimeoutMs=10000}={}){
  const ownerId=Number(connection?.user_id),connectionId=cleanId(connection?.id),source=providerAvatarUrl(sourceUrl),oldKey=String(connection?.avatar_object_key||''),oldRevision=String(connection?.avatar_revision||''),generation=Number(connection?.avatar_sync_generation||0);
  if(!env?.FILES||!Number.isSafeInteger(ownerId)||ownerId<1||!connectionId||!source)return{mirrored:false,preserved:Boolean(oldKey),reason:'source_unavailable'};
  let newKey='';
  try{
    const controller=new AbortController(),timeoutMs=Number.isFinite(Number(downloadTimeoutMs))?Math.max(1,Math.min(10000,Number(downloadTimeoutMs))):10000,timeout=setTimeout(()=>controller.abort(new Error('AVATAR_DOWNLOAD_TIMEOUT')),timeoutMs);let response,bytes,kind,bodyComplete=false;
    try{
      response=await fetchImpl(source.href,{method:'GET',redirect:'manual',signal:controller.signal,headers:{accept:'image/avif,image/webp,image/png,image/jpeg'}});
      if(response.status>=300&&response.status<400)throw new Error('AVATAR_REDIRECT_REFUSED');
      if(!response.ok)throw new Error('AVATAR_DOWNLOAD_FAILED');
      const declaredMime=String(response.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase();if(!allowedMime.has(declaredMime))throw new Error('AVATAR_MIME_INVALID');
      bytes=await boundedBytes(response,{signal:controller.signal});bodyComplete=true;kind=imageKind(bytes);if(!kind||kind.mime!==declaredMime)throw new Error('AVATAR_MAGIC_MISMATCH');
    }finally{clearTimeout(timeout);if(response?.body&&!bodyComplete&&!response.body.locked)await response.body.cancel(controller.signal.aborted?abortReason(controller.signal):new Error('AVATAR_DOWNLOAD_INCOMPLETE')).catch(()=>{})}
    if(stillAuthorized&&!await stillAuthorized())throw new Error('VX_WORKSPACE_ACCESS_REVOKED');
    const revision=hex(await crypto.subtle.digest('SHA-256',bytes)),live=await env.DB.prepare("SELECT avatar_object_key,avatar_mime_type,avatar_file_size,avatar_revision,avatar_sync_generation FROM tiktok_connections WHERE id=? AND user_id=? AND status='active'").bind(connectionId,ownerId).first();
    if(Number(live?.avatar_sync_generation)!==generation)return{mirrored:Boolean(live?.avatar_object_key),preserved:Boolean(live?.avatar_object_key),reason:'concurrent_update'};
    if(live?.avatar_object_key&&live.avatar_revision===revision){const existing=await env.FILES.head(live.avatar_object_key).catch(()=>null),metadata=existing?.customMetadata||{};if(existing&&Number(existing.size)===Number(live.avatar_file_size)&&String(existing.httpMetadata?.contentType||'')===String(live.avatar_mime_type||'')&&String(metadata.ownerUserId||'')===String(ownerId)&&String(metadata.connectionId||'')===connectionId&&String(metadata.revision||'')===revision)return{mirrored:true,preserved:true,reason:'unchanged',revision,url:tikTokAvatarMediaUrl({id:connectionId,avatar_revision:revision})}}
    const newObjectKey=`tiktok-avatars/${ownerId}/${connectionId}/${revision}.${kind.ext}`;newKey=newObjectKey;
    await env.FILES.put(newObjectKey,bytes,{httpMetadata:{contentType:kind.mime,cacheControl:'private, max-age=31536000, immutable'},customMetadata:{ownerUserId:String(ownerId),connectionId,revision}});
    if(stillAuthorized&&!await stillAuthorized())throw new Error('VX_WORKSPACE_ACCESS_REVOKED');
    const attached=await env.DB.prepare(`UPDATE tiktok_connections SET avatar_url='',avatar_object_key=?,avatar_mime_type=?,avatar_file_size=?,avatar_revision=?,avatar_mirrored_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND user_id=? AND status='active' AND avatar_sync_generation=? AND COALESCE(avatar_object_key,'')=? AND COALESCE(avatar_revision,'')=?`).bind(newObjectKey,kind.mime,bytes.length,revision,connectionId,ownerId,generation,oldKey,oldRevision).run();
    if(Number(attached.meta?.changes)!==1){const winner=await env.DB.prepare("SELECT avatar_object_key FROM tiktok_connections WHERE id=? AND user_id=? AND status='active'").bind(connectionId,ownerId).first();if(winner?.avatar_object_key!==newObjectKey)await env.FILES.delete(newObjectKey).catch(()=>{});return{mirrored:Boolean(winner?.avatar_object_key),preserved:Boolean(winner?.avatar_object_key),reason:'concurrent_update'}}
    if(oldKey&&oldKey!==newObjectKey)await env.FILES.delete(oldKey).catch(()=>{});
    return{mirrored:true,preserved:false,reason:'',objectKey:newObjectKey,mimeType:kind.mime,fileSize:bytes.length,revision,url:tikTokAvatarMediaUrl({id:connectionId,avatar_revision:revision})};
  }catch(error){
    if(newKey){const current=await env.DB.prepare("SELECT avatar_object_key FROM tiktok_connections WHERE id=? AND user_id=?").bind(connectionId,ownerId).first().catch(()=>null);if(current?.avatar_object_key!==newKey)await env.FILES.delete(newKey).catch(()=>{})}
    if(String(error?.message||error)==='VX_WORKSPACE_ACCESS_REVOKED')throw error;
    return{mirrored:false,preserved:Boolean(oldKey),reason:String(error?.message||'AVATAR_MIRROR_FAILED').slice(0,80)};
  }
}

export {MAX_AVATAR_BYTES,providerAvatarUrl,imageKind,boundedBytes};
