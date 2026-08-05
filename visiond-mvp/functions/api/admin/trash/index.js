import {json,requireAdmin} from '../../../_lib.js';
import {purgeExpiredTrash,permanentlyDeleteProduct} from '../../../_trash.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);
  await purgeExpiredTrash(ctx.env);
  const products=await ctx.env.DB.prepare("SELECT id,'product' item_type,title,deleted_at,datetime(deleted_at,'+30 days') expires_at FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC").all();
  const files=await ctx.env.DB.prepare("SELECT id,item_type,title,product_id,deleted_at,expires_at FROM trash_items ORDER BY deleted_at DESC").all();
  return json({items:[...(products.results||[]),...(files.results||[])]});
}

export async function onRequestDelete(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);
  const url=new URL(ctx.request.url),type=url.searchParams.get('type'),id=Number(url.searchParams.get('id'));
  if(type==='product'){
    const product=await ctx.env.DB.prepare('SELECT * FROM products WHERE id=? AND deleted_at IS NOT NULL').bind(id).first();
    if(!product)return json({error:'ไม่พบสินค้าในถังขยะ'},404);
    await permanentlyDeleteProduct(ctx.env,product);return json({ok:true});
  }
  const item=await ctx.env.DB.prepare('SELECT * FROM trash_items WHERE id=?').bind(id).first();
  if(!item)return json({error:'ไม่พบไฟล์ในถังขยะ'},404);
  if(item.object_key)await ctx.env.FILES.delete(item.object_key);
  await ctx.env.DB.prepare('DELETE FROM trash_items WHERE id=?').bind(id).run();return json({ok:true});
}
