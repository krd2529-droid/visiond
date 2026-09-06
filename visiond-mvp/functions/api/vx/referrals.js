import { json, requireUser } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';
import { ensureReferralCode, ensureVxReferralSchema } from '../../_vx_referrals.js';
export const affiliateBasketDestination = (basket) => basket?.product_kind === 'vx-access' ? '/vtools#plans' : basket?.product_kind === 'vision7-key' ? '/vtools#programs' : basket?.course_id ? `/course.html?id=${encodeURIComponent(basket.course_id)}` : `/product.html?slug=${encodeURIComponent(basket?.slug || '')}`;
export const affiliateBasketLink = (code, basket, origin = 'https://visiondonline.com') => `${origin}/r/${encodeURIComponent(code)}?next=${encodeURIComponent(affiliateBasketDestination(basket))}`;
export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env); await ensureVxReferralSchema(ctx.env);
  const auth = await requireUser(ctx); if (auth.error) return auth.error;
  const [code, summary, clicks, signups, adjustment] = await Promise.all([
    ensureReferralCode(ctx.env, auth.user.id),
    ctx.env.DB.prepare("SELECT COUNT(*) commissions,COALESCE(SUM(CASE WHEN status IN('pending','approved','payable','processing','paid') THEN amount ELSE 0 END),0) total,COALESCE(SUM(CASE WHEN status IN('payable','processing') THEN amount ELSE 0 END),0) payable,COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) paid FROM vx_referral_commissions WHERE referrer_user_id=?").bind(auth.user.id).first(),
    ctx.env.DB.prepare('SELECT COUNT(*) count FROM vx_referral_clicks WHERE code_id=(SELECT id FROM vx_referral_codes WHERE owner_user_id=?)').bind(auth.user.id).first(),
    ctx.env.DB.prepare('SELECT COUNT(*) count FROM vx_referral_attributions WHERE code_id=(SELECT id FROM vx_referral_codes WHERE owner_user_id=?)').bind(auth.user.id).first(),
    ctx.env.DB.prepare('SELECT COALESCE(SUM(amount),0) amount FROM vx_referral_adjustments WHERE referrer_user_id=?').bind(auth.user.id).first()
  ]);
  const baskets=(await ctx.env.DB.prepare(`SELECT p.id,p.slug,p.title,p.short_description,p.price,p.cover_url,p.category,p.product_kind,c.id course_id FROM products p LEFT JOIN courses c ON c.product_id=p.id AND c.course_type='online_course' WHERE p.status='published' AND p.deleted_at IS NULL ORDER BY CASE WHEN p.product_kind='vx-access' THEN 0 WHEN c.id IS NOT NULL THEN 1 ELSE 2 END,p.id DESC`).all()).results||[];
  const adjusted = Number(adjustment?.amount) || 0;
  return json({ code: code.code, rate_percent: Number(code.rate_bps) / 100, status: code.status, link: `https://visiondonline.com/r/${code.code}`, baskets:baskets.map(basket=>({...basket,destination:affiliateBasketDestination(basket),affiliate_link:affiliateBasketLink(code.code,basket)})), summary: { clicks: Number(clicks?.count) || 0, signups: Number(signups?.count) || 0, commissions: Number(summary?.commissions) || 0, total: Number(summary?.total) + adjusted, payable: Number(summary?.payable), paid: Number(summary?.paid) + adjusted, adjustments: adjusted, currency: 'THB' } }, 200, { 'cache-control': 'private, no-store' });
}
