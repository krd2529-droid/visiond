import {json} from '../../../../../../_lib.js';
import {ensureDatabase} from '../../../../../../_schema.js';
import {requireVision7User} from '../../../../../../_vision7_auth.js';
import {ensureVEasyShopSchema} from '../../../../../../_veasy_shop.js';

const noStore={'cache-control':'no-store'},CANCELLABLE=['pending_payment','payment_review','cod_pending','packing'];
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const auth=await requireVision7User(ctx);if(auth.error)return auth.error;
  const order=await ctx.env.DB.prepare(`SELECT o.* FROM veasy_orders o JOIN veasy_shops s ON s.id=o.shop_id WHERE o.id=? AND o.shop_id=? AND s.user_id=?`).bind(ctx.params.orderId,ctx.params.shopId,auth.user.id).first();
  if(!order)return json({error:'ไม่พบออเดอร์ในร้านนี้',code:'VEASY_ORDER_NOT_FOUND'},404,noStore);
  if(order.status==='cancelled')return json({ok:true,idempotent:true,status:'cancelled',stock_released:Boolean(order.stock_released_at)},200,noStore);
  if(!CANCELLABLE.includes(order.status)||order.payment_status==='paid'||['shipped','delivered'].includes(order.fulfillment_status))return json({error:'ออเดอร์ที่ชำระแล้วหรือจัดส่งแล้วไม่สามารถยกเลิกด้วยปุ่มนี้',code:'VEASY_ORDER_NOT_CANCELLABLE',status:order.status,payment_status:order.payment_status,fulfillment_status:order.fulfillment_status},409,noStore);
  const reason=String((await ctx.request.json().catch(()=>({}))).reason||'เจ้าของร้านยกเลิก').trim().slice(0,300),token=crypto.randomUUID();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(`UPDATE veasy_orders SET status='cancelled',cancellation_token=?,cancelled_at=CURRENT_TIMESTAMP,cancelled_by=?,cancel_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND shop_id=? AND status IN ('pending_payment','payment_review','cod_pending','packing') AND payment_status!='paid' AND fulfillment_status NOT IN ('shipped','delivered') AND cancellation_token IS NULL`).bind(token,auth.user.id,reason,order.id,order.shop_id),
    ctx.env.DB.prepare(`UPDATE veasy_products SET stock=stock+COALESCE((SELECT SUM(i.quantity) FROM veasy_order_items i JOIN veasy_orders o ON o.id=i.order_id WHERE i.product_id=veasy_products.id AND o.id=? AND o.cancellation_token=?),0),updated_at=CURRENT_TIMESTAMP WHERE shop_id=? AND EXISTS(SELECT 1 FROM veasy_order_items i JOIN veasy_orders o ON o.id=i.order_id WHERE i.product_id=veasy_products.id AND o.id=? AND o.cancellation_token=?)`).bind(order.id,token,order.shop_id,order.id,token),
    ctx.env.DB.prepare(`UPDATE veasy_orders SET stock_released_at=CURRENT_TIMESTAMP WHERE id=? AND cancellation_token=? AND stock_released_at IS NULL`).bind(order.id,token),
    ctx.env.DB.prepare(`INSERT INTO veasy_audit_log(id,shop_id,actor_user_id,event_type,entity_type,entity_id,detail) SELECT ?,?,?,'order_cancelled','order',?,? WHERE EXISTS(SELECT 1 FROM veasy_orders WHERE id=? AND cancellation_token=?)`).bind(crypto.randomUUID(),order.shop_id,auth.user.id,order.id,JSON.stringify({previous_status:order.status,reason}),order.id,token)
  ]);
  const saved=await ctx.env.DB.prepare('SELECT status,cancelled_at,stock_released_at FROM veasy_orders WHERE id=? AND shop_id=?').bind(order.id,order.shop_id).first();
  if(saved?.status!=='cancelled')return json({error:'สถานะออเดอร์เปลี่ยนแล้ว กรุณาโหลดใหม่',code:'VEASY_ORDER_CANCEL_RACE'},409,noStore);
  return json({ok:true,idempotent:false,status:saved.status,cancelled_at:saved.cancelled_at,stock_released:Boolean(saved.stock_released_at)},200,noStore);
}
