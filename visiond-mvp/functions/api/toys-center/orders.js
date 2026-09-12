import {json} from '../../_lib.js';
import {loadExistingPaymentSettings,publicPaymentSettings} from '../../_payment.js';
import {TOYS_ORDER_HEADERS,guestReceipt,guestRequestHash,guestTokenHash,orderNumber,rateLimitGuestOrder,validateGuestOrder} from '../../_toys_orders.js';

const selectByToken=env=>env.DB.prepare('SELECT * FROM toys_center_orders WHERE client_token_hash=?');
export async function onRequestPost(ctx){
  if(!/^application\/json(?:;|$)/i.test(ctx.request.headers.get('content-type')||''))return json({error:'กรุณาส่งข้อมูลคำสั่งซื้อแบบ JSON'},415,TOYS_ORDER_HEADERS);
  const length=Number(ctx.request.headers.get('content-length')||0);
  if(length>16384)return json({error:'ข้อมูลคำสั่งซื้อยาวเกินกำหนด'},413,TOYS_ORDER_HEADERS);
  const raw=await ctx.request.text();
  if(new TextEncoder().encode(raw).byteLength>16384)return json({error:'ข้อมูลคำสั่งซื้อยาวเกินกำหนด'},413,TOYS_ORDER_HEADERS);
  const limited=await rateLimitGuestOrder(ctx.env,ctx.request);
  if(limited.error)return limited.error;
  const body=(()=>{try{return JSON.parse(raw)}catch{return null}})(),checked=validateGuestOrder(body);
  if(checked.error)return json({error:checked.error},400,TOYS_ORDER_HEADERS);
  const value=checked.value,[requestHash,tokenHash]=await Promise.all([guestRequestHash(value),guestTokenHash(value.clientToken)]),existing=await selectByToken(ctx.env).bind(tokenHash).first();
  if(existing)return existing.request_hash===requestHash?json({ok:true,idempotent:true,order:guestReceipt(existing)},200,TOYS_ORDER_HEADERS):json({error:'รหัสคำสั่งซื้อนี้ถูกใช้กับข้อมูลอื่นแล้ว'},409,TOYS_ORDER_HEADERS);
  const product=await ctx.env.DB.prepare("SELECT id,meta_id,slug,title,price_cents,currency,availability,quantity FROM toys_center_products WHERE id=? AND status='published'").bind(value.productId).first();
  if(!product)return json({error:'ไม่พบสินค้าที่ต้องการสั่งซื้อ'},404,TOYS_ORDER_HEADERS);
  if(product.availability!=='in stock'||Number(product.quantity)<value.quantity)return json({error:'สินค้าเหลือไม่พอ กรุณาเลือกจำนวนใหม่'},409,TOYS_ORDER_HEADERS);
  const payment=await loadExistingPaymentSettings(ctx.env);
  if(!payment.accepting_orders)return json({error:'ขณะนี้ VisionD พักรับคำสั่งซื้อชั่วคราว'},409,TOYS_ORDER_HEADERS);
  const paymentPublic=publicPaymentSettings(payment),total=Number(product.price_cents)*value.quantity;
  let inserted=false;
  try{
    await ctx.env.DB.prepare(`INSERT INTO toys_center_orders(order_no,client_token_hash,request_hash,product_id,product_meta_id,product_slug,product_title,unit_price_cents,currency,quantity,total_cents,customer_name,phone,shipping_address,note,payment_bank_name,payment_account_name,payment_account_number,payment_qr_url,payment_message) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(orderNumber(),tokenHash,requestHash,product.id,product.meta_id,product.slug,product.title,product.price_cents,product.currency,value.quantity,total,value.customerName,value.phone,value.shippingAddress,value.note,paymentPublic.bank_name,paymentPublic.account_name,paymentPublic.account_number,paymentPublic.qr_url,paymentPublic.payment_message).run();
    inserted=true;
  }catch(error){
    if(!/unique/i.test(String(error)))throw error;
  }
  const order=await selectByToken(ctx.env).bind(tokenHash).first();
  if(!order)return json({error:'ยังสร้างคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่'},503,TOYS_ORDER_HEADERS);
  if(order.request_hash!==requestHash)return json({error:'รหัสคำสั่งซื้อนี้ถูกใช้กับข้อมูลอื่นแล้ว'},409,TOYS_ORDER_HEADERS);
  return json({ok:true,idempotent:!inserted,order:guestReceipt(order)},inserted?201:200,TOYS_ORDER_HEADERS);
}

const unsupported=method=>method==='HEAD'?new Response(null,{status:405,headers:{...TOYS_ORDER_HEADERS,allow:'POST'}}):json({error:'รองรับเฉพาะการสร้างออเดอร์ด้วย POST'},405,{...TOYS_ORDER_HEADERS,allow:'POST'});
export const onRequestGet=()=>unsupported('GET');
export const onRequestHead=()=>unsupported('HEAD');
export const onRequestPut=()=>unsupported('PUT');
export const onRequestPatch=()=>unsupported('PATCH');
export const onRequestDelete=()=>unsupported('DELETE');
