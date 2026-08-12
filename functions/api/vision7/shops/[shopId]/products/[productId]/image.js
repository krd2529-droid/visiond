import {json} from '../../../../../../_lib.js';
import {ensureDatabase} from '../../../../../../_schema.js';
import {requireVision7User} from '../../../../../../_vision7_auth.js';
import {ensureVEasyShopSchema} from '../../../../../../_veasy_shop.js';
const noStore={'cache-control':'no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  if(!ctx.env.FILES)return json({error:'ที่เก็บรูปสินค้ายังไม่พร้อม',code:'VEASY_FILES_UNAVAILABLE'},503,noStore);
  const product=await ctx.env.DB.prepare(`SELECT p.id,p.cover_image_key FROM veasy_products p JOIN veasy_shops s ON s.id=p.shop_id WHERE p.id=? AND p.shop_id=? AND s.user_id=?`).bind(ctx.params.productId,ctx.params.shopId,auth.user.id).first();
  if(!product)return json({error:'ไม่พบสินค้าในร้านนี้',code:'VEASY_PRODUCT_NOT_FOUND'},404,noStore);
  const form=await ctx.request.formData().catch(()=>null),image=form?.get('image');
  if(!(image instanceof File)||!['image/jpeg','image/png','image/webp'].includes(image.type)||image.size<1||image.size>5*1024*1024)return json({error:'รองรับ JPG, PNG หรือ WEBP ไม่เกิน 5 MB',code:'VEASY_IMAGE_INVALID'},400,noStore);
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[image.type],key=`veasy/products/${product.id}/${crypto.randomUUID()}.${ext}`;
  await ctx.env.FILES.put(key,await image.arrayBuffer(),{httpMetadata:{contentType:image.type,cacheControl:'public, max-age=31536000, immutable'}});
  await ctx.env.DB.prepare('UPDATE veasy_products SET cover_image_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?').bind(key,product.id,ctx.params.shopId).run();
  if(product.cover_image_key)await ctx.env.FILES.delete(product.cover_image_key).catch(()=>{});
  return json({ok:true,coverImageUrl:`/api/vision7/product-images/${encodeURIComponent(product.id)}`},200,noStore);
}
