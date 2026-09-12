import {sha256} from './_lib.js';

export const TOYS_LINE_URL='https://lin.ee/RJZwr1p';
export const TOYS_ORDER_HEADERS={'cache-control':'private, no-store','pragma':'no-cache'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const controls=/[\u0000-\u001f\u007f]/g;
const hasControl=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
export const orderText=(value,max)=>String(value??'').normalize('NFKC').replace(controls,' ').trim().replace(/\s+/g,' ').slice(0,max);

export function validateGuestOrder(body){
  const allowed=new Set(['product_id','quantity','client_token','customer_name','phone','shipping_address','note']);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!allowed.has(key)))return{error:'ข้อมูลคำสั่งซื้อไม่ถูกต้อง'};
  if([body.customer_name,body.phone,body.shipping_address,body.note].some(value=>hasControl.test(String(value??''))))return{error:'ข้อมูลคำสั่งซื้อมีอักขระที่ไม่รองรับ'};
  if([['customer_name',120],['phone',30],['shipping_address',1000],['note',500]].some(([key,max])=>String(body[key]??'').normalize('NFKC').length>max))return{error:'ข้อมูลคำสั่งซื้อยาวเกินกำหนด'};
  const productId=body.product_id,quantity=body.quantity,clientToken=String(body.client_token||''),customerName=orderText(body.customer_name,120),phone=orderText(body.phone,30),shippingAddress=orderText(body.shipping_address,1000),note=orderText(body.note,500),digits=phone.replace(/\D/g,''),thaiPhone=/^0\d{8,9}$/.test(digits)||/^\+66\d{8,9}$/.test(phone.replace(/[()\s-]/g,''));
  if(!Number.isSafeInteger(productId)||productId<1||!Number.isSafeInteger(quantity)||quantity<1||quantity>999||!uuid.test(clientToken))return{error:'ข้อมูลคำสั่งซื้อไม่ถูกต้อง'};
  if(customerName.length<2)return{error:'กรุณากรอกชื่อผู้รับอย่างน้อย 2 ตัวอักษร'};
  if(!thaiPhone||!/^[+()\d\s-]+$/.test(phone))return{error:'กรุณากรอกเบอร์โทรศัพท์ไทยให้ถูกต้อง'};
  if(shippingAddress.length<10)return{error:'กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน'};
  return{value:{productId,quantity,clientToken,customerName,phone,shippingAddress,note}};
}

export const guestRequestHash=value=>sha256(JSON.stringify([value.productId,value.quantity,value.customerName,value.phone,value.shippingAddress,value.note]));
export const guestTokenHash=token=>sha256(String(token));
export function privateOrderResponse(response){
  response.headers.set('cache-control','private, no-store');response.headers.set('pragma','no-cache');return response;
}
export async function rateLimitGuestOrder(env,request,{limit=6,windowMinutes=15,blockMinutes=30}={}){
  const source=String(request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim(),fingerprint=(await sha256(source)).slice(0,32),key=`toys_center_guest_order:${fingerprint}`,windowOffset=`+${windowMinutes} minutes`,blockOffset=`+${blockMinutes} minutes`;
  const row=await env.DB.prepare(`INSERT INTO security_rate_limits(rate_key,hits,window_start,blocked_until) VALUES(?,1,CURRENT_TIMESTAMP,NULL)
    ON CONFLICT(rate_key) DO UPDATE SET
      hits=CASE WHEN datetime(blocked_until)>CURRENT_TIMESTAMP THEN hits+1 WHEN datetime(window_start,?)<=CURRENT_TIMESTAMP THEN 1 ELSE hits+1 END,
      window_start=CASE WHEN datetime(blocked_until)>CURRENT_TIMESTAMP THEN window_start WHEN datetime(window_start,?)<=CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP ELSE window_start END,
      blocked_until=CASE WHEN datetime(blocked_until)>CURRENT_TIMESTAMP THEN blocked_until WHEN datetime(window_start,?)<=CURRENT_TIMESTAMP THEN NULL WHEN hits+1>? THEN datetime('now',?) ELSE blocked_until END
    RETURNING hits,blocked_until`).bind(key,windowOffset,windowOffset,windowOffset,limit,blockOffset).first();
  if(row?.blocked_until)return{error:new Response(JSON.stringify({error:'คำขอมากเกินไป ระบบพักชั่วคราว'}),{status:429,headers:{'content-type':'application/json; charset=utf-8',...TOYS_ORDER_HEADERS,'retry-after':String(blockMinutes*60)}})};
  return{ok:true};
}
export const paymentSnapshot=row=>({bank_name:row.payment_bank_name,account_name:row.payment_account_name,account_number:row.payment_account_number,qr_url:row.payment_qr_url,payment_message:row.payment_message});
export const guestReceipt=row=>({order_no:row.order_no,status:row.status,product:{title:row.product_title,slug:row.product_slug,unit_price_cents:Number(row.unit_price_cents),quantity:Number(row.quantity),total_cents:Number(row.total_cents),currency:row.currency},payment:paymentSnapshot(row),line_url:TOYS_LINE_URL});
export const orderNumber=()=>`VDT-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;

export function orderCursor(value){
  const raw=String(value||''),split=raw.lastIndexOf('|'),at=split>0?raw.slice(0,split):'',id=Number(raw.slice(split+1));
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(at)&&Number.isSafeInteger(id)&&id>0?{at,id}:null;
}
export const nextOrderCursor=row=>row?`${row.created_at}|${row.id}`:null;
