import {json} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

// Resolve old cart lines that predate vbot_app_code without scanning the catalog.
export async function onRequestGet(ctx){
  const slug=new URL(ctx.request.url).searchParams.get('slug')||'';
  if(!slug||slug.length>200)return json({error:'สินค้าไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  await ensureDatabase(ctx.env);
  const row=await ctx.env.DB.prepare(`SELECT p.code FROM products x
    JOIN vision7_plans q ON q.product_id=x.id
    JOIN vision7_programs p ON p.id=q.program_id
    WHERE x.slug=? AND x.status='published' AND x.product_kind='vision7-key'
      AND q.active=1 AND q.offer_price>0 AND p.active=1
      AND q.plan_code IN ('monthly','yearly','lifetime','accounts30','accounts50','accounts100')
      AND EXISTS(SELECT 1 FROM vision7_releases r WHERE r.program_id=p.id AND r.status='published')
    LIMIT 1`).bind(slug).first();
  return row?json({code:row.code},200,{'cache-control':'private, no-store'}):json({error:'ไม่พบสินค้า'},404,{'cache-control':'private, no-store'});
}
