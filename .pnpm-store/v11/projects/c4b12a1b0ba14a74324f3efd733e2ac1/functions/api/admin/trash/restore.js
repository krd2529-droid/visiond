import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestPost(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);
  const body=await ctx.request.json().catch(()=>({})),type=String(body.type||''),id=Number(body.id);
  if(type==='product'){
    const result=await ctx.env.DB.prepare("UPDATE products SET deleted_at=NULL,status=COALESCE(deleted_prev_status,'published'),deleted_prev_status=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NOT NULL").bind(id).run();
    return result.meta?.changes?json({ok:true}):json({error:'ไม่พบสินค้าในถังขยะ'},404);
  }
  const item=await ctx.env.DB.prepare('SELECT * FROM trash_items WHERE id=?').bind(id).first();
  if(!item)return json({error:'ไม่พบไฟล์ในถังขยะ'},404);
  const payload=JSON.parse(item.payload||'{}'),product=await ctx.env.DB.prepare('SELECT * FROM products WHERE id=?').bind(item.product_id).first();
  if(!product)return json({error:'ต้องกู้คืนตะกร้าสินค้าก่อน จึงจะกู้ไฟล์ได้'},409);
  if(item.item_type==='product_file'){
    const existing=await ctx.env.DB.prepare('SELECT id FROM product_files WHERE product_id=? LIMIT 1').bind(item.product_id).first();
    if(existing)return json({error:'สินค้านี้มีไฟล์อยู่แล้ว กรุณาลบไฟล์ปัจจุบันก่อนกู้คืนไฟล์นี้'},409);
    await ctx.env.DB.prepare('INSERT INTO product_files(product_id,label,object_key,mime_type,file_size,version) VALUES(?,?,?,?,?,?)').bind(item.product_id,payload.label||'ไฟล์สินค้าฉบับเต็ม',item.object_key,payload.mime_type||'application/pdf',Number(payload.file_size)||0,payload.version||'1.0').run();
  }else if(item.item_type==='product_image'){
    let previews=[];try{previews=JSON.parse(product.preview_urls||'[]')}catch{}
    const images=[product.cover_url,previews[1],previews[2]],slot=Math.max(0,Math.min(2,Number(payload.slot)||0)),url='/api/media/'+item.object_key;
    if(images[slot]?.startsWith('/api/media/'))return json({error:`ช่องรูปที่ ${slot+1} มีรูปอยู่แล้ว กรุณาลบรูปปัจจุบันก่อนกู้คืน`},409);
    images[slot]=url;await ctx.env.DB.prepare('UPDATE products SET cover_url=?,preview_urls=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(images[0]||'/assets/product-placeholder.svg',JSON.stringify(images),item.product_id).run();
  }
  await ctx.env.DB.prepare('DELETE FROM trash_items WHERE id=?').bind(id).run();return json({ok:true});
}
