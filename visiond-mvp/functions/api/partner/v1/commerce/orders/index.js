import {json} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {requirePartnerScope} from '../../../../../_partner_api.js';
import {ensurePartnerCommerceSchema} from '../../../../../_partner_commerce.js';
import {cleanId,forbiddenDataPath,idempotencyCheck,idempotencyKey,idempotencyWrite,internalPartnerId,payloadHash} from '../../../../../_partner_sync.js';

const headers={'cache-control':'no-store'};
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);await ensurePartnerCommerceSchema(ctx.env);
  const auth=await requirePartnerScope(ctx,'commerce:write');if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>null),forbidden=forbiddenDataPath(body),key=idempotencyKey(ctx.request),externalOrderId=cleanId(body?.external_order_id),externalCustomerId=cleanId(body?.external_customer_id),items=Array.isArray(body?.items)?body.items:[];
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'COMMERCE_ORDER_PAYLOAD_INVALID',request_id:auth.requestId},400,headers);
  if(forbidden)return json({error:'FORBIDDEN_SENSITIVE_FIELD',field:forbidden,request_id:auth.requestId},400,headers);
  if(!key)return json({error:'IDEMPOTENCY_KEY_REQUIRED',request_id:auth.requestId},400,headers);
  if(!externalOrderId||!externalCustomerId||!items.length||items.length>100)return json({error:'COMMERCE_ORDER_DATA_INVALID',request_id:auth.requestId},400,headers);
  const normalized=[],seen=new Set();for(let index=0;index<items.length;index++){const productId=Number(items[index]?.product_id),quantity=Number(items[index]?.quantity);if(!Number.isSafeInteger(productId)||productId<1||quantity!==1||seen.has(productId))return json({error:'COMMERCE_ORDER_ITEM_INVALID',line:index,request_id:auth.requestId},400,headers);seen.add(productId);normalized.push({productId,quantity})}
  const hash=await payloadHash({external_order_id:externalOrderId,external_customer_id:externalCustomerId,items:normalized}),prior=await idempotencyCheck(ctx.env,auth.website.id,key,hash);if(prior?.error)return prior.error;if(prior?.response)return prior.response;
  if(!await ctx.env.DB.prepare('SELECT id FROM partner_customers WHERE website_id=? AND external_customer_id=? AND status=? LIMIT 1').bind(auth.website.id,externalCustomerId,'active').first())return json({error:'CUSTOMER_NOT_SYNCED',request_id:auth.requestId},409,headers);
  if(await ctx.env.DB.prepare('SELECT id FROM partner_commerce_orders WHERE website_id=? AND external_order_id=? LIMIT 1').bind(auth.website.id,externalOrderId).first())return json({error:'EXTERNAL_ORDER_ALREADY_EXISTS',request_id:auth.requestId},409,headers);
  const placeholders=normalized.map(()=>'?').join(','),products=(await ctx.env.DB.prepare(`SELECT id,title,price FROM products WHERE id IN (${placeholders}) AND status='published' AND deleted_at IS NULL AND COALESCE(product_kind,'product')='product' AND category<>'resale-rights'`).bind(...normalized.map(item=>item.productId)).all()).results||[];
  if(products.length!==normalized.length)return json({error:'PRODUCT_NOT_AVAILABLE',request_id:auth.requestId},409,headers);
  const byId=new Map(products.map(product=>[Number(product.id),product])),lines=normalized.map((item,index)=>{const product=byId.get(item.productId),unitPrice=Number(product.price);return{index,...item,title:String(product.title||'').slice(0,200),unitPrice,lineTotal:unitPrice*item.quantity}});
  if(lines.some(line=>!Number.isSafeInteger(line.unitPrice)||line.unitPrice<0||!Number.isSafeInteger(line.lineTotal)))return json({error:'PRODUCT_PRICE_INVALID',request_id:auth.requestId},409,headers);
  const subtotal=lines.reduce((sum,line)=>sum+line.lineTotal,0),id=await internalPartnerId('pco',auth.website.id,externalOrderId),responseBody={ok:true,order:{id,external_order_id:externalOrderId,status:'pending_payment',currency:'THB',subtotal,discount:0,total:subtotal,item_count:lines.length,entitlement_ready:false},request_id:auth.requestId};
  await ctx.env.DB.batch([ctx.env.DB.prepare("INSERT INTO partner_commerce_orders(id,website_id,external_order_id,external_customer_id,status,currency,subtotal,discount,total) VALUES(?,?,?,?,?,'THB',?,0,?)").bind(id,auth.website.id,externalOrderId,externalCustomerId,'pending_payment',subtotal,subtotal),...lines.map(line=>ctx.env.DB.prepare('INSERT INTO partner_commerce_order_items(order_id,line_index,product_id,title,quantity,unit_price,line_total) VALUES(?,?,?,?,?,?,?)').bind(id,line.index,line.productId,line.title,line.quantity,line.unitPrice,line.lineTotal)),idempotencyWrite(ctx.env,{websiteId:auth.website.id,key,hash,type:'commerce_order',externalId:externalOrderId,status:201,body:responseBody})]);
  return json(responseBody,201,{...headers,'x-request-id':auth.requestId});
}
