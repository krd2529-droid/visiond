import {json,requireAdmin} from '../../_lib.js';

const MODEL='gemini-3.1-flash-image';
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const reply=(data,status)=>json(data,status,headers);
const allowed=new Set(['image/png','image/jpeg','image/webp']);
const decode=value=>{const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes};
const matches=(bytes,type)=>type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/webp'?bytes[0]===82&&bytes[1]===73&&bytes[2]===70&&bytes[3]===70&&bytes[8]===87&&bytes[9]===69&&bytes[10]===66&&bytes[11]===80:false;
const encode=bytes=>{const chunks=[];for(let start=0;start<bytes.length;start+=12288){const slice=bytes.subarray(start,start+12288);let binary='';for(let i=0;i<slice.length;i++)binary+=String.fromCharCode(slice[i]);chunks.push(btoa(binary))}return chunks.join('')};
async function boundedForm(request){const reader=request.body?.getReader();if(!reader)return null;const chunks=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>11_000_000){await reader.cancel();return 'oversize'}chunks.push(value)}}finally{reader.releaseLock()}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:bytes}).formData().catch(()=>null)}
async function boundedText(response){const reader=response.body?.getReader();if(!reader)return null;const decoder=new TextDecoder(),parts=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>15_000_000){await reader.cancel();return 'oversize'}parts.push(decoder.decode(value,{stream:true}))}parts.push(decoder.decode());return parts.join('')}finally{reader.releaseLock()}}

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(Number(ctx.request.headers.get('content-length')||0)>11_000_000)return reply({error:'ไฟล์ภาพใหญ่เกิน 8 MB'},413);
  const form=await boundedForm(ctx.request);
  if(form==='oversize')return reply({error:'ไฟล์ภาพใหญ่เกิน 8 MB'},413);
  if(!form||form.get('rights_confirmed')!=='true')return reply({error:'กรุณายืนยันสิทธิ์ใช้ภาพก่อนส่งภาพเพื่อลบข้อความและโลโก้'},422);
  const image=form.get('image');
  if(!(image instanceof File)||!allowed.has(image.type)||image.size<100||image.size>8_000_000)return reply({error:'ใช้ภาพ PNG/JPEG/WebP ขนาดไม่เกิน 8 MB'},422);
  const original=new Uint8Array(await image.arrayBuffer());
  if(!matches(original,image.type))return reply({error:'ไฟล์ภาพไม่สมบูรณ์หรือชนิดไม่ตรง'},422);
  const key=String(ctx.env.GEMINI_API_KEY||'').trim();
  if(!key)return reply({error:'ยังไม่ได้ตั้งค่า Gemini สำหรับลบข้อความและโลโก้บนปก'},503);
  const base64=encode(original);
  const prompt='Edit this supplied news photograph into a portrait 9:16 clean photographic background. Preserve the same recognizable real subject, objects, event, clothing, colors and overall photographic character. Extend or recompose the landscape edges only as needed for the portrait frame; do not replace the scene or invent new event details. Remove every existing news outlet logo, watermark, graphic banner, caption, headline, letter, number and other baked-in typography from the supplied image, reconstructing the photo behind them naturally. Add no new text, logos, lettering, symbols, people or claims. Return only the edited image.';
  let response;
  try{response=await fetch(`https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent`,{method:'POST',signal:AbortSignal.timeout(120000),headers:{'content-type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:[{inlineData:{mimeType:image.type,data:base64}},{text:prompt}]}],generationConfig:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:'9:16',imageSize:'1K'},thinkingConfig:{thinkingLevel:'minimal'}}})})}
  catch(error){return reply({error:error?.name==='TimeoutError'||error?.name==='AbortError'?'ลบข้อความและโลโก้ใช้เวลานานเกินไป กรุณาลองใหม่':'ติดต่อบริการแต่งภาพไม่ได้ กรุณาลองใหม่'},error?.name==='TimeoutError'||error?.name==='AbortError'?504:502)}
  if(!response.ok){await response.body?.cancel().catch(()=>{});return reply({error:response.status===429?'บริการแต่งภาพมีคำขอมากเกินไป กรุณาลองใหม่ภายหลัง':'บริการแต่งภาพไม่สำเร็จ กรุณาลองใหม่'},response.status===429?429:502)}
  if(Number(response.headers.get('content-length')||0)>15_000_000){await response.body?.cancel().catch(()=>{});return reply({error:'ภาพที่แต่งแล้วใหญ่เกินไป'},502)}
  let data;try{const raw=await boundedText(response);if(raw==='oversize')return reply({error:'ภาพที่แต่งแล้วใหญ่เกินไป'},502);data=JSON.parse(raw)}catch{return reply({error:'อ่านภาพที่แต่งแล้วไม่ได้'},502)}
  const part=data?.candidates?.[0]?.content?.parts?.find(item=>item.inlineData?.data&&!item.thought);
  if(!part||!allowed.has(part.inlineData.mimeType))return reply({error:'บริการแต่งภาพไม่ได้ส่งภาพกลับมา'},502);
  let edited;try{edited=decode(part.inlineData.data)}catch{return reply({error:'ภาพที่แต่งแล้วไม่สมบูรณ์'},502)}
  if(edited.length<100||edited.length>8_000_000||!matches(edited,part.inlineData.mimeType))return reply({error:'ภาพที่แต่งแล้วไม่สมบูรณ์'},502);
  return new Response(edited,{headers:{...headers,'content-type':part.inlineData.mimeType}});
}
