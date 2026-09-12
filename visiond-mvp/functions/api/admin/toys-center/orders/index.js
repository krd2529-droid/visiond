import {json,requireBoss} from '../../../../_lib.js';
import {TOYS_ORDER_HEADERS,nextOrderCursor,orderCursor,privateOrderResponse} from '../../../../_toys_orders.js';

const allowedStatus=new Set(['awaiting_payment','paid','rejected']);
export async function onRequestGet(ctx){
  const auth=await requireBoss(ctx);if(auth.error)return privateOrderResponse(auth.error);
  const url=new URL(ctx.request.url),limit=Math.min(24,Math.max(1,Math.floor(Number(url.searchParams.get('limit')))||24)),rawStatus=url.searchParams.get('status')||'',rawCursor=url.searchParams.get('cursor')||'';
  if(rawStatus&&!allowedStatus.has(rawStatus))return json({error:'สถานะออเดอร์ไม่ถูกต้อง'},400,TOYS_ORDER_HEADERS);
  const status=rawStatus,after=orderCursor(rawCursor);
  if(rawCursor&&!after)return json({error:'เคอร์เซอร์ออเดอร์ไม่ถูกต้อง'},400,TOYS_ORDER_HEADERS);
  const predicates=[],bindings=[];
  if(status){predicates.push('status=?');bindings.push(status)}
  if(after){predicates.push('(created_at<? OR (created_at=? AND id<?))');bindings.push(after.at,after.at,after.id)}
  const where=predicates.length?` WHERE ${predicates.join(' AND ')}`:'';
  const rows=(await ctx.env.DB.prepare(`SELECT id,order_no,product_id,product_meta_id,product_slug,product_title,unit_price_cents,currency,quantity,total_cents,customer_name,phone,shipping_address,note,payment_bank_name,payment_account_name,payment_account_number,status,paid_at,rejected_at,created_at,updated_at FROM toys_center_orders${where} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...bindings,limit+1).all()).results||[],items=rows.slice(0,limit),last=items.at(-1);
  return json({items,pagination:{limit,has_more:rows.length>limit,next_cursor:rows.length>limit?nextOrderCursor(last):null}},200,TOYS_ORDER_HEADERS);
}
