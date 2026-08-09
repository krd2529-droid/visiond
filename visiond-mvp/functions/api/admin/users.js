import {json,requireAdmin} from '../../_lib.js';
export async function onRequestGet(ctx){
  const a=await requireAdmin(ctx); if(a.error)return a.error;
  const {results}=await ctx.env.DB.prepare(`SELECT u.id,u.email,u.username,u.name,u.phone,u.role,u.created_at,(EXISTS(SELECT 1 FROM entitlements e JOIN products p ON p.id=e.product_id LEFT JOIN courses c ON c.product_id=p.id WHERE e.user_id=u.id AND e.active=1 AND (p.category='resale-rights' OR c.course_type='resale_rights')) OR EXISTS(SELECT 1 FROM course_right_credits cr WHERE cr.user_id=u.id)) is_course_owner,(SELECT COUNT(*) FROM course_right_credits cr WHERE cr.user_id=u.id AND cr.active=1 AND cr.used_course_id IS NULL) course_credit_balance FROM users u ORDER BY CASE u.role WHEN 'boss' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END,u.id DESC`).all();
  results.forEach(user=>{user.is_course_owner=Boolean(user.is_course_owner)});
  return json({viewer:a.user,items:results});
}
