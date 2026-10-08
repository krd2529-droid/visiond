import {json,requireAdmin} from '../../../_lib.js';
import {galleryUrl} from '../../../_toys_center.js';
import {makeShopeeWorkbook} from '../../../_toys_center_shopee_xlsx.js';
import {boundedFormData,validateShopeeRow} from './[id]/shopee-xlsx.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const MAX_PRODUCTS=24;
const fields='id,meta_id,title,description,price_cents,quantity,gtin,status,image_1_key,shopee_weight_g,shopee_package_width_mm,shopee_package_length_mm,shopee_package_height_mm';

function parseItems(raw){
  let items;try{items=JSON.parse(raw)}catch{return null}
  if(!Array.isArray(items)||items.length<1||items.length>MAX_PRODUCTS)return null;
  const seen=new Set();
  for(const item of items){const id=item?.id;if(!Number.isSafeInteger(id)||id<1||seen.has(id)){return null}seen.add(id)}
  return items;
}

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(Number(ctx.request.headers.get('content-length')||0)>2300000)return json({error:'ไฟล์เทมเพลต Shopee ใหญ่เกิน 2 MB'},413,headers);
  let form;try{form=await boundedFormData(ctx.request)}catch(error){return json({error:error.status===413?error.message:'อ่านฟอร์มส่งออก Shopee ไม่สำเร็จ'},error.status===413?413:400,headers)}
  const items=parseItems(form?.get('items'));
  if(!items)return json({error:'เลือกสินค้า 1–24 รายการ โดยแต่ละรายการต้องมีรหัสสินค้าที่ไม่ซ้ำและรหัสหมวดหมู่ของตัวเอง'},400,headers);
  const file=form.get('template');
  if(!(file instanceof File)||!file.size||file.size>2*1024*1024||!String(file.name).toLowerCase().endsWith('.xlsx'))return json({error:'เลือกไฟล์ Excel .xlsx ตัวอย่าง Shopee ไม่เกิน 2 MB'},400,headers);
  const source=new Uint8Array(await file.arrayBuffer());
  if(source[0]!==0x50||source[1]!==0x4b)return json({error:'ไฟล์ที่เลือกไม่ใช่ Excel .xlsx'},400,headers);
  const ids=items.map(item=>item.id),marks=ids.map(()=>'?').join(',');
  const products=(await ctx.env.DB.prepare(`SELECT ${fields} FROM toys_center_products WHERE id IN (${marks}) LIMIT ${MAX_PRODUCTS}`).bind(...ids).all()).results||[];
  const galleries=(await ctx.env.DB.prepare(`SELECT id,product_id,position,image_key FROM toys_center_product_images WHERE product_id IN (${marks}) ORDER BY product_id,position LIMIT ${MAX_PRODUCTS*10}`).bind(...ids).all()).results||[];
  const byId=new Map(products.map(product=>[Number(product.id),product])),byGallery=new Map();
  for(const image of galleries){const id=Number(image.product_id);if(!byGallery.has(id))byGallery.set(id,[]);byGallery.get(id).push(image)}
  const origin=new URL(ctx.request.url).origin,errors=[],rows=[];
  for(const item of items){
    const product=byId.get(item.id);
    if(!product){errors.push(`สินค้า #${item.id}: ไม่พบสินค้า อาจถูกลบหลังเลือก`);continue}
    const gallery=byGallery.get(item.id)||[],cover=gallery.find(image=>image.image_key===product.image_1_key),seen=new Set(),ordered=[];
    for(const image of cover?[cover,...gallery]:gallery){if(seen.has(image.image_key)||ordered.length>=9)continue;seen.add(image.image_key);ordered.push(image)}
    const images=await Promise.all(ordered.map(async(image,index)=>{let object=null;try{object=await ctx.env.FILES?.head(image.image_key)}catch{}return{url:galleryUrl(origin,item.id,Number(image.position),image.id),cover:index===0&&image===cover,exists:Boolean(object),type:String(object?.httpMetadata?.contentType||'').toLowerCase(),size:Number(object?.size)}}));
    const checked=validateShopeeRow(product,images,{categoryId:item.categoryId,standardDelivery:form.get('standard_delivery')},origin);
    if(checked.errors.length)errors.push(...checked.errors.map(error=>`สินค้า ${product.meta_id} (${product.title}): ${error}`));
    else rows.push(checked.row);
  }
  if(errors.length)return json({error:'ข้อมูลสินค้า Shopee ยังไม่พร้อม',errors},422,headers);
  try{const workbook=await makeShopeeWorkbook(source,rows);return new Response(workbook,{status:200,headers:{...headers,'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="visiond-shopee-${rows.length}-products.xlsx"`}})}catch(error){return json({error:error.message||'สร้าง Excel Shopee ไม่สำเร็จ'},400,headers)}
}
