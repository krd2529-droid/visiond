import {json} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {requireVision7User} from '../../../../../_vision7_auth.js';
import {cleanCatalogSlug,cleanCatalogText,ensureVEasyShopSchema} from '../../../../../_veasy_shop.js';

const noStore={'cache-control':'no-store'};
const owned=(env,shopId,productId,userId)=>env.DB.prepare(`SELECT p.*,c.name category FROM veasy_products p JOIN veasy_categories c ON c.id=p.category_id JOIN veasy_shops s ON s.id=p.shop_id WHERE p.id=? AND p.shop_id=? AND s.user_id=?`).bind(productId,shopId,userId).first();

export async function onRequestPatch(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const current=await owned(ctx.env,ctx.params.shopId,ctx.params.productId,auth.user.id);if(!current)return json({error:'ไม่พบสินค้าในร้านนี้',code:'VEASY_PRODUCT_NOT_FOUND'},404,noStore);
  const body=await ctx.request.json().catch(()=>({})),name=cleanCatalogText(body.name??current.name,120),category=cleanCatalogText(body.category??current.category,80),sku=cleanCatalogText(body.sku??current.sku,80).toUpperCase();
  const price=Number(body.price??current.price),stock=Number(body.stock??current.stock),status=['draft','active','hidden'].includes(body.status)?body.status:current.status,categorySlug=cleanCatalogSlug(body.category_slug||category),slug=cleanCatalogSlug(body.slug||current.slug);
  if(!name||!category||!sku||!slug||!categorySlug||!Number.isInteger(price)||price<0||!Number.isInteger(stock)||stock<0)return json({error:'ข้อมูลสินค้าไม่ครบหรือไม่ถูกต้อง',code:'VEASY_PRODUCT_INVALID'},400,noStore);
  const categoryId=crypto.randomUUID();
  try{await ctx.env.DB.batch([
    ctx.env.DB.prepare(`INSERT INTO veasy_categories(id,shop_id,name,slug) VALUES(?,?,?,?) ON CONFLICT(shop_id,slug) DO UPDATE SET name=excluded.name,updated_at=CURRENT_TIMESTAMP`).bind(categoryId,current.shop_id,category,categorySlug),
    ctx.env.DB.prepare(`UPDATE veasy_products SET category_id=(SELECT id FROM veasy_categories WHERE shop_id=? AND slug=?),sku=?,slug=?,name=?,short_description=?,description=?,specifications=?,warranty=?,shipping_detail=?,price=?,stock=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?`).bind(current.shop_id,categorySlug,sku,slug,name,cleanCatalogText(body.shortDescription??current.short_description,180),cleanCatalogText(body.description??current.description,2000),cleanCatalogText(body.specifications??current.specifications,1000),cleanCatalogText(body.warranty??current.warranty,300),cleanCatalogText(body.shippingDetail??current.shipping_detail,500),price,stock,status,current.id,current.shop_id),
    ctx.env.DB.prepare(`INSERT INTO veasy_audit_log(id,shop_id,actor_user_id,event_type,entity_type,entity_id,detail) VALUES(?,?,?,'product_updated','product',?,?)`).bind(crypto.randomUUID(),current.shop_id,auth.user.id,current.id,JSON.stringify({sku,status}))
  ])}catch{return json({error:'SKU หรือชื่อ URL ซ้ำกับสินค้าในร้าน',code:'VEASY_PRODUCT_CONFLICT'},409,noStore)}
  return json({ok:true,item:await owned(ctx.env,current.shop_id,current.id,auth.user.id)},200,noStore);
}
export const onRequestPut=onRequestPatch;

export async function onRequestDelete(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const current=await owned(ctx.env,ctx.params.shopId,ctx.params.productId,auth.user.id);if(!current)return json({error:'ไม่พบสินค้าในร้านนี้',code:'VEASY_PRODUCT_NOT_FOUND'},404,noStore);
  const history=await ctx.env.DB.prepare('SELECT 1 found FROM veasy_order_items WHERE product_id=? LIMIT 1').bind(current.id).first();
  if(history){await ctx.env.DB.batch([ctx.env.DB.prepare("UPDATE veasy_products SET status='hidden',updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=?").bind(current.id,current.shop_id),ctx.env.DB.prepare(`INSERT INTO veasy_audit_log(id,shop_id,actor_user_id,event_type,entity_type,entity_id,detail) VALUES(?,?,?,'product_hidden_with_history','product',?,'{}')`).bind(crypto.randomUUID(),current.shop_id,auth.user.id,current.id)]);return json({ok:true,deleted:false,hidden:true,reason:'ORDER_HISTORY_PRESERVED'},200,noStore)}
  await ctx.env.DB.batch([ctx.env.DB.prepare('DELETE FROM veasy_products WHERE id=? AND shop_id=? AND NOT EXISTS(SELECT 1 FROM veasy_order_items WHERE product_id=?)').bind(current.id,current.shop_id,current.id),ctx.env.DB.prepare(`INSERT INTO veasy_audit_log(id,shop_id,actor_user_id,event_type,entity_type,entity_id,detail) VALUES(?,?,?,'product_deleted','product',?,'{}')`).bind(crypto.randomUUID(),current.shop_id,auth.user.id,current.id)]);
  return json({ok:true,deleted:true,hidden:false},200,noStore);
}
