import { json, requireBoss } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';
import { ensureVxReferralSchema } from '../../_vx_referrals.js';
const headers = { 'cache-control': 'private, no-store' }, clean = (value, length = 100) => String(value || '').trim().slice(0, length);
async function authorize(ctx) { await ensureDatabase(ctx.env); await ensureVxReferralSchema(ctx.env); return requireBoss(ctx); }
export async function onRequestGet(ctx) {
  const access = await authorize(ctx); if (access.error) return access.error;
  const status = clean(new URL(ctx.request.url).searchParams.get('status'), 20);
  const [commissions, payouts, adjustments] = await Promise.all([
    ctx.env.DB.prepare("SELECT c.*,COALESCE(u.name,u.username,u.email) referrer FROM vx_referral_commissions c JOIN users u ON u.id=c.referrer_user_id WHERE (?='' OR c.status=?) ORDER BY c.created_at DESC LIMIT 500").bind(status, status).all(),
    ctx.env.DB.prepare("SELECT p.*,COALESCE(u.name,u.username,u.email) referrer FROM vx_referral_payouts p JOIN users u ON u.id=p.referrer_user_id ORDER BY p.created_at DESC LIMIT 200").all(),
    ctx.env.DB.prepare("SELECT a.*,COALESCE(u.name,u.username,u.email) referrer FROM vx_referral_adjustments a JOIN users u ON u.id=a.referrer_user_id ORDER BY a.created_at DESC LIMIT 200").all()
  ]);
  return json({ items: commissions.results || [], payouts: payouts.results || [], adjustments: adjustments.results || [] }, 200, headers);
}
export async function onRequestPost(ctx) {
  const access = await authorize(ctx); if (access.error) return access.error;
  const body = await ctx.request.json().catch(() => ({})), ids = [...new Set((Array.isArray(body.commission_ids) ? body.commission_ids : []).map(id => clean(id, 80)).filter(Boolean))].slice(0, 200);
  if (!ids.length) return json({ error: 'กรุณาเลือกรายการพร้อมจ่าย' }, 400, headers);
  const id = crypto.randomUUID(), payoutNo = `VX-${Date.now()}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`, payloadIds = JSON.stringify(ids);
  let results;
  try { results = await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE vx_referral_commissions SET status='processing',payout_id=?,updated_at=CURRENT_TIMESTAMP WHERE status='payable' AND payout_id IS NULL AND EXISTS(SELECT 1 FROM orders o WHERE o.id=vx_referral_commissions.order_id AND o.status='paid') AND id IN(SELECT value FROM json_each(?))").bind(id, payloadIds),
    ctx.env.DB.prepare("INSERT INTO vx_referral_payouts(id,payout_no,referrer_user_id,amount,currency,status,created_by) SELECT ?,?,MIN(referrer_user_id),SUM(amount),MIN(currency),'processing',? FROM vx_referral_commissions WHERE payout_id=? AND NOT EXISTS(SELECT 1 FROM vx_referral_adjustments a WHERE a.referrer_user_id IN(SELECT referrer_user_id FROM vx_referral_commissions WHERE payout_id=?) AND a.status='open') HAVING COUNT(*)=? AND MIN(referrer_user_id)=MAX(referrer_user_id) AND MIN(currency)=MAX(currency)").bind(id, payoutNo, access.user.id, id, id, ids.length),
    ctx.env.DB.prepare("INSERT INTO vx_referral_payout_items(payout_id,commission_id,amount) SELECT ?,id,amount FROM vx_referral_commissions WHERE payout_id=? AND EXISTS(SELECT 1 FROM vx_referral_payouts WHERE id=?)").bind(id, id, id),
    ctx.env.DB.prepare("UPDATE vx_referral_commissions SET status='payable',payout_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE payout_id=? AND NOT EXISTS(SELECT 1 FROM vx_referral_payouts WHERE id=?)").bind(id, id)
  ]); } catch { return json({ error: 'สร้างรอบจ่ายซ้ำหรือไม่สำเร็จ' }, 409, headers); }
  if (Number(results[1]?.meta?.changes) !== 1) return json({ error: 'มีรายการที่ไม่พร้อมจ่าย หรือผู้รับ/สกุลเงินไม่ตรงกัน' }, 409, headers);
  const payout = await ctx.env.DB.prepare('SELECT id,payout_no,amount,currency,status FROM vx_referral_payouts WHERE id=?').bind(id).first();
  return json({ ok: true, payout }, 201, headers);
}
export async function onRequestPatch(ctx) {
  const access = await authorize(ctx); if (access.error) return access.error;
  const body = await ctx.request.json().catch(() => ({})), action = clean(body.action, 30), id = clean(body.id, 80);
  if (action === 'payout_paid') {
    const proofKey = clean(body.proof_key, 500);
    if (!proofKey) return json({ error: 'กรุณาระบุหลักฐานหรือเลขอ้างอิงการจ่ายเงิน' }, 400, headers);
    const payout = await ctx.env.DB.prepare("SELECT p.id,p.amount,p.currency,COUNT(i.commission_id) item_count,COALESCE(SUM(c.amount),0) ledger_amount,SUM(CASE WHEN c.status='processing' THEN 1 ELSE 0 END) processing_count FROM vx_referral_payouts p JOIN vx_referral_payout_items i ON i.payout_id=p.id JOIN vx_referral_commissions c ON c.id=i.commission_id WHERE p.id=? AND p.status='processing' GROUP BY p.id").bind(id).first();
    if (!payout || Number(payout.item_count) !== Number(payout.processing_count) || Number(payout.amount) !== Number(payout.ledger_amount)) return json({ error: 'รอบจ่ายไม่สมบูรณ์หรือยอดบัญชีเปลี่ยน กรุณาตรวจสอบก่อน' }, 409, headers);
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE vx_referral_commissions SET status='paid',updated_at=CURRENT_TIMESTAMP WHERE id IN(SELECT commission_id FROM vx_referral_payout_items WHERE payout_id=?) AND status='processing'").bind(id),
      ctx.env.DB.prepare("UPDATE vx_referral_payouts SET status='paid',proof_key=?,paid_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing'").bind(proofKey, id)
    ]);
    return Number(results[0]?.meta?.changes) === Number(payout.item_count) && Number(results[1]?.meta?.changes) === 1 ? json({ ok: true, status: 'paid' }, 200, headers) : json({ error: 'รอบจ่ายไม่ครบ กรุณาตรวจสอบบัญชีก่อนดำเนินการต่อ' }, 409, headers);
  }
  if (action === 'adjustment_settled') {
    const proofKey = clean(body.proof_key, 500);
    if (!proofKey) return json({ error: 'กรุณาระบุหลักฐานการเรียกคืนยอด' }, 400, headers);
    const result = await ctx.env.DB.prepare("UPDATE vx_referral_adjustments SET status='settled',reason=reason||' · settled:'||?,settled_at=CURRENT_TIMESTAMP WHERE id=? AND status='open'").bind(proofKey,id).run();
    return Number(result?.meta?.changes)===1?json({ok:true,status:'settled'},200,headers):json({error:'ยอดเรียกคืนถูกดำเนินการแล้ว'},409,headers);
  }
  const status = clean(body.status, 20), allowed = new Set(['approved', 'payable', 'void']);
  if (!allowed.has(status) || !id) return json({ error: 'ข้อมูลไม่ถูกต้อง' }, 400, headers);
  const transition = status === 'approved' ? "status='pending'" : status === 'payable' ? "status='approved' AND hold_until<=CURRENT_TIMESTAMP" : "status IN('pending','approved','payable')";
  const result = await ctx.env.DB.prepare(`UPDATE vx_referral_commissions SET status=?,void_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND ${transition}`).bind(status, status === 'void' ? clean(body.reason, 300) : '', id).run();
  return Number(result?.meta?.changes) ? json({ ok: true, status }, 200, headers) : json({ error: 'สถานะเปลี่ยนไม่ได้หรือรายการถูกดำเนินการแล้ว' }, 409, headers);
}
