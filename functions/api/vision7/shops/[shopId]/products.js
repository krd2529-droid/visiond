import {json} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {requireVision7User} from '../../../../_vision7_auth.js';
import {cleanCatalogSlug,cleanCatalogText,ensureVEasyShopSchema} from '../../../../_veasy_shop.js';

const noStore={'cache-control':'no-store'};
const ownedShop=(env,shopId,userId)=>env.DB.prepare("SELECT id,name,plan_limit FROM veasy_shops WHERE id=? AND user_id=? AND status='active'").bind(shopId,userId).first();

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);
  const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const shop=await ownedShop(ctx.env,ctx.params.shopId,auth.user.id);
  if(!shop)return json({error:'ไม่พบร้านที่เป็นเจ้าของ',code:'VEASY_SHOP_NOT_OWNED'},404,noStore);
  const rows=await ctx.env.DB.prepare(`SELECT p.id,p.sku,p.slug,p.name,c.name category,p.short_description shortDescription,p.description,p.specifications,p.warranty,p.shipping_detail shippingDetail,p.price,p.stock,p.status,p.created_at createdAt FROM veasy_products p JOIN veasy_categories c ON c.id=p.category_id AND c.shop_id=p.shop_id WHERE p.shop_id=? AND p.status!='hidden' ORDER BY p.created_at DESC`).bind(shop.id).all();
  return json({items:(rows.results||[]).map(item=>({...item,coverImageUrl:item.coverImageUrl||`/api/vision7/product-images/${encodeURIComponent(item.id)}`})),plan_limit:shop.plan_limit},200,noStore);
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);
  const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const shop=await ownedShop(ctx.env,ctx.params.shopId,auth.user.id);
  if(!shop)return json({error:'ไม่พบร้านที่เป็นเจ้าของ',code:'VEASY_SHOP_NOT_OWNED'},404,noStore);
  const body=await ctx.request.json().catch(()=>({}));
  const idempotencyKey=cleanCatalogText(ctx.request.headers.get('idempotency-key')||body.idempotency_key,100);
  const name=cleanCatalogText(body.name,120),category=cleanCatalogText(body.category,80),sku=cleanCatalogText(body.sku,80).toUpperCase();
  const price=Number(body.price),stock=Number(body.stock),categorySlug=cleanCatalogSlug(body.category_slug||category),productSlug=cleanCatalogSlug(body.slug||`${name}-${sku}`);
  if(idempotencyKey.length<12||!name||!category||!sku||!categorySlug||!productSlug||!Number.isInteger(price)||price<0||!Number.isInteger(stock)||stock<0)return json({error:'ข้อมูลสินค้าไม่ครบหรือไม่ถูกต้อง',code:'VEASY_PRODUCT_INVALID'},400,noStore);
  const duplicate=await ctx.env.DB.prepare('SELECT id,sku,slug,name,price,stock,status FROM veasy_products WHERE shop_id=? AND idempotency_key=?').bind(shop.id,idempotencyKey).first();
  if(duplicate)return json({ok:true,duplicate:true,item:duplicate,plan_limit:shop.plan_limit},200,noStore);
  const count=await ctx.env.DB.prepare("SELECT COUNT(*) total FROM veasy_products WHERE shop_id=? AND status!='hidden'").bind(shop.id).first();
  if(Number(count?.total)>=shop.plan_limit)return json({error:`แพ็กเกจนี้เพิ่มสินค้าได้สูงสุด ${shop.plan_limit} รายการ`,code:'VEASY_PLAN_LIMIT'},409,noStore);
  const categoryId=crypto.randomUUID(),productId=crypto.randomUUID();
  try{
    await ctx.env.DB.batch([
      ctx.env.DB.prepare(`INSERT INTO veasy_categories(id,shop_id,name,slug) VALUES(?,?,?,?) ON CONFLICT(shop_id,slug) DO UPDATE SET name=excluded.name,updated_at=CURRENT_TIMESTAMP`).bind(categoryId,shop.id,category,categorySlug),
      ctx.env.DB.prepare(`INSERT INTO veasy_products(id,shop_id,category_id,idempotency_key,sku,slug,name,short_description,description,specifications,warranty,shipping_detail,price,stock) SELECT ?,?,id,?,?,?,?,?,?,?,?,?,?,? FROM veasy_categories WHERE shop_id=? AND slug=?`).bind(productId,shop.id,idempotencyKey,sku,productSlug,name,cleanCatalogText(body.shortDescription,180),cleanCatalogText(body.description,2000),cleanCatalogText(body.specifications,1000),cleanCatalogText(body.warranty,300),cleanCatalogText(body.shippingDetail,500),price,stock,shop.id,categorySlug)
    ]);
  }catch{
    const retried=await ctx.env.DB.prepare('SELECT id,sku,slug,name,price,stock,status FROM veasy_products WHERE shop_id=? AND idempotency_key=?').bind(shop.id,idempotencyKey).first();
    if(retried)return json({ok:true,duplicate:true,item:retried,plan_limit:shop.plan_limit},200,noStore);
    return json({error:'SKU หรือชื่อ URL ซ้ำกับสินค้าในร้าน',code:'VEASY_PRODUCT_CONFLICT'},409,noStore);
  }
  const item=await ctx.env.DB.prepare(`SELECT p.id,p.sku,p.slug,p.name,c.name category,p.short_description shortDescription,p.description,p.specifications,p.warranty,p.shipping_detail shippingDetail,p.price,p.stock,p.status,p.created_at createdAt FROM veasy_products p JOIN veasy_categories c ON c.id=p.category_id WHERE p.id=? AND p.shop_id=?`).bind(productId,shop.id).first();
  return json({ok:true,duplicate:false,item,plan_limit:shop.plan_limit},201,noStore);
}
