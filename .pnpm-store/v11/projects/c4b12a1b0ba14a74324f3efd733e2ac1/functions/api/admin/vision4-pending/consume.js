import {json,requireAdmin} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),ids=[...new Set((body.ids||[]).map(Number).filter(Number.isInteger))],productId=Number(body.product_id);
  if(!ids.length||!Number.isInteger(productId))return json({error:'ข้อมูลไฟล์รวมไม่ครบ'},400);
  const product=await ctx.env.DB.prepare("SELECT id FROM products WHERE id=? AND status='published' AND deleted_at IS NULL").bind(productId).first();if(!product)return json({error:'ไม่พบสินค้าที่สร้างเสร็จ'},404);
  const marks=ids.map(()=>'?').join(','),found=await ctx.env.DB.prepare(`SELECT id FROM vision4_pending_files WHERE id IN (${marks}) AND status='waiting_bundle'`).bind(...ids).all();
  if((found.results||[]).length!==ids.length)return json({error:'มีไฟล์บางรายการถูกนำไปรวมแล้ว กรุณาโหลดใหม่'},409);
  await ctx.env.DB.prepare(`UPDATE vision4_pending_files SET status='bundled' WHERE id IN (${marks})`).bind(...ids).run();
  return json({ok:true,count:ids.length});
}
