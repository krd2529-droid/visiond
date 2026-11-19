import { json } from '../../../../_lib.js';
import { ensureDatabase } from '../../../../_schema.js';
import { ensureVision7Schema } from '../../../../_vision7_schema.js';
import { requireVision7User as requireUser } from '../../../../_vision7_auth.js';
import { refreshLicenseExpiry } from '../../../../_vision7.js';
import { activeAutoInviteGrant } from '../../../../_auto_invite.js';

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const auth = await requireUser(ctx);
  if (auth.error) return auth.error;
  const releaseId = Number(ctx.params.id);
  if (!Number.isSafeInteger(releaseId) || releaseId <= 0) return json({ error:'ไม่พบไฟล์หรือไม่มีสิทธิ์ดาวน์โหลด' },404,{'cache-control':'private, no-store'});
  const row = await ctx.env.DB.prepare(`SELECT r.*,p.code program_code FROM vision7_releases r
    JOIN vision7_programs p ON p.id=r.program_id WHERE r.id=? AND r.status='published'`).bind(releaseId).first();
  if (!row) return json({ error:'ไม่พบไฟล์หรือไม่มีสิทธิ์ดาวน์โหลด' },404,{'cache-control':'private, no-store'});
  if (row.program_code === 'auto-invite') {
    const paid = await ctx.env.DB.prepare(`SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id AND o.status='paid'
      JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code IN ('monthly','lifetime')
      WHERE q.program_id=? AND o.user_id=? AND ((q.plan_code='monthly' AND oi.price=59000) OR (q.plan_code='lifetime' AND oi.price IN (69000,159000))) LIMIT 1`).bind(row.program_id,auth.user.id).first();
    if (!paid) {
      if (!await activeAutoInviteGrant(ctx.env,row.program_id,auth.user.id))
        return json({ error:'ไม่พบไฟล์หรือไม่มีสิทธิ์ดาวน์โหลด' },404,{'cache-control':'private, no-store'});
    }
  } else {
    const licensed = await ctx.env.DB.prepare(`SELECT r.*,l.id license_id,l.status license_status,l.expires_at FROM vision7_releases r JOIN vision7_licenses l ON l.program_id=r.program_id WHERE r.id=? AND r.status='published' AND l.user_id=? ORDER BY CASE WHEN l.status IN ('active','trial') AND (l.expires_at IS NULL OR datetime(l.expires_at)>CURRENT_TIMESTAMP) THEN 0 ELSE 1 END,l.created_at DESC,l.id DESC LIMIT 1`).bind(releaseId,auth.user.id).first();
    if (!licensed) return json({ error:'ไม่พบไฟล์หรือไม่มีสิทธิ์ดาวน์โหลด' },404,{'cache-control':'private, no-store'});
    const current = await refreshLicenseExpiry(ctx.env,{id:licensed.license_id,status:licensed.license_status,expires_at:licensed.expires_at});
    if (!['active','trial'].includes(current.status)) return json({ error:'สิทธิ์นี้หมดอายุหรือถูกระงับ' },403,{'cache-control':'private, no-store'});
  }
  const object = await ctx.env.FILES.get(row.object_key);
  if (!object) return json({ error:'ไฟล์ติดตั้งสูญหาย กรุณาติดต่อ VisionD' },404,{'cache-control':'private, no-store'});
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('content-type',row.mime_type||'application/octet-stream');
  headers.set('content-length',String(row.file_size));
  headers.set('content-disposition',`attachment; filename*=UTF-8''${encodeURIComponent(row.file_name)}`);
  headers.set('cache-control','private, no-store');
  headers.set('x-content-type-options','nosniff');
  headers.set('content-security-policy',"default-src 'none'; sandbox");
  headers.set('x-vision7-version',row.version);
  headers.set('x-vision7-sha256',row.sha256);
  return new Response(object.body,{headers});
}
