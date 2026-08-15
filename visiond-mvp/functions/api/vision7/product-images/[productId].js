import {ensureDatabase} from '../../../_schema.js';
import {ensureVEasyShopSchema} from '../../../_veasy_shop.js';
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);await ensureVEasyShopSchema(ctx.env);const row=await ctx.env.DB.prepare("SELECT cover_image_key FROM veasy_products WHERE id=? AND status='active'").bind(ctx.params.productId).first();
  if(!row?.cover_image_key||!ctx.env.FILES)return new Response('Not found',{status:404});const object=await ctx.env.FILES.get(row.cover_image_key);if(!object)return new Response('Not found',{status:404});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','public, max-age=86400');headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers});
}
