import {json,sha256} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const cleanPath=value=>{
  const path=String(value||'/').split('?')[0].slice(0,160);
  const allowed=new Set(['/','/index.html','/digital-products.html','/product.html','/blog.html','/about.html','/contact.html','/courses.html','/bots.html']);
  return allowed.has(path)||path.startsWith('/blog/')?path:'/';
};
const requestIp=request=>request.headers.get('CF-Connecting-IP')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';

async function productFromSlug(env,slug){
  if(!slug)return null;
  return await env.DB.prepare("SELECT id,slug FROM products WHERE slug=? AND status='published' AND deleted_at IS NULL").bind(String(slug).slice(0,120)).first();
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const body=await ctx.request.json().catch(()=>({})),path=cleanPath(body.path),product=await productFromSlug(ctx.env,body.product_slug);
  const userAgent=ctx.request.headers.get('user-agent')||'',isBot=/bot|crawler|spider|slurp|preview|facebookexternalhit/i.test(userAgent),visitorKey=await sha256(`${requestIp(ctx.request)}|${userAgent}|visiond-view-v1`);
  const duplicate=await ctx.env.DB.prepare("SELECT id FROM page_views WHERE visitor_key=? AND path=? AND COALESCE(product_id,0)=? AND viewed_at>=datetime('now','-30 minutes') LIMIT 1").bind(visitorKey,path,product?.id||0).first();
  if(!duplicate&&!isBot)await ctx.env.DB.prepare('INSERT INTO page_views(path,product_id,visitor_key) VALUES(?,?,?)').bind(path,product?.id||null,visitorKey).run();
  const site=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM page_views').first(),productViews=product?await ctx.env.DB.prepare('SELECT COUNT(*) count FROM page_views WHERE product_id=?').bind(product.id).first():null;
  return json({ok:true,counted:!duplicate&&!isBot,site_views:Number(site?.count)||0,product_views:Number(productViews?.count)||0});
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const url=new URL(ctx.request.url),product=await productFromSlug(ctx.env,url.searchParams.get('product_slug'));
  const site=await ctx.env.DB.prepare('SELECT COUNT(*) count FROM page_views').first(),today=await ctx.env.DB.prepare("SELECT COUNT(*) count FROM page_views WHERE date(viewed_at,'+7 hours')=date('now','+7 hours')").first(),productViews=product?await ctx.env.DB.prepare('SELECT COUNT(*) count FROM page_views WHERE product_id=?').bind(product.id).first():null;
  return json({site_views:Number(site?.count)||0,today_views:Number(today?.count)||0,product_views:Number(productViews?.count)||0});
}
