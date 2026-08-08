import {json,requireAdmin} from '../../_lib.js';
import {loadPromotion} from '../../_promotion.js';
import {saveSetting} from '../../_payment.js';

async function response(env){
  const promotion=await loadPromotion(env);
  const categories=(await env.DB.prepare("SELECT slug,name FROM categories WHERE active=1 ORDER BY sort_order,id").all()).results||[];
  return json({item:promotion,categories},200,{'cache-control':'no-store'});
}

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  return response(ctx.env);
}

export async function onRequestPut(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({}));
  const enabled=body.enabled===true,scope=String(body.scope||'all').trim(),percent=Math.floor(Number(body.percent));
  if(!Number.isInteger(percent)||percent<1||percent>90)return json({error:'เปอร์เซ็นต์ส่วนลดต้องอยู่ระหว่าง 1–90'},400);
  if(scope!=='all'){
    const category=await ctx.env.DB.prepare('SELECT slug FROM categories WHERE slug=? AND active=1').bind(scope).first();
    if(!category)return json({error:'ไม่พบหมวดสินค้าที่เลือก'},400);
  }
  await saveSetting(ctx.env,'promotion_enabled',enabled?'1':'0');
  await saveSetting(ctx.env,'promotion_scope',scope);
  await saveSetting(ctx.env,'promotion_percent',String(percent));
  return response(ctx.env);
}
