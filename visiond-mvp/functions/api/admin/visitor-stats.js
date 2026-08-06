import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const total=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM page_views').first(),today=await ctx.env.DB.prepare("SELECT COUNT(*) count FROM page_views WHERE date(viewed_at,'+7 hours')=date('now','+7 hours')").first(),last7=await ctx.env.DB.prepare("SELECT COUNT(*) count FROM page_views WHERE date(viewed_at,'+7 hours')>=date('now','+7 hours','-6 days')").first(),last30=await ctx.env.DB.prepare("SELECT COUNT(*) count FROM page_views WHERE date(viewed_at,'+7 hours')>=date('now','+7 hours','-29 days')").first(),unique=await ctx.env.DB.prepare('SELECT COUNT(DISTINCT visitor_key) count FROM page_views').first();
  const {results}=await ctx.env.DB.prepare("SELECT p.id,p.slug,p.title,COUNT(v.id) views FROM products p LEFT JOIN page_views v ON v.product_id=p.id WHERE p.deleted_at IS NULL GROUP BY p.id,p.slug,p.title HAVING views>0 ORDER BY views DESC,p.id DESC LIMIT 10").all();
  return json({total:Number(total?.count)||0,today:Number(today?.count)||0,last7:Number(last7?.count)||0,last30:Number(last30?.count)||0,unique:Number(unique?.count)||0,products:results||[]});
}
