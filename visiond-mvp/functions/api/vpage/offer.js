import {json} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {VPAGE_CREDIT_PRICE,VPAGE_CREDIT_SLUG} from '../../_vpage.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const product=await ctx.env.DB.prepare("SELECT id,title,short_description,description FROM products WHERE slug=? AND product_kind='vpage-credit' AND status='published' AND deleted_at IS NULL LIMIT 1").bind(VPAGE_CREDIT_SLUG).first();
  if(!product)return json({error:'Vpage Credit ยังไม่พร้อมจำหน่าย'},404,{'cache-control':'public, max-age=30'});
  return json({item:{...product,slug:VPAGE_CREDIT_SLUG,price:VPAGE_CREDIT_PRICE,credits:1,service_days:30}},200,{'cache-control':'public, max-age=60, stale-while-revalidate=120'});
}
