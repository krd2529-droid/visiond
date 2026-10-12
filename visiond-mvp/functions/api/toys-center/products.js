import {json} from '../../_lib.js';
import {publicProduct,clean} from '../../_toys_center.js';

const encode=row=>btoa(JSON.stringify([row.updated_at,row.id]));
function decode(raw){if(!raw)return null;try{const value=JSON.parse(atob(raw));return typeof value[0]==='string'&&Number.isSafeInteger(value[1])&&value[1]>0?value:false}catch{return false}}

export async function getStockProducts(ctx,store){
  const u=new URL(ctx.request.url),slug=clean(u.searchParams.get('slug'),100),cursor=decode(u.searchParams.get('cursor'));
  if(cursor===false)return json({error:'cursor ไม่ถูกต้อง'},400);
  if(slug){
    const row=await ctx.env.DB.prepare("SELECT p.* FROM toys_center_products p WHERE p.store_id=? AND p.slug=? AND p.status='published'").bind(store,slug).first();
    if(!row)return json({error:'ไม่พบสินค้า'},404);
    const gallery=(await ctx.env.DB.prepare('SELECT id,position FROM toys_center_product_images WHERE product_id=? ORDER BY position LIMIT 10').bind(row.id).all()).results||[];
    return json({item:publicProduct(row,u.origin,{gallery})});
  }
  const limit=24,cursorSql=cursor?' AND (p.updated_at<? OR (p.updated_at=? AND p.id<?))':'';
  const [settings,count,rows]=await Promise.all([
    ctx.env.DB.prepare('SELECT storefront_mode FROM stock_store_settings WHERE store_id=?').bind(store).first(),
    ctx.env.DB.prepare("SELECT COUNT(*) total FROM toys_center_products WHERE store_id=? AND status='published'").bind(store).first(),
    ctx.env.DB.prepare(`SELECT p.*,i.id primary_image_id,i.position primary_image_position FROM toys_center_products p LEFT JOIN toys_center_product_images i ON i.id=COALESCE((SELECT selected.id FROM toys_center_product_images selected WHERE selected.product_id=p.id AND selected.image_key=p.image_1_key ORDER BY selected.position LIMIT 1),(SELECT fallback.id FROM toys_center_product_images fallback WHERE fallback.product_id=p.id AND fallback.position=0 LIMIT 1)) WHERE p.store_id=? AND p.status='published'${cursorSql} ORDER BY p.updated_at DESC,p.id DESC LIMIT ?`).bind(store,...(cursor?[cursor[0],cursor[0],cursor[1]]:[]),limit+1).all()
  ]);
  const found=rows.results||[],items=found.slice(0,limit),last=items.at(-1);
  return json({storefront_mode:settings?.storefront_mode||'unlisted',items:items.map(row=>publicProduct(row,u.origin)),pagination:{limit,total:Number(count?.total||0),next_cursor:found.length>limit&&last?encode(last):null}});
}

export async function onRequestGet(ctx){return getStockProducts(ctx,'toys-center')}
