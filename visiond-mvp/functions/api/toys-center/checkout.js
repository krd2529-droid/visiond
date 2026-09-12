import {json} from '../../_lib.js';
import {loadExistingPaymentSettings,publicPaymentSettings} from '../../_payment.js';
import {TOYS_LINE_URL,TOYS_ORDER_HEADERS} from '../../_toys_orders.js';

export async function onRequestGet(ctx){
  const productId=Number(new URL(ctx.request.url).searchParams.get('product_id'));
  if(!Number.isSafeInteger(productId)||productId<1)return json({error:'ไม่พบสินค้าที่ต้องการสั่งซื้อ'},404,TOYS_ORDER_HEADERS);
  const product=await ctx.env.DB.prepare("SELECT id,meta_id,slug,title,price_cents,currency,availability,quantity FROM toys_center_products WHERE id=? AND status='published'").bind(productId).first();
  if(!product)return json({error:'ไม่พบสินค้าที่ต้องการสั่งซื้อ'},404,TOYS_ORDER_HEADERS);
  const payment=await loadExistingPaymentSettings(ctx.env);
  return json({product:{id:product.id,meta_id:product.meta_id,slug:product.slug,title:product.title,unit_price_cents:Number(product.price_cents),currency:product.currency,availability:product.availability,quantity:Number(product.quantity)},payment:publicPaymentSettings(payment),line_url:TOYS_LINE_URL},200,TOYS_ORDER_HEADERS);
}

const unsupported=method=>method==='HEAD'?new Response(null,{status:405,headers:{...TOYS_ORDER_HEADERS,allow:'GET'}}):json({error:'รองรับเฉพาะการอ่านข้อมูลชำระเงินด้วย GET'},405,{...TOYS_ORDER_HEADERS,allow:'GET'});
export const onRequestPost=()=>unsupported('POST');
export const onRequestHead=()=>unsupported('HEAD');
export const onRequestPut=()=>unsupported('PUT');
export const onRequestPatch=()=>unsupported('PATCH');
export const onRequestDelete=()=>unsupported('DELETE');
