import {cookie,json,sha256} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {rateLimitIdentity,requestIp} from '../../_security.js';
import {analyticsStats,recordPageView} from '../../_analytics.js';

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
  const [site,productStats]=await Promise.all([analyticsStats(env),product?analyticsStats(env,product.id):null]);
  return {site_views:site.total,today_views:site.today,last7_views:site.last7,last30_views:site.last30,product_views:productStats?.total||0};
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const limited=await rateLimitIdentity(ctx.env,ctx.request,'analytics-view-ip',requestIp(ctx.request),90,1,5);if(limited.error)return limited.error;
  const body=await ctx.request.json().catch(()=>({})),path=cleanPath(body.path),product=await productFromSlug(ctx.env,body.product_slug);
  const userAgent=ctx.request.headers.get('user-agent')||'',isBot=/bot|crawler|spider|slurp|preview|facebookexternalhit/i.test(userAgent),visitor=visitorIdentity(ctx.request),visitorKey=await sha256(`${visitor.id}|visiond-view-v2`);
  const duplicate=await ctx.env.DB.prepare("SELECT id FROM page_views WHERE visitor_key=? AND path=? AND COALESCE(product_id,0)=? AND viewed_at>=datetime('now','-30 minutes') LIMIT 1").bind(visitorKey,path,product?.id||0).first();
  if(!duplicate&&!isBot)await recordPageView(ctx.env,{path,productId:product?.id,visitorKey});
  const stats=await viewStats(ctx.env,product),headers={'cache-control':'no-store'};if(visitor.setCookie)headers['set-cookie']=visitor.setCookie;
  return json({ok:true,counted:!duplicate&&!isBot,...stats},200,headers);
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const limited=await rateLimitIdentity(ctx.env,ctx.request,'analytics-read-ip',requestIp(ctx.request),120,1,5);if(limited.error)return limited.error;
  const url=new URL(ctx.request.url),product=await productFromSlug(ctx.env,url.searchParams.get('product_slug'));
  return json(await viewStats(ctx.env,product),200,{'cache-control':'no-store'});
}
