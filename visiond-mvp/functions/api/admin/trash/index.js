import {json,requireAdmin,requireBoss} from '../../../_lib.js';
import {permanentlyDeleteProduct,permanentlyDeleteTrashItem} from '../../../_trash.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);
  const params=new URL(ctx.request.url).searchParams,limit=Math.min(24,Math.max(1,Number(params.get('limit'))||24)),raw=String(params.get('cursor')||''),parts=raw.split('|'),after=parts.length===3?{at:parts[0],type:parts[1],id:Number(parts[2])}:null,where=[],bindings=[];if(after){where.push('(deleted_at<? OR (deleted_at=? AND (item_type<? OR (item_type=? AND id<?))))');bindings.push(after.at,after.at,after.type,after.type,after.id)}
  const rows=(await ctx.env.DB.prepare(`SELECT * FROM (SELECT id,'product' item_type,title,NULL product_id,deleted_at,datetime(deleted_at,'+30 days') expires_at FROM products WHERE deleted_at IS NOT NULL UNION ALL SELECT id,item_type,title,product_id,deleted_at,expires_at FROM trash_items) trash ${where.length?'WHERE '+where.join(' AND '):''} ORDER BY deleted_at DESC,item_type DESC,id DESC LIMIT ?`).bind(...bindings,limit+1).all()).results||[],items=rows.slice(0,limit),last=items.at(-1);
  return json({items,pagination:{limit,has_more:rows.length>limit,next_cursor:rows.length>limit&&last?`${last.deleted_at}|${last.item_type}|${last.id}`:null}},200,{'cache-control':'private, no-store'});
}

export async function onRequestDelete(ctx){
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  await ensureDatabase(ctx.env);
  const url=new URL(ctx.request.url),type=url.searchParams.get('type'),id=Number(url.searchParams.get('id'));
  if(type==='product'){
    const product=await ctx.env.DB.prepare('SELECT * FROM products WHERE id=? AND deleted_at IS NOT NULL').bind(id).first();
    if(!product)return json({error:'ไม่พบสินค้าในถังขยะ'},404);
    const result=await permanentlyDeleteProduct(ctx.env,product);if(result?.preserved_service)return json({error:'รายการบริการไม่อยู่ในขอบเขตล้างสินค้าไฟล์ดิจิทัล'},409);if(result?.preserved_bundle)return json({error:'สินค้านี้ยังเป็นส่วนประกอบของตะกร้ารวมที่ใช้งานอยู่ จึงยังลบถาวรไม่ได้'},409);if(result?.preserved_purchase)return json({error:'สินค้านี้มีสิทธิ์ผู้ซื้ออยู่ จึงเก็บเป็นรายการซ่อนเพื่อรักษาไฟล์ดาวน์โหลด'},409);return json({ok:true});
  }
  const item=await ctx.env.DB.prepare('SELECT * FROM trash_items WHERE id=?').bind(id).first();
  if(!item)return json({error:'ไม่พบไฟล์ในถังขยะ'},404);
  const result=await permanentlyDeleteTrashItem(ctx.env,item);if(result.preserved_reference)return json({error:'ไฟล์รูปนี้ยังถูกสินค้าอื่นใช้งานอยู่ จึงยังลบถาวรไม่ได้'},409);return json({ok:true});
}
