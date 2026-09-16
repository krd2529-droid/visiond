import {json,requireAdmin} from '../../../../_lib.js';
import {buildShopeeHandoff} from '../../../../_toys_center_shopee.js';

const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const id=Number(ctx.params.id);if(!Number.isSafeInteger(id)||id<1)return json({error:'ไม่พบสินค้า'},404,headers);
  const product=await ctx.env.DB.prepare('SELECT id,meta_id,title,gtin,brand,description,price_cents,currency,quantity,status,image_1_key,shopee_weight_g,shopee_package_width_mm,shopee_package_length_mm,shopee_package_height_mm FROM toys_center_products WHERE id=?').bind(id).first();
  if(!product)return json({error:'ไม่พบสินค้า'},404,headers);
  const rows=(await ctx.env.DB.prepare('SELECT id,position,image_key FROM toys_center_product_images WHERE product_id=? ORDER BY position LIMIT 10').bind(id).all()).results||[];
  const checked=await Promise.allSettled(rows.map(async row=>{const object=await ctx.env.FILES?.head(row.image_key);return object&&String(object.httpMetadata?.contentType||'').startsWith('image/')?row:null})),gallery=checked.flatMap(result=>result.status==='fulfilled'&&result.value?[result.value]:[]);
  const selectedExists=rows.some(row=>row.image_key===product.image_1_key),legacyFallback=rows.find(row=>Number(row.position)===0)||rows[0],handoffProduct=!selectedExists&&legacyFallback?{...product,image_1_key:legacyFallback.image_key}:product;
  return json(buildShopeeHandoff(handoffProduct,gallery,new URL(ctx.request.url).origin),200,headers);
}
