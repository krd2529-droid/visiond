import {cookie,json,requireAdmin} from '../../../_lib.js';
import {prepareShopeeImage} from '../../../_toys_center_shopee_images.js';
import {makeShopeeWorkbook} from '../../../_toys_center_shopee_xlsx.js';
import {boundedFormData,validateShopeeRow} from './[id]/shopee-xlsx.js';
import {stockStore} from '../../../_stock.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const MAX_PRODUCTS=200,PREPARE_PRODUCTS=10,DIRECT_PRODUCTS=24,CHUNK_TTL_MS=30*60*1000;
const MAX_BATCH_REQUEST_BYTES=6*1024*1024;
const fields='id,meta_id,title,description,price_cents,quantity,gtin,status,image_1_key,shopee_weight_g,shopee_package_width_mm,shopee_package_length_mm,shopee_package_height_mm,updated_at';
const encoder=new TextEncoder();

function parseItems(raw,max=MAX_PRODUCTS){
  let items;try{items=JSON.parse(raw)}catch{return null}
  if(!Array.isArray(items)||items.length<1||items.length>max)return null;
  const seen=new Set();
  for(const item of items){const id=item?.id;if(!Number.isSafeInteger(id)||id<1||seen.has(id))return null;seen.add(id)}
  return items;
}

