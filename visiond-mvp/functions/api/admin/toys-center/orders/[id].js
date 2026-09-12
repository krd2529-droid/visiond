import {json,requireBoss} from '../../../../_lib.js';
import {TOYS_ORDER_HEADERS,privateOrderResponse} from '../../../../_toys_orders.js';

const find=(env,id)=>env.DB.prepare('SELECT id,order_no,status,quantity,product_id,stock_decremented_at FROM toys_center_orders WHERE id=?').bind(id).first();
export async function onRequestPatch(ctx){
  const auth=await requireBoss(ctx);if(auth.error)return privateOrderResponse(auth.error);
  const id=Number(ctx.params.id),body=await ctx.request.json().catch(()=>({})),action=String(body.action||'');
  if(!Number.isSafeInteger(id)||id<1||!['confirm','reject','cancel'].includes(action))return json({error:'คำสั่งจัดการออเดอร์ไม่ถูกต้อง'},400,TOYS_ORDER_HEADERS);
  let order=await find(ctx.env,id);if(!order)return json({error:'ไม่พบออเดอร์'},404,TOYS_ORDER_HEADERS);
  if(action==='reject'||action==='cancel'){
    if(order.status==='paid')return json({error:'ออเดอร์ชำระแล้ว ไม่สามารถปฏิเสธได้'},409,TOYS_ORDER_HEADERS);
    const idempotent=order.status==='rejected';
    if(order.status==='awaiting_payment')await ctx.env.DB.prepare("UPDATE toys_center_orders SET status='rejected',reviewed_by=?,rejected_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='awaiting_payment'").bind(auth.user.id,id).run();
    order=await find(ctx.env,id);return json({ok:true,idempotent,order},200,TOYS_ORDER_HEADERS);
  }
  if(order.status==='paid')return json({ok:true,idempotent:true,order},200,TOYS_ORDER_HEADERS);
  if(order.status!=='awaiting_payment')return json({error:'ออเดอร์นี้ไม่อยู่ในสถานะรอยืนยัน'},409,TOYS_ORDER_HEADERS);
  const token=crypto.randomUUID();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(`UPDATE toys_center_orders SET status='confirming',confirmation_token=?,reviewed_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='awaiting_payment' AND EXISTS(SELECT 1 FROM toys_center_products p WHERE p.id=toys_center_orders.product_id AND p.status='published' AND p.availability='in stock' AND p.quantity>=toys_center_orders.quantity)`).bind(token,auth.user.id,id),
    ctx.env.DB.prepare(`UPDATE toys_center_products SET quantity=quantity-(SELECT quantity FROM toys_center_orders WHERE id=? AND status='confirming' AND confirmation_token=?),availability=CASE WHEN quantity-(SELECT quantity FROM toys_center_orders WHERE id=? AND status='confirming' AND confirmation_token=?)=0 THEN 'out of stock' ELSE availability END,updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT product_id FROM toys_center_orders WHERE id=? AND status='confirming' AND confirmation_token=?)`).bind(id,token,id,token,id,token),
    ctx.env.DB.prepare(`UPDATE toys_center_orders SET status='paid',paid_at=CURRENT_TIMESTAMP,stock_decremented_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='confirming' AND confirmation_token=?`).bind(id,token)
  ]);
  order=await find(ctx.env,id);
  if(order.status!=='paid')return json({error:'สินค้าเหลือไม่พอ จึงยังไม่ยืนยันการชำระเงิน'},409,TOYS_ORDER_HEADERS);
  return json({ok:true,idempotent:false,order},200,TOYS_ORDER_HEADERS);
}
