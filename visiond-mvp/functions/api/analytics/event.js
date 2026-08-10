import {cookie,currentUser,json,sha256} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {rateLimitIdentity,requestIp} from '../../_security.js';

const VISITOR_COOKIE='__Host-vd_vid';
const EVENTS=new Set(['landing_view','product_view','course_view','signup_start','signup_complete','login_success','add_to_cart','remove_from_cart','checkout_start','payment_submit','payment_failed','download','course_start','return_visit','guest_gift_view','guest_gift_click','first_order_gift_granted','first_order_gift_opened']);
const text=(v,n=120)=>String(v||'').replace(/[\u0000-\u001f]/g,'').slice(0,n);
const cleanPath=v=>{const x=text(v||'/',160).split('?')[0];return x.startsWith('/')?x:'/'};
const cleanRef=v=>{try{const u=new URL(String(v||''));return `${u.origin}${u.pathname}`.slice(0,240)}catch{return ''}};
async function productFromSlug(env,slug){if(!slug)return null;return env.DB.prepare("SELECT id FROM products WHERE slug=? AND deleted_at IS NULL").bind(text(slug,120)).first()}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const limited=await rateLimitIdentity(ctx.env,ctx.request,'customer-event-ip',requestIp(ctx.request),180,1,5);if(limited.error)return limited.error;
  const body=await ctx.request.json().catch(()=>({})),event=text(body.event,40);if(!EVENTS.has(event))return json({error:'event ไม่ถูกต้อง'},400);
  const rawVisitor=cookie(ctx.request,VISITOR_COOKIE),visitorKey=/^[0-9a-f-]{36}$/i.test(rawVisitor)?await sha256(`${rawVisitor}|visiond-view-v2`):null;
  const user=await currentUser(ctx),product=await productFromSlug(ctx.env,body.product_slug),path=cleanPath(body.path);
  const attribution=body.attribution&&typeof body.attribution==='object'?body.attribution:{};
  const metadata={};for(const key of ['quantity','value','course_id'])if(Number.isFinite(Number(body.metadata?.[key])))metadata[key]=Number(body.metadata[key]);
  const recent=await ctx.env.DB.prepare("SELECT id FROM customer_events WHERE event_type=? AND COALESCE(visitor_key,'')=COALESCE(?,'') AND COALESCE(user_id,0)=? AND path=? AND COALESCE(product_id,0)=? AND created_at>=datetime('now','-10 seconds') LIMIT 1").bind(event,visitorKey,user?.id||0,path,product?.id||0).first();
  if(!recent)await ctx.env.DB.prepare(`INSERT INTO customer_events(visitor_key,user_id,event_type,path,product_id,source,medium,campaign,content,referrer,metadata) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(visitorKey,user?.id||null,event,path,product?.id||null,text(attribution.source,80),text(attribution.medium,80),text(attribution.campaign,120),text(attribution.content,120),cleanRef(attribution.referrer),JSON.stringify(metadata)).run();
  return json({ok:true,counted:!recent});
}
