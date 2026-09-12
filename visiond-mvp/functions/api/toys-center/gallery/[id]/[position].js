const missing=()=>new Response('Not found',{status:404,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function onRequestGet(ctx){
  const position=Number(ctx.params.position),version=Number(new URL(ctx.request.url).searchParams.get('v'));
  if(!Number.isInteger(position)||position<0||position>9||!Number.isSafeInteger(version)||version<1)return missing();
  const row=await ctx.env.DB.prepare("SELECT i.image_key FROM toys_center_product_images i JOIN toys_center_products p ON p.id=i.product_id WHERE i.id=? AND i.product_id=? AND i.position=? AND p.status='published'").bind(version,ctx.params.id,position).first();
  if(!row?.image_key)return missing();
  const object=await ctx.env.FILES.get(row.image_key);if(!object)return missing();const type=String(object.httpMetadata?.contentType||'');if(!type.startsWith('image/'))return missing();
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('cache-control','public, max-age=31536000, immutable');headers.set('etag',object.httpEtag);headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers});
}
