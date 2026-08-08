import {ensureSettings} from './_payment.js';

export async function loadPromotion(env){
  await ensureSettings(env);
  const {results}=await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('promotion_enabled','promotion_scope','promotion_percent')").all();
  const map=Object.fromEntries((results||[]).map(row=>[row.key,row.value]));
  const percent=Math.max(1,Math.min(90,Math.floor(Number(map.promotion_percent)||10)));
  return {enabled:map.promotion_enabled==='1',scope:map.promotion_scope||'all',percent};
}

export function promotionPrice(product,promotion){
  const original=Math.max(0,Number(product?.price)||0);
  const eligible=promotion?.enabled&&(!product?.product_kind||product.product_kind==='product')&&(promotion.scope==='all'||promotion.scope===product?.category);
  if(!eligible||!original)return {...product,original_price:original,sale_price:original,promotion_percent:0};
  const sale=Math.max(1,Math.round(original*(100-promotion.percent)/100));
  return {...product,original_price:original,sale_price:sale,promotion_percent:promotion.percent};
}

export const applyPromotion=(items,promotion)=>items.map(item=>promotionPrice(item,promotion));
