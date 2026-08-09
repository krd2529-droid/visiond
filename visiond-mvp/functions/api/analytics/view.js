import {cookie,json,sha256} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {rateLimitIdentity,requestIp} from '../../_security.js';

const VISITOR_COOKIE='__Host-vd_vid';

const cleanPath=value=>{
  const path=String(value||'/').split('?')[0].slice(0,160);
  const allowed=new Set(['/','/index.html','/digital-products.html','/product.html','/blog.html','/about.html','/contact.html','/courses.html','/bots.html']);
  return allowed.has(path)||path.startsWith('/blog/')?path:'/';
};
const visitorIdentity=request=>{
  const existing=cookie(request,VISITOR_COOKIE);
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing))return {id:existing};
  const id=crypto.randomUUID();
  return {id,setCookie:`${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax`};
};

async function productFromSlug(env,slug){
  if(!slug)return null;
  return await env.DB.prepare("SELECT id,slug FROM products WHERE slug=? AND status='published' AND deleted_at IS NULL").bind(String(slug).slice(0,120)).first();
}

async function viewStats(env,product){
  const [site,rolling,productViews]=await Promise.all([
    env.DB.prepare('SELECT COALESCE(MAX(id),0) count FROM page_views').first(),
    env.DB.prepare(`SELECT
      COALESCE(SUM(CASE WHEN date(viewed_at,'+7 hours')=date('now','+7 hours') THEN 1 ELSE 0 END),0) today,
      COALESCE(SUM(CASE WHEN date(viewed_at,'+7 hours')>=date('now','+7 hours','-6 days') THEN 1 ELSE 0 END),0) last7,
      COUNT(*) last30
      FROM page_views WHERE viewed_at>=datetime(date('now','+7 hours','-29 days'),'-7 hours')`).first(),
    product?env.DB.prepare('SELECT COUNT(*) count FROM page_views WHERE product_id=?').bind(product.id).first():null
  ]);
  return {site_views:Number(site?.count)||0,today_views:Number(rolling?.today)||0,last7_views:Number(rolling?.last7)||0,last30_views:Number(rolling?.last30)||0,product_views:Number(productViews?.count)||0};
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const limited=await rateLimitIdentity(ctx.env,ctx.request,'analytics-view-ip',requestIp(ctx.request),90,1,5);if(limited.error)return limited.error;
  const body=await ctx.request.json().catch(()=>({})),path=cleanPath(body.path),product=await productFromSlug(ctx.env,body.product_slug);
  const userAgent=ctx.request.headers.get('user-agent')||'',isBot=/bot|crawler|spider|slurp|preview|facebookexternalhit/i.test(userAgent),visitor=visitorIdentity(ctx.request),visitorKey=await sha256(`${visitor.id}|visiond-view-v2`);
  const duplicate=await ctx.env.DB.prepare("SELECT id FROM page_views WHERE visitor_key=? AND path=? AND COALESCE(product_id,0)=? AND viewed_at>=datetime('now','-30 minutes') LIMIT 1").bind(visitorKey,path,product?.id||0).first();
  if(!duplicate&&!isBot)await ctx.env.DB.prepare('INSERT INTO page_views(path,product_id,visitor_key) VALUES(?,?,?)').bind(path,product?.id||null,visitorKey).run();
  const stats=await viewStats(ctx.env,product),headers={'cache-control':'no-store'};if(visitor.setCookie)headers['set-cookie']=visitor.setCookie;
  return json({ok:true,counted:!duplicate&&!isBot,...stats},200,headers);
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const url=new URL(ctx.request.url),product=await productFromSlug(ctx.env,url.searchParams.get('product_slug'));
  return json(await viewStats(ctx.env,product),200,{'cache-control':'no-store'});
}
