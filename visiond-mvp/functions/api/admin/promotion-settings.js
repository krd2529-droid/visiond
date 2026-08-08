import {json,requireAdmin} from '../../_lib.js';
import {loadPromotion} from '../../_promotion.js';
import {saveSetting} from '../../_payment.js';

async function response(env){
  const promotion=await loadPromotion(env);
  const categories=(await env.DB.prepare(`
    SELECT c.slug,c.name,
      COUNT(p.id) product_count
    FROM categories c
    LEFT JOIN products p ON p.category=c.slug
      AND p.deleted_at IS NULL
      AND COALESCE(p.product_kind,'product')='product'
    WHERE c.active=1
      AND (c.parent_slug IS NULL OR trim(c.parent_slug)='')
      AND c.slug NOT IN ('dinosaur','paper-doll','document','set-coloring','set-tattoo')
    GROUP BY c.id,c.slug,c.name,c.sort_order
    ORDER BY c.sort_order,c.id
  `).all()).results||[];
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
    const category=await ctx.env.DB.prepare(`SELECT c.slug FROM categories c WHERE c.slug=? AND c.active=1 AND (c.parent_slug IS NULL OR trim(c.parent_slug)='') AND c.slug NOT IN ('dinosaur','paper-doll','document','set-coloring','set-tattoo')`).bind(scope).first();
    if(!category)return json({error:'ไม่พบหมวดสินค้าที่เลือก'},400);
  }
  await saveSetting(ctx.env,'promotion_enabled',enabled?'1':'0');
  await saveSetting(ctx.env,'promotion_scope',scope);
  await saveSetting(ctx.env,'promotion_percent',String(percent));
  return response(ctx.env);
}