async function signingKey(ctx){
  const secret=String(ctx.env.VISIOND_CHANNEL_ENCRYPTION_KEY||'');
  const digest=await crypto.subtle.digest('SHA-256',encoder.encode(`toys-shopee-export:v1:${secret}`));
  return crypto.subtle.importKey('raw',digest,{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
const hex=bytes=>[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const signedBytes=(ctx,payload)=>encoder.encode(`${cookie(ctx.request,'vd_session')}.${JSON.stringify(payload)}`);
const snapshot=async(product,gallery)=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(JSON.stringify([fields.split(',').map(key=>product[key]),gallery.map(image=>[image.id,image.position,image.image_key])]))));
async function signChunk(ctx,payload){
  const signature=await crypto.subtle.sign('HMAC',await signingKey(ctx),signedBytes(ctx,payload));
  return{payload,signature:hex(signature)};
}
async function validChunk(ctx,chunk){
  if(!chunk||typeof chunk!=='object'||!chunk.payload||typeof chunk.signature!=='string'||!/^[0-9a-f]{64}$/.test(chunk.signature))return false;
  const bytes=Uint8Array.from(chunk.signature.match(/../g),part=>parseInt(part,16));
  return crypto.subtle.verify('HMAC',await signingKey(ctx),bytes,signedBytes(ctx,chunk.payload));
}

async function selectedRows(ctx,items,delivery,store){
  const ids=items.map(item=>item.id),marks=ids.map(()=>'?').join(',');
  const products=(await ctx.env.DB.prepare(`SELECT ${fields} FROM toys_center_products WHERE store_id=? AND id IN (${marks}) LIMIT ${ids.length}`).bind(store,...ids).all()).results||[];
  const galleries=(await ctx.env.DB.prepare(`SELECT id,product_id,position,image_key FROM toys_center_product_images WHERE product_id IN (${marks}) ORDER BY product_id,position LIMIT ${ids.length*10}`).bind(...ids).all()).results||[];
  const byId=new Map(products.map(product=>[Number(product.id),product])),byGallery=new Map();
  for(const image of galleries){const id=Number(image.product_id);if(!byGallery.has(id))byGallery.set(id,[]);byGallery.get(id).push(image)}
  const origin=new URL(ctx.request.url).origin,errors=[],rows=[],snapshots=[];
  for(const item of items){
    const product=byId.get(item.id);
    if(!product){errors.push(`สินค้า #${item.id}: ไม่พบสินค้า อาจถูกลบหลังเลือก`);continue}
    const gallery=byGallery.get(item.id)||[],cover=gallery.find(image=>image.image_key===product.image_1_key),seen=new Set(),ordered=[];
    for(const image of cover?[cover,...gallery]:gallery){if(seen.has(image.image_key)||ordered.length>=9)continue;seen.add(image.image_key);ordered.push(image)}
    let images;try{images=await Promise.all(ordered.map(async(image,index)=>({...await prepareShopeeImage(ctx,item.id,image,origin),cover:index===0&&image===cover})))}
    catch(error){errors.push(`สินค้า ${product.meta_id} (${product.title}): ${error.message||'เตรียมรูป Shopee ไม่สำเร็จ'}`);continue}
    const checked=validateShopeeRow(product,images,{standardDelivery:delivery},origin);
    if(checked.errors.length)errors.push(...checked.errors.map(error=>`สินค้า ${product.meta_id} (${product.title}): ${error}`));
    else{rows.push(checked.row);snapshots.push(await snapshot(product,gallery))}
  }
  return{errors,rows,snapshots};
}

async function compilePrepared(ctx,auth,form,items,source,store){
  let chunks;try{chunks=JSON.parse(form.get('chunks'))}catch{return json({error:'ชุดข้อมูลสินค้า Shopee ไม่ถูกต้อง'},400,headers)}
  if(!Array.isArray(chunks)||chunks.length<1||chunks.length>MAX_PRODUCTS)return json({error:'ชุดข้อมูลสินค้า Shopee ไม่ถูกต้อง'},400,headers);
  const origin=new URL(ctx.request.url).origin,now=Date.now(),rows=[],snapshots=[],ids=[];
  for(const chunk of chunks){
    if(!await validChunk(ctx,chunk))return json({error:'ชุดข้อมูลสินค้า Shopee ไม่ผ่านการยืนยัน'},400,headers);
    const payload=chunk.payload;
    if(payload.userId!==auth.user.id||payload.store!==store||payload.origin!==origin||payload.delivery!=='เปิด'||!Number.isSafeInteger(payload.expires)||payload.expires<now||payload.expires>now+CHUNK_TTL_MS||!Array.isArray(payload.ids)||!Array.isArray(payload.rows)||!Array.isArray(payload.snapshots)||payload.ids.length<1||payload.ids.length>PREPARE_PRODUCTS||payload.ids.length!==payload.rows.length||payload.ids.length!==payload.snapshots.length)return json({error:'ชุดข้อมูลสินค้า Shopee หมดอายุหรือไม่ตรงกับบัญชี'},400,headers);
    ids.push(...payload.ids);rows.push(...payload.rows);snapshots.push(...payload.snapshots);
  }
  if(ids.length!==items.length||ids.some((id,index)=>id!==items[index].id))return json({error:'รายการสินค้าที่เลือกไม่ตรงกับชุดที่ตรวจสอบ'},400,headers);
  const marks=ids.map(()=>'?').join(',');
  const current=(await ctx.env.DB.prepare(`SELECT ${fields} FROM toys_center_products WHERE store_id=? AND id IN (${marks}) LIMIT ${ids.length}`).bind(store,...ids).all()).results||[];
  const gallery=(await ctx.env.DB.prepare(`SELECT id,product_id,position,image_key FROM toys_center_product_images WHERE product_id IN (${marks}) ORDER BY product_id,position LIMIT ${ids.length*10}`).bind(...ids).all()).results||[];
  const byId=new Map(current.map(item=>[Number(item.id),item])),byGallery=new Map();
  for(const image of gallery){const id=Number(image.product_id);if(!byGallery.has(id))byGallery.set(id,[]);byGallery.get(id).push(image)}
  for(const [index,id] of ids.entries())if(!byId.has(id)||await snapshot(byId.get(id),byGallery.get(id)||[])!==snapshots[index])return json({error:'ข้อมูลสินค้ามีการเปลี่ยนแปลง กรุณาตรวจและดาวน์โหลดใหม่'},409,headers);
  try{const workbook=await makeShopeeWorkbook(source,rows);return new Response(workbook,{status:200,headers:{...headers,'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="visiond-shopee-${rows.length}-products.xlsx"`}})}
  catch(error){return json({error:error.message||'สร้าง Excel Shopee ไม่สำเร็จ'},400,headers)}
}

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const store=stockStore(ctx.request.url);if(!store)return json({error:'ร้านไม่ถูกต้อง'},400,headers);
  if(Number(ctx.request.headers.get('content-length')||0)>MAX_BATCH_REQUEST_BYTES)return json({error:'ข้อมูลส่งออก Shopee ใหญ่เกินขีดจำกัด'},413,headers);
  let form;try{form=await boundedFormData(ctx.request,MAX_BATCH_REQUEST_BYTES)}catch(error){return json({error:error.status===413?'ข้อมูลส่งออก Shopee ใหญ่เกินขีดจำกัด':'อ่านฟอร์มส่งออก Shopee ไม่สำเร็จ'},error.status===413?413:400,headers)}
  const mode=String(form?.get('mode')||'direct'),max=mode==='prepare'?PREPARE_PRODUCTS:mode==='direct'?DIRECT_PRODUCTS:MAX_PRODUCTS;
  if(!['prepare','compile','direct'].includes(mode))return json({error:'โหมดส่งออก Shopee ไม่ถูกต้อง'},400,headers);
  if(mode!=='direct'&&String(ctx.env.VISIOND_CHANNEL_ENCRYPTION_KEY||'').length<32)return json({error:'ระบบยืนยันข้อมูลส่งออก Shopee ยังไม่พร้อม'},503,headers);
  const items=parseItems(form?.get('items'),max);
  if(!items)return json({error:`เลือกสินค้า 1–${max} รายการ โดยแต่ละรายการต้องมีรหัสสินค้าที่ไม่ซ้ำ`},400,headers);
  if(mode==='prepare'){
    const result=await selectedRows(ctx,items,form.get('standard_delivery'),store.id);
    if(result.errors.length)return json({error:'ข้อมูลสินค้า Shopee ยังไม่พร้อม',errors:result.errors},422,headers);
    const payload={userId:auth.user.id,store:store.id,origin:new URL(ctx.request.url).origin,delivery:'เปิด',expires:Date.now()+CHUNK_TTL_MS,ids:items.map(item=>item.id),rows:result.rows,snapshots:result.snapshots};
    return json({chunk:await signChunk(ctx,payload)},200,headers);
  }
  const file=form.get('template');
  if(!(file instanceof File)||!file.size||file.size>2*1024*1024||!String(file.name).toLowerCase().endsWith('.xlsx'))return json({error:'เลือกไฟล์ Excel .xlsx ตัวอย่าง Shopee ไม่เกิน 2 MB'},400,headers);
  const source=new Uint8Array(await file.arrayBuffer());
  if(source[0]!==0x50||source[1]!==0x4b)return json({error:'ไฟล์ที่เลือกไม่ใช่ Excel .xlsx'},400,headers);
  if(mode==='compile')return compilePrepared(ctx,auth,form,items,source,store.id);
  const result=await selectedRows(ctx,items,form.get('standard_delivery'),store.id);
  if(result.errors.length)return json({error:'ข้อมูลสินค้า Shopee ยังไม่พร้อม',errors:result.errors},422,headers);
  try{const workbook=await makeShopeeWorkbook(source,result.rows);return new Response(workbook,{status:200,headers:{...headers,'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="visiond-shopee-${result.rows.length}-products.xlsx"`}})}
  catch(error){return json({error:error.message||'สร้าง Excel Shopee ไม่สำเร็จ'},400,headers)}
}
