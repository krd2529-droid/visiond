const MAX_SOURCE_BYTES=5*1024*1024;
const MAX_SHOPEE_BYTES=2*1024*1024;
const supported=new Set(['image/jpeg','image/png']);
const conversionInflight=new Map();
export const shopeeDerivativeKey=id=>`toys-center/shopee/${id}.jpg`;
export const shopeeImageUrl=(origin,productId,imageId,extension)=>`${origin}/api/toys-center/shopee-images/${productId}/${imageId}.${extension}`;
const mime=object=>String(object?.httpMetadata?.contentType||'').split(';')[0].trim().toLowerCase();
const validSize=(object,max=MAX_SHOPEE_BYTES)=>Number.isSafeInteger(Number(object?.size))&&Number(object.size)>0&&Number(object.size)<=max;
const jpeg=bytes=>bytes.length>=64&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes.at(-2)===0xff&&bytes.at(-1)===0xd9;

async function boundedBytes(response){
  const reader=response.body?.getReader?.();if(!reader)throw new Error('บริการแปลงรูป Shopee ไม่ส่งไฟล์');
  const chunks=[];let total=0;
  try{for(;;){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_SHOPEE_BYTES)throw new Error('รูป Shopee ที่แปลงแล้วเกิน 2 MB');chunks.push(value)}}catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return bytes;
}

async function makeDerivative(ctx,image,source,sourceType){
  const key=shopeeDerivativeKey(image.id),stored=await ctx.env.FILES.head(key);
  if(stored&&mime(stored)==='image/jpeg'&&validSize(stored))return stored;
  if(!ctx.env.PORTRAIT_SANITIZER?.fetch)throw new Error('บริการแปลงรูป Shopee ยังไม่พร้อม');
  const original=await ctx.env.FILES.get(image.image_key);
  if(!original||mime(original)!==sourceType||!validSize(original,MAX_SOURCE_BYTES))throw new Error('รูปต้นฉบับ Shopee ไม่ถูกต้อง');
  const input=new Uint8Array(await original.arrayBuffer());
  if(input.byteLength!==Number(source.size))throw new Error('รูปต้นฉบับ Shopee เปลี่ยนระหว่างส่งออก');
  const response=await ctx.env.PORTRAIT_SANITIZER.fetch('https://portrait-sanitizer.internal/v1/shopee-reencode',{method:'POST',headers:{'content-type':sourceType,'x-visiond-sanitizer-protocol':'1','x-visiond-input-bytes':String(input.byteLength)},body:input});
  if(!response.ok)throw new Error('แปลงรูป Shopee ไม่สำเร็จ');
  if(response.headers.get('content-type')!=='image/jpeg'||response.headers.get('x-visiond-sanitizer')!=='cloudflare-images-v1')throw new Error('บริการแปลงรูป Shopee ส่งชนิดไฟล์ไม่ถูกต้อง');
  const bytes=await boundedBytes(response);
  if(!jpeg(bytes)||Number(response.headers.get('x-visiond-output-bytes'))!==bytes.length||Number(response.headers.get('content-length'))!==bytes.length)throw new Error('บริการแปลงรูป Shopee ส่งไฟล์ไม่ถูกต้อง');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
  if(hash!==response.headers.get('x-visiond-output-sha256'))throw new Error('รูป Shopee ที่แปลงแล้วไม่ตรงกับข้อมูลยืนยัน');
  await ctx.env.FILES.put(key,bytes,{httpMetadata:{contentType:'image/jpeg'}});
  const result=await ctx.env.FILES.head(key);
  if(mime(result)!=='image/jpeg'||!validSize(result))throw new Error('บันทึกรูป Shopee ไม่สำเร็จ');
  return result;
}

export async function prepareShopeeImage(ctx,productId,image,origin){
  const source=await ctx.env.FILES?.head(image.image_key),sourceType=mime(source);
  if(!source||!validSize(source,MAX_SOURCE_BYTES)||!['image/jpeg','image/png','image/webp'].includes(sourceType))
    return{url:'',exists:Boolean(source),type:sourceType,size:Number(source?.size)};
  const direct=supported.has(sourceType)&&validSize(source);
  if(direct)return{url:shopeeImageUrl(origin,productId,image.id,sourceType==='image/png'?'png':'jpg'),exists:true,type:sourceType,size:Number(source.size)};
  const key=shopeeDerivativeKey(image.id);
  let pending=conversionInflight.get(key);
  if(!pending){pending=makeDerivative(ctx,image,source,sourceType).finally(()=>conversionInflight.delete(key));conversionInflight.set(key,pending)}
  const derivative=await pending;
  return{url:shopeeImageUrl(origin,productId,image.id,'jpg'),exists:true,type:'image/jpeg',size:Number(derivative.size)};
}
