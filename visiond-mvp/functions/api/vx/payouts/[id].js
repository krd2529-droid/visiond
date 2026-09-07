import { json, requireUser } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVxReferralSchema } from '../../../_vx_referrals.js';

const headers = { 'cache-control': 'private, no-store' };
const cleanId = value => String(value || '').trim().slice(0, 80);

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVxReferralSchema(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const id = cleanId(ctx.params.id);
  const payout = await ctx.env.DB.prepare(`SELECT p.id,p.payout_no,p.referrer_user_id,p.amount,p.currency,p.status,p.proof_key,p.created_at,p.paid_at,u.name recipient_name,u.email recipient_email,u.phone recipient_phone FROM vx_referral_payouts p JOIN users u ON u.id=p.referrer_user_id WHERE p.id=?`).bind(id).first();
  if (!payout) return json({ error: 'ไม่พบเอกสารค่าคอม' }, 404, headers);
  if (Number(payout.referrer_user_id) !== Number(auth.user.id) && !['boss', 'admin'].includes(auth.user.role)) return json({ error: 'ไม่มีสิทธิ์ดูเอกสารนี้' }, 403, headers);
  const items = (await ctx.env.DB.prepare(`SELECT c.id,c.order_id,o.order_no,c.base_amount,c.rate_bps,c.amount,c.currency,o.updated_at paid_at FROM vx_referral_payout_items pi JOIN vx_referral_commissions c ON c.id=pi.commission_id JOIN orders o ON o.id=c.order_id WHERE pi.payout_id=? ORDER BY o.updated_at,o.id`).bind(id).all()).results || [];
  const totalBaseAmount = items.reduce((sum, item) => sum + Number(item.base_amount || 0), 0);
  const totalCommission = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (!items.length || totalCommission !== Number(payout.amount)) return json({ error: 'ยอดเอกสารไม่ตรงกับบัญชีค่าคอม กรุณาติดต่อ VisionD' }, 409, headers);
  return json({ statement: { ...payout, total_base_amount: totalBaseAmount, total_commission: totalCommission, items: items.map(item => ({ ...item, rate_percent: Number(item.rate_bps || 0) / 100 })) } }, 200, headers);
}
