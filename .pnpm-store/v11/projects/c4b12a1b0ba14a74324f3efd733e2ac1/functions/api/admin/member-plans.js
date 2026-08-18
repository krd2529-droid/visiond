import {json,requireAdmin} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';

const cleanSlug=value=>String(value||'').trim().toLowerCase();
export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const plans=(await ctx.env.DB.prepare("SELECT p.id,p.slug,p.title,p.price,p.status,p.member_category category_slug,p.member_duration_months duration_months,c.name category_name,(SELECT COUNT(*) FROM category_memberships cm WHERE cm.category_slug=p.member_category AND cm.active=1 AND cm.expires_at>CURRENT_TIMESTAMP) active_members FROM products p LEFT JOIN categories c ON c.slug=p.member_category WHERE p.product_kind='member' AND p.deleted_at IS NULL ORDER BY c.sort_order,p.member_duration_months").all()).results;
  const categories=(await ctx.env.DB.prepare("SELECT slug,name FROM categories WHERE active=1 AND parent_slug IS NULL AND slug NOT LIKE 'set-%' ORDER BY sort_order,name").all()).results;
  return json({plans,categories});
}
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const body=await ctx.request.json().catch(()=>({})),category=cleanSlug(body.category_slug),months=Number(body.duration_months),price=Math.round(Number(body.price_baht)*100),status=body.active?'published':'draft';
  if(!category||![1,12].includes(months)||!Number.isFinite(price)||price<0)return json({error:'กรุณาเลือกหมวด ระยะเวลา และราคาให้ถูกต้อง'},400);
  const cat=await ctx.env.DB.prepare('SELECT name FROM categories WHERE slug=? AND active=1').bind(category).first();if(!cat)return json({error:'ไม่พบหมวดที่เลือก'},404);
  const slug=`member-${category}-${months}m`,title=`Member ${cat.name} · ${months===12?'รายปี':'รายเดือน'}`,description=`สิทธิ์ดาวน์โหลดสินค้าทั้งหมดในหมวด${cat.name} รวมสินค้าใหม่ในอนาคต เป็นเวลา ${months===12?'1 ปี':'1 เดือน'} นับจากวันที่อนุมัติ`;
  await ctx.env.DB.prepare("INSERT INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind,member_category,member_duration_months,updated_at) VALUES(?,?,?,?,?,'/assets/product-placeholder.svg','[]','member','Member',0,?,'member','member',?,?,CURRENT_TIMESTAMP) ON CONFLICT(slug) DO UPDATE SET title=excluded.title,short_description=excluded.short_description,description=excluded.description,price=excluded.price,status=excluded.status,member_category=excluded.member_category,member_duration_months=excluded.member_duration_months,updated_at=CURRENT_TIMESTAMP").bind(slug,title,description,description,price,status,category,months).run();
  return json({ok:true,slug});
}
