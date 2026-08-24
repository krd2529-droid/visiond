import {ensureSettings} from './_payment.js';

export async function loadPromotion(env){
  await ensureSettings(env);
  const {results}=await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('promotion_enabled','promotion_scope','promotion_scopes','promotion_percent')").all();
  const map=Object.fromEntries((results||[]).map(row=>[row.key,row.value]));
  const percent=Math.max(1,Math.min(90,Math.floor(Number(map.promotion_percent)||10)));
  let scopes=[];
  try{const parsed=JSON.parse(map.promotion_scopes||'[]');if(Array.isArray(parsed))scopes=parsed.map(String).filter(Boolean)}catch{}
  if(!scopes.length)scopes=[map.promotion_scope||'all'];
  scopes=[...new Set(scopes)];if(scopes.includes('all'))scopes=['all'];
  return {enabled:map.promotion_enabled==='1',scope:scopes.length===1?scopes[0]:'multiple',scopes,percent};
}

export function promotionPrice(product,promotion){
  const original=Math.max(0,Number(product?.price)||0);
  if(product?.slug==='course-selling-rights')return {...product,original_price:99900,sale_price:49900,promotion_percent:50,standalone_promotion:true};
  const scopes=Array.isArray(promotion?.scopes)&&promotion.scopes.length?promotion.scopes:[promotion?.scope||'all'];
  const eligible=promotion?.enabled&&product?.category!=='resale-rights'&&(!product?.product_kind||product.product_kind==='product')&&(scopes.includes('all')||scopes.includes(product?.category));
  if(!eligible||!original)return {...product,original_price:original,sale_price:original,promotion_percent:0};
  const sale=Math.max(1,Math.round(original*(100-promotion.percent)/100));
  return {...product,original_price:original,sale_price:sale,promotion_percent:promotion.percent};
}

export const applyPromotion=(items,promotion)=>items.map(item=>promotionPrice(item,promotion));
