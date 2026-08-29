import {json,requireUser} from '../../_lib.js';
import {ensureDatabase} from '../../_schema.js';
import {ensureLifetimeMemberPlan,memberCategories,LIFETIME_MEMBER_SLUG} from '../../_member_plan.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  await ensureLifetimeMemberPlan(ctx.env);
  const rows=(await ctx.env.DB.prepare("SELECT p.id,p.slug,p.title,p.price,p.cover_url,p.member_category category_slug,p.member_duration_months duration_months,c.name category_name FROM products p LEFT JOIN categories c ON c.slug=p.member_category WHERE p.product_kind='member' AND p.status='published' AND p.deleted_at IS NULL AND (p.slug=? OR c.active=1) ORDER BY CASE WHEN p.slug=? THEN 0 ELSE 1 END,c.sort_order,p.member_duration_months").bind(LIFETIME_MEMBER_SLUG,LIFETIME_MEMBER_SLUG).all()).results;
  const plans=rows.map(plan=>({...plan,category_name:plan.slug===LIFETIME_MEMBER_SLUG?'เกม · แบบฝึกหัด · ระบายสี':plan.category_name,category_slugs:memberCategories(plan.category_slug),lifetime:Number(plan.duration_months)===0}));
  let memberships=[];
  const auth=await requireUser(ctx);
  if(!auth.error) memberships=(await ctx.env.DB.prepare("SELECT cm.category_slug,c.name category_name,cm.starts_at,cm.expires_at,cm.active FROM category_memberships cm LEFT JOIN categories c ON c.slug=cm.category_slug WHERE cm.user_id=? AND cm.active=1 AND cm.expires_at>CURRENT_TIMESTAMP ORDER BY cm.expires_at").bind(auth.user.id).all()).results;
  return json({plans,memberships},200,{'cache-control':'no-store'});
}
