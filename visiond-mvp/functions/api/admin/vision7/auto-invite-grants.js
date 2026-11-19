import { json, requireAdmin } from '../../../_lib.js';
import { ensureDatabase } from '../../../_schema.js';
import { ensureVision7Schema } from '../../../_vision7_schema.js';
import { autoInviteSigner, grantAutoInvite, normalizeAutoInviteMachineId } from '../../../_auto_invite.js';

const noStore = { 'cache-control':'private, no-store' };
export const recipientEmailSql = 'SELECT id,name,email FROM users WHERE email=? COLLATE NOCASE LIMIT 1';
export function validateGrantInput(body) {
  const email = String(body.email||'').trim();
  const machineId = normalizeAutoInviteMachineId(body.machine_id);
  const requestId = String(body.request_id||'').trim();
  const term = String(body.term||'');
  const days = body.duration_days===null ? null : Number(body.duration_days);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254 || !machineId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
      !((term==='lifetime' && body.duration_days===null) || (term==='days' && typeof body.duration_days==='number' && Number.isSafeInteger(days) && days>=1 && days<=3650))) return null;
  return {email,machineId,requestId,days};
}
export const grantAdminPageSql = `SELECT g.id,g.request_id,g.machine_id,g.duration_days,g.expires_at,g.key_last4,g.issued_at,
  recipient.email recipient_email,recipient.name recipient_name,issuer.email issuer_email
  FROM auto_invite_grants g INDEXED BY idx_auto_invite_grants_recent JOIN users recipient ON recipient.id=g.recipient_id
  JOIN users issuer ON issuer.id=g.issuer_id WHERE (? IS NULL OR g.id<?)
  ORDER BY g.id DESC LIMIT 25`;

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireAdmin(ctx);
  if (auth.error) { auth.error.headers.set('cache-control','private, no-store'); return auth.error; }
  const raw = new URL(ctx.request.url).searchParams.get('cursor');
  const cursor = raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : null;
  if (raw!==null && (!Number.isSafeInteger(cursor) || cursor<=0)) return json({error:'cursor ไม่ถูกต้อง'},400,noStore);
  const rows = (await ctx.env.DB.prepare(grantAdminPageSql).bind(cursor,cursor).all()).results||[];
  return json({items:rows.slice(0,24),next_cursor:rows.length>24?rows[23].id:null},200,noStore);
}

export async function issueAutoInviteGrant(ctx, signerFactory=autoInviteSigner) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireAdmin(ctx);
  if (auth.error) { auth.error.headers.set('cache-control','private, no-store'); return auth.error; }
  const body = await ctx.request.json().catch(()=>({}));
  const input = validateGrantInput(body);
  if (!input) return json({error:'กรอกอีเมลผู้ใช้ รหัสเครื่อง และจำนวนวัน 1–3650 หรือเลือกตลอดชีพ'},400,noStore);
  const {email,machineId,requestId,days} = input;
  const recipient = await ctx.env.DB.prepare(recipientEmailSql).bind(email).first();
  if (!recipient) return json({error:'ไม่พบบัญชีอีเมลนี้ใน VisionD'},404,noStore);
  let signer;
  try { signer = await signerFactory(ctx.env); }
  catch { return json({error:'ระบบเซ็นคีย์ Follow me ยังไม่พร้อม'},503,noStore); }
  try {
    const grant = await grantAutoInvite(ctx.env,{requestId,recipient,issuerId:auth.user.id,machineId,durationDays:days,privateKey:signer});
    if (grant.conflict) return json({error:'รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว'},409,noStore);
    return json({ok:true,grant_id:grant.id,key:grant.key,machine_id:grant.machine_id,
      expires_at:grant.expires_at,existing:grant.existing,recipient_email:recipient.email},200,noStore);
  } catch { return json({error:'ออกคีย์ไม่สำเร็จ กรุณาลองใหม่ด้วยข้อมูลเดิม'},503,noStore); }
}
export const onRequestPost = ctx => issueAutoInviteGrant(ctx);
