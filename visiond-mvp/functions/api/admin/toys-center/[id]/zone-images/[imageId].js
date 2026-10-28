import {requireAdmin} from '../../../../../_lib.js';
import {scopedStockProduct} from '../../../../../_stock.js';

const missing=()=>new Response('Not found',{status:404,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  if(!await scopedStockProduct(ctx))return missing();
  const id=Number(ctx.params.imageId);if(!Number.isSafeInteger(id)||id<1)return missing();
  const row=await ctx.env.DB.prepare('SELECT image_key FROM toys_center_zone_images WHERE id=? AND product_id=?').bind(id,ctx.params.id).first();
  if(!row?.image_key)return missing();
  const object=await ctx.env.FILES.get(row.image_key);if(!object)return missing();
  const type=String(object.httpMetadata?.contentType||'');if(!type.startsWith('image/'))return missing();
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','private, no-store');headers.set('etag',object.httpEtag);headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers});
}
