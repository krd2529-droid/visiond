import {json} from '../../../../../../_lib.js';
import {ensureDatabase} from '../../../../../../_schema.js';
import {requireVision7User} from '../../../../../../_vision7_auth.js';
import {ensureVEasyShopSchema} from '../../../../../../_veasy_shop.js';
const noStore={'cache-control':'no-store'},accepted=new Set(['image/jpeg','image/png','image/webp']);
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const product=await ctx.env.DB.prepare("SELECT p.id,p.cover_image_key oldKey FROM veasy_products p JOIN veasy_shops s ON s.id=p.shop_id WHERE p.id=? AND p.shop_id=? AND s.user_id=? AND s.status='active'").bind(ctx.params.productId,ctx.params.shopId,auth.user.id).first();
  if(!product)return json({error:'ไม่พบสินค้าที่เป็นเจ้าของ'},404,noStore);if(!ctx.env.FILES)return json({error:'ระบบเก็บรูปยังไม่พร้อม'},503,noStore);
  const form=await ctx.request.formData(),file=form.get('image');if(!(file instanceof File)||!accepted.has(file.type)||file.size<1||file.size>5*1024*1024)return json({error:'รองรับ JPG, PNG, WEBP ขนาดไม่เกิน 5 MB'},400,noStore);
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg',key=`veasy/products/${ctx.params.shopId}/${product.id}/${crypto.randomUUID()}.${ext}`;
  await ctx.env.FILES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=31536000, immutable'}});
  await ctx.env.DB.prepare('UPDATE veasy_products SET cover_image_key=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?').bind(key,product.id,ctx.params.shopId).run();
  if(product.oldKey&&product.oldKey!==key)await ctx.env.FILES.delete(product.oldKey).catch(()=>{});
  return json({ok:true,coverImageUrl:`/api/vision7/product-images/${product.id}`},201,noStore);
}
