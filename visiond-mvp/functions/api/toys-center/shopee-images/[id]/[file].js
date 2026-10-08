import {shopeeDerivativeKey} from '../../../../_toys_center_shopee_images.js';

const missing=()=>new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
async function serve(ctx,headOnly=false){
  const productId=Number(ctx.params.id),match=String(ctx.params.file||'').match(/^([1-9]\d*)\.(jpg|png)$/);
  if(!Number.isSafeInteger(productId)||productId<1||!match)return missing();
  const imageId=Number(match[1]);if(!Number.isSafeInteger(imageId))return missing();
  const row=await ctx.env.DB.prepare("SELECT i.image_key FROM toys_center_product_images i JOIN toys_center_products p ON p.id=i.product_id WHERE i.id=? AND i.product_id=? AND p.status='published'").bind(imageId,productId).first();
  if(!row)return missing();
  const original=await ctx.env.FILES.head(row.image_key);if(!original)return missing();
  const type=String(original.httpMetadata?.contentType||'').toLowerCase(),size=Number(original.size);
  if(!['image/jpeg','image/png','image/webp'].includes(type)||!Number.isSafeInteger(size)||size<1||size>5*1024*1024)return missing();
  const direct=(type==='image/jpeg'||type==='image/png')&&size>0&&size<=2*1024*1024;
  const expected=direct?(type==='image/png'?'png':'jpg'):'jpg';
  if(match[2]!==expected)return missing();
  const key=direct?row.image_key:shopeeDerivativeKey(imageId);
  const object=await ctx.env.FILES[headOnly?'head':'get'](key);
  const outputType=String(object?.httpMetadata?.contentType||'').toLowerCase();
  if(!object||outputType!==(direct?type:'image/jpeg')||Number(object.size)<1||Number(object.size)>2*1024*1024)return missing();
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','public, max-age=31536000, immutable');headers.set('etag',object.httpEtag);headers.set('x-content-type-options','nosniff');return new Response(headOnly?null:object.body,{headers});
}
export const onRequestGet=ctx=>serve(ctx);
export const onRequestHead=ctx=>serve(ctx,true);
