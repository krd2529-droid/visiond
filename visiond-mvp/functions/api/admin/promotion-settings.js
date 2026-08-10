import {json,requireAdmin} from '../../_lib.js';
import {loadPromotion} from '../../_promotion.js';
import {saveSetting} from '../../_payment.js';

async function response(env){
  const promotion=await loadPromotion(env);
  const firstSetting=await env.DB.prepare("SELECT value FROM settings WHERE key='first_order_promo_enabled'").first();
  const firstStats=await env.DB.prepare(`SELECT COUNT(*) tracked_users,SUM(CASE WHEN login_count>=2 THEN 1 ELSE 0 END) teased_users,SUM(CASE WHEN offer_granted_at IS NOT NULL THEN 1 ELSE 0 END) granted_users,SUM(CASE WHEN used_order_id IS NOT NULL THEN 1 ELSE 0 END) used_users FROM first_order_promo_state`).first();
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
  return json({item:promotion,categories,first_order:{enabled:firstSetting?.value!=='0',minimum:39900,percent:50,cap:20000,duration_hours:2,stats:firstStats||{}}},200,{'cache-control':'no-store'});
}

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  return response(ctx.env);
}

export async function onRequestPut(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({}));
  const enabled=body.enabled===true,percent=Math.floor(Number(body.percent));
  let scopes=Array.isArray(body.scopes)?body.scopes.map(value=>String(value).trim()).filter(Boolean):[String(body.scope||'all').trim()];
  scopes=[...new Set(scopes)];if(scopes.includes('all'))scopes=['all'];
  if(!scopes.length)return json({error:'กรุณาเลือกอย่างน้อย 1 หมวดสินค้า'},400);
  if(!Number.isInteger(percent)||percent<1||percent>90)return json({error:'เปอร์เซ็นต์ส่วนลดต้องอยู่ระหว่าง 1–90'},400);
  if(!scopes.includes('all')){
    const placeholders=scopes.map(()=>'?').join(','),rows=(await ctx.env.DB.prepare(`SELECT c.slug FROM categories c WHERE c.slug IN (${placeholders}) AND c.active=1 AND (c.parent_slug IS NULL OR trim(c.parent_slug)='') AND c.slug NOT IN ('dinosaur','paper-doll','document','set-coloring','set-tattoo')`).bind(...scopes).all()).results||[];
    if(rows.length!==scopes.length)return json({error:'มีหมวดสินค้าที่เลือกไม่ถูกต้องหรือถูกปิดใช้งาน'},400);
  }
  await saveSetting(ctx.env,'promotion_enabled',enabled?'1':'0');
  await saveSetting(ctx.env,'promotion_scope',scopes.length===1?scopes[0]:'multiple');
  await saveSetting(ctx.env,'promotion_scopes',JSON.stringify(scopes));
  await saveSetting(ctx.env,'promotion_percent',String(percent));
  if(body.first_order_enabled!==undefined)await saveSetting(ctx.env,'first_order_promo_enabled',body.first_order_enabled===true?'1':'0');
  return response(ctx.env);
}
