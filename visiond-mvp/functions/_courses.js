import { json, requireUser } from './_lib.js';

export async function requireCourseAccess(ctx, courseId) {
  const auth = await requireUser(ctx);
  if (auth.error) return auth;
  const course = await ctx.env.DB.prepare(`SELECT c.*,p.slug,p.title,p.cover_url,p.description,p.short_description,p.price,p.status
    FROM courses c JOIN products p ON p.id=c.product_id WHERE c.id=? AND p.deleted_at IS NULL`).bind(courseId).first();
  if (!course) return { error: json({ error: 'ไม่พบคอร์สเรียน' }, 404) };
  const isStaff = ['boss','admin'].includes(auth.user.role);
  const entitlement = isStaff ? { id: 1 } : await ctx.env.DB.prepare(
    'SELECT id FROM entitlements WHERE user_id=? AND product_id=? AND active=1 LIMIT 1'
  ).bind(auth.user.id, course.product_id).first();
  if (!entitlement) return { error: json({ error: 'บัญชีนี้ยังไม่ได้ซื้อคอร์ส' }, 403) };
  return { user: auth.user, course };
}
