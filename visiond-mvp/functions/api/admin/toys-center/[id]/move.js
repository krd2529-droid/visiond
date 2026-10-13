import {json,requireAdmin} from '../../../../_lib.js';
import {STOCK_STORES,stockStore} from '../../../../_stock.js';

const headers={'cache-control':'private, no-store'};

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const source=stockStore(ctx.request.url);if(!source)return json({error:'ร้านต้นทางไม่ถูกต้อง'},400,headers);
  const body=await ctx.request.json().catch(()=>({})),destinationId=body&&typeof body==='object'?body.destination_store_id:null;
  const destination=Object.hasOwn(STOCK_STORES,destinationId)?STOCK_STORES[destinationId]:null;
  if(!destination)return json({error:'ร้านปลายทางไม่ถูกต้อง'},400,headers);
  if(destination.id===source.id)return json({error:'สินค้าอยู่ในร้านนี้แล้ว'},400,headers);
  const product=await ctx.env.DB.prepare('SELECT id,meta_id,slug FROM toys_center_products WHERE id=? AND store_id=?').bind(ctx.params.id,source.id).first();
  if(!product)return json({error:'ไม่พบสินค้าในร้านต้นทาง'},404,headers);
  const [settings,identityConflict,slugConflict,activeOrder]=await Promise.all([
    ctx.env.DB.prepare('SELECT store_id FROM stock_store_settings WHERE store_id=?').bind(destination.id).first(),
    ctx.env.DB.prepare('SELECT id FROM toys_center_products WHERE meta_id=? AND id<>? LIMIT 1').bind(product.meta_id,product.id).first(),
    ctx.env.DB.prepare('SELECT id FROM toys_center_products WHERE slug=? AND id<>? LIMIT 1').bind(product.slug,product.id).first(),
    ctx.env.DB.prepare("SELECT id FROM toys_center_orders WHERE product_id=? AND status IN ('awaiting_payment','confirming') LIMIT 1").bind(product.id).first()
  ]);
  if(!settings)return json({error:'ยังไม่ได้ตั้งค่าร้านปลายทาง'},400,headers);
  if(identityConflict||slugConflict)return json({error:'ID / SKU หรือ slug ซ้ำกับสินค้าอื่น'},409,headers);
  if(activeOrder)return json({error:'ย้ายไม่ได้ เพราะสินค้านี้มีออเดอร์ที่รอยืนยัน'},409,headers);
  try{
    const result=await ctx.env.DB.prepare("UPDATE toys_center_products SET store_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND store_id=? AND NOT EXISTS(SELECT 1 FROM toys_center_orders WHERE product_id=? AND status IN ('awaiting_payment','confirming'))").bind(destination.id,product.id,source.id,product.id).run();
    if(!Number(result.meta?.changes))return json({error:'ย้ายไม่ได้ สถานะสินค้าหรือออเดอร์เปลี่ยนแล้ว กรุณารีเฟรช'},409,headers);
  }catch(error){
    if(/unique|constraint/i.test(String(error)))return json({error:'ID / SKU หรือ slug ซ้ำกับสินค้าอื่น'},409,headers);
    throw error;
  }
  return json({ok:true,id:product.id,from_store:source.id,to_store:destination.id,message:`ย้ายสินค้าไป ${destination.name} แล้ว`},200,headers);
}
