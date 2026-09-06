import {json,currentUser} from '../_lib.js';
import {ensureDatabase} from '../_schema.js';
import {ensureVxAccess,VX_PLANS,vxAccess} from '../_vx_access.js';
export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env); await ensureVxAccess(ctx.env);
  const rows=(await ctx.env.DB.prepare("SELECT id,slug,title,price,cover_url,category,product_kind FROM products WHERE product_kind='vx-access' AND status='published' AND deleted_at IS NULL").all()).results||[];
  const items=VX_PLANS.flatMap(plan=>{const row=rows.find(p=>p.slug===plan.slug);return row?[{...row,...plan}]:[]});
  const user=await currentUser(ctx),access=user?await vxAccess(ctx.env,user):null;
  const scheduled=user?(await ctx.env.DB.prepare("SELECT g.account_limit,g.starts_at,g.expires_at FROM vx_access_grants g JOIN orders o ON o.id=g.order_id WHERE g.user_id=? AND o.status='paid' AND g.starts_at>CURRENT_TIMESTAMP ORDER BY g.starts_at").bind(user.id).all()).results||[]:[];
  return json({items,access,scheduled},200,{'cache-control':'private, no-store'});
}
