import {json,requireAdmin} from '../../../../_lib.js';
import {buildThaiMartHandoff,THAIMART_IMAGE_TYPES,THAIMART_MAX_IMAGE_BYTES} from '../../../../_toys_center_thaimart.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const id=Number(ctx.params.id);if(!Number.isSafeInteger(id)||id<1)return json({error:'ไม่พบสินค้า'},404,headers);
  const product=await ctx.env.DB.prepare('SELECT id,meta_id,title,description,price_cents,currency,quantity,status,image_1_key,shopee_weight_g,shopee_package_width_mm,shopee_package_length_mm,shopee_package_height_mm FROM toys_center_products WHERE id=?').bind(id).first();
  if(!product)return json({error:'ไม่พบสินค้า'},404,headers);
  const rows=(await ctx.env.DB.prepare('SELECT id,position,image_key FROM toys_center_product_images WHERE product_id=? ORDER BY position LIMIT 10').bind(id).all()).results||[];
  const checked=await Promise.allSettled(rows.map(async row=>{const object=await ctx.env.FILES?.head(row.image_key),type=String(object?.httpMetadata?.contentType||'').split(';')[0].trim().toLowerCase(),size=Number(object?.size);return object&&THAIMART_IMAGE_TYPES.has(type)&&Number.isSafeInteger(size)&&size>0&&size<=THAIMART_MAX_IMAGE_BYTES?row:null}));
  const gallery=checked.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value]:[]),invalidImageCount=rows.length-gallery.length;
  return json(buildThaiMartHandoff(product,gallery,new URL(ctx.request.url).origin,{sourceImageCount:rows.length,invalidImageCount}),200,headers);
}
