import {json,requireAdmin} from '../../../_lib.js';

const MODEL='gemini-3.1-flash-image';
const allowedRatios=new Set(['1:1','3:4','4:3','9:16','16:9']);

const decodeBase64=value=>{
  const binary=atob(value),bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
  return bytes;
};

const safeSlug=value=>String(value||'vision2').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'vision2';

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(!ctx.env.FILES)return json({error:'ยังไม่ได้เชื่อม R2 binding ชื่อ FILES',code:'storage_missing'},500);
  if(!ctx.env.GEMINI_API_KEY)return json({error:'ยังไม่ได้ตั้ง Cloudflare Secret ชื่อ GEMINI_API_KEY',code:'api_key_missing'},503);
  const body=await ctx.request.json().catch(()=>({}));
  if(body.provider!=='google-imagen')return json({error:'API นี้ยังไม่ได้เชื่อม กรุณาเลือก Google Imagen API',code:'provider_not_connected'},400);
  const prompt=String(body.prompt||'').trim().slice(0,12000);
  if(!prompt)return json({error:'ไม่พบ Prompt สำหรับสร้างภาพ',code:'invalid_prompt'},400);
  const aspectRatio=allowedRatios.has(body.aspect_ratio)?body.aspect_ratio:'3:4';
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),120000);
  let response;
  try{
    response=await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`,{
      method:'POST',signal:controller.signal,
      headers:{'content-type':'application/json','x-goog-api-key':ctx.env.GEMINI_API_KEY},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseModalities:['IMAGE'],responseFormat:{image:{aspectRatio,imageSize:'1K'}},thinkingConfig:{thinkingLevel:'minimal'}}})
    });
  }catch(error){
    clearTimeout(timeout);
    if(error?.name==='AbortError')return json({error:'Gemini ใช้เวลานานเกิน 120 วินาที',code:'timeout'},504);
    return json({error:'ติดต่อ Gemini ไม่สำเร็จ',code:'upstream_error'},502);
  }
  clearTimeout(timeout);
  const retryAfter=Number(response.headers.get('retry-after'))||0;
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    const error=data?.error?.message||'Gemini สร้างภาพไม่สำเร็จ';
    if(response.status===429)return json({error,code:'rate_limit',retryAfter},429,{'retry-after':String(retryAfter||30)});
    return json({error,code:response.status>=500?'upstream_error':'generation_rejected'},response.status>=500?502:400);
  }
  const parts=data?.candidates?.[0]?.content?.parts||[];
  const imagePart=parts.find(part=>part.inlineData?.data&&!part.thought);
  if(!imagePart)return json({error:'Gemini ไม่ได้ส่งไฟล์ภาพกลับมา กรุณาลองรูปนี้ใหม่',code:'empty_image'},502);
  const mimeType=imagePart.inlineData.mimeType||'image/png',extension=mimeType.includes('jpeg')?'jpg':mimeType.includes('webp')?'webp':'png';
  const project=safeSlug(body.project_name),position=Math.max(1,Math.floor(Number(body.index)||0)+1),key=`vision2/${auth.user.id}/${project}/${Date.now()}-${crypto.randomUUID()}-image-${position}.${extension}`;
  const bytes=decodeBase64(imagePart.inlineData.data);
  await ctx.env.FILES.put(key,bytes,{httpMetadata:{contentType:mimeType,cacheControl:'private, max-age=3600'},customMetadata:{userId:String(auth.user.id),project,index:String(position),model:MODEL}});
  return json({ok:true,key,url:`/api/admin/vision2/image?key=${encodeURIComponent(key)}`,mimeType,model:MODEL});
}
