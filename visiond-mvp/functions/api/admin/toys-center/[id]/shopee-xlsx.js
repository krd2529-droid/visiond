import {json,requireAdmin} from '../../../../_lib.js';
import {prepareShopeeImage} from '../../../../_toys_center_shopee_images.js';
import {makeShopeeWorkbook} from '../../../../_toys_center_shopee_xlsx.js';

const responseHeaders={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const MAX_REQUEST_BYTES=2300000;
export const SHOPEE_CATEGORY_ID=101394;
const text=value=>String(value??'').trim();
const length=value=>Array.from(value).length;
const validInteger=(value,min,max)=>Number.isSafeInteger(Number(value))&&Number(value)>=min&&Number(value)<=max;
export async function boundedFormData(request){
  if(!request.body)return null;
  const reader=request.body.getReader(),chunks=[];let length=0,oversized=false;
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(oversized)continue;length+=value.length;if(length>MAX_REQUEST_BYTES){oversized=true;chunks.length=0}else chunks.push(value)}}finally{reader.releaseLock()}
  if(oversized){const error=new Error('ไฟล์เทมเพลต Shopee ใหญ่เกิน 2 MB');error.status=413;throw error}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  return new Request(request.url,{method:'POST',headers:{'content-type':request.headers.get('content-type')||''},body:bytes}).formData();
}

export function validateShopeeRow(product,images,{standardDelivery},origin){
  const errors=[];
  const delivery=text(standardDelivery),name=text(product.title),description=text(product.description),sku=text(product.meta_id),gtin=text(product.gtin);
  if(delivery!=='เปิด')errors.push('เปิด Standard Delivery ของร้านใน Seller Centre แล้วเลือก “เปิด” ที่นี่');
  if(product.status!=='published')errors.push('เผยแพร่สินค้าใน VisionD ก่อน เพื่อให้ Shopee ดึงลิงก์รูปได้');
  if(length(name)<20||length(name)>120)errors.push('ชื่อสินค้าต้องยาว 20–120 ตัวอักษรตามเทมเพลต Shopee');
  if(length(description)<60||length(description)>5000)errors.push('รายละเอียดสินค้าต้องยาว 60–5000 ตัวอักษรตามเทมเพลต Shopee');
  if(!sku||length(sku)>=100)errors.push('SKU ต้องมีความยาว 1–99 ตัวอักษร');
  if(gtin&&!/^\d{8,14}$/.test(gtin))errors.push('GTIN ถ้ากรอก ต้องเป็นตัวเลข 8–14 หลัก');
  if(!validInteger(product.price_cents,100,50000000))errors.push('ราคาต้องอยู่ระหว่าง 1–500000 บาท');
  if(!validInteger(product.quantity,0,10000000))errors.push('สต็อกต้องเป็นจำนวนเต็ม 0–10000000');
  if(!validInteger(product.shopee_weight_g,1,100000000))errors.push('กรอกน้ำหนักพัสดุ Shopee ไม่เกิน 100000 กก.');
  for(const [key,label] of [['shopee_package_length_mm','ความยาว'],['shopee_package_width_mm','ความกว้าง'],['shopee_package_height_mm','ความสูง']]){
    if(!validInteger(product[key],1,100000000))errors.push(`${label}พัสดุ Shopee ต้องเป็นตัวเลขมากกว่า 0 และไม่เกิน 10000000 ซม.`);
  }
  if(!images.length||!images[0]?.cover)errors.push('เลือกรูปปก VisionD ที่ยังมีไฟล์จริง');
  for(const [index,image] of images.entries()){
    if(!image?.exists)errors.push(`รูป ${index+1} ไม่พบไฟล์ในคลัง`);
    else if(!['image/jpeg','image/png'].includes(image.type)||!validInteger(image.size,1,2*1024*1024))errors.push(`รูป ${index+1} ต้องเป็น JPG/PNG ขนาดไม่เกิน 2 MB`);
  }
  if(!/^https:\/\//i.test(origin))errors.push('ลิงก์รูปต้องใช้ HTTPS ที่เข้าถึงได้จากภายนอก');
  return{errors,row:{categoryId:SHOPEE_CATEGORY_ID,name,description,sku,price:Number(product.price_cents)/100,stock:Number(product.quantity),gtin,images:images.map(image=>image.url),weightKg:Number(product.shopee_weight_g)/1000,lengthCm:Number(product.shopee_package_length_mm)/10,widthCm:Number(product.shopee_package_width_mm)/10,heightCm:Number(product.shopee_package_height_mm)/10,standardDelivery:delivery}};
}

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const id=Number(ctx.params.id);if(!Number.isSafeInteger(id)||id<1)return json({error:'ไม่พบสินค้า'},404,responseHeaders);
  if(Number(ctx.request.headers.get('content-length')||0)>MAX_REQUEST_BYTES)return json({error:'ไฟล์เทมเพลต Shopee ใหญ่เกิน 2 MB'},413,responseHeaders);
  let form;try{form=await boundedFormData(ctx.request)}catch(error){return json({error:error.status===413?error.message:'อ่านฟอร์มส่งออก Shopee ไม่สำเร็จ'},error.status===413?413:400,responseHeaders)}
  const file=form?.get('template');
  if(!(file instanceof File)||!file.size||file.size>2*1024*1024||!String(file.name).toLowerCase().endsWith('.xlsx'))return json({error:'เลือกไฟล์ Excel .xlsx ตัวอย่าง Shopee ที่แนบมา (ไม่เกิน 2 MB)'},400,responseHeaders);
  const source=new Uint8Array(await file.arrayBuffer());
  if(source[0]!==0x50||source[1]!==0x4b)return json({error:'ไฟล์ที่เลือกไม่ใช่ Excel .xlsx'},400,responseHeaders);
  const product=await ctx.env.DB.prepare('SELECT id,meta_id,title,description,price_cents,quantity,gtin,status,image_1_key,shopee_weight_g,shopee_package_width_mm,shopee_package_length_mm,shopee_package_height_mm FROM toys_center_products WHERE id=?').bind(id).first();
  if(!product)return json({error:'ไม่พบสินค้า'},404,responseHeaders);
  const gallery=(await ctx.env.DB.prepare('SELECT id,position,image_key FROM toys_center_product_images WHERE product_id=? ORDER BY position LIMIT 10').bind(id).all()).results||[];
  const selected=gallery.find(item=>item.image_key===product.image_1_key),seen=new Set(),ordered=[];
  for(const item of selected?[selected,...gallery]:gallery){if(!item||seen.has(item.image_key)||ordered.length>=9)continue;seen.add(item.image_key);ordered.push(item)}
  const origin=new URL(ctx.request.url).origin;
  let images;try{images=await Promise.all(ordered.map(async(item,index)=>({...await prepareShopeeImage(ctx,id,item,origin),cover:index===0&&item===selected})))}
  catch(error){return json({error:error.message||'เตรียมรูป Shopee ไม่สำเร็จ'},503,responseHeaders)}
  const {errors,row}=validateShopeeRow(product,images,{standardDelivery:form.get('standard_delivery')},origin);
  if(errors.length)return json({error:'ข้อมูลยังไม่พร้อมสำหรับ Excel Shopee',errors},422,responseHeaders);
  try{
    const workbook=await makeShopeeWorkbook(source,row);
    return new Response(workbook,{status:200,headers:{...responseHeaders,'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="visiond-shopee-${id}.xlsx"`}});
  }catch(error){return json({error:error.message||'สร้าง Excel Shopee ไม่สำเร็จ'},400,responseHeaders)}
}
