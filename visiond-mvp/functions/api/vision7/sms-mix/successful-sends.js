import { json } from '../../../_lib.js';
import { authenticatedSmsMixBinding } from '../../../_smsmix_license.js';
import { rateLimitIdentityAtomic, requestIp } from '../../../_security.js';

const privateHeaders = { 'cache-control': 'private, no-store' };
const denied = () => json({ ok: false, code: 'SMSMIX_LICENSE_INVALID' }, 403, privateHeaders);
async function boundedBody(request) {
  if (Number(request.headers.get('content-length')) > 6000) return null;
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 6000) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8',{ fatal:true }).decode(bytes);
}

export async function onRequestPost(ctx) {
  const limited = await rateLimitIdentityAtomic(ctx.env, 'smsmix-success-ip', requestIp(ctx.request),
    { limit: 120, windowMinutes: 15, blockMinutes: 15 });
  if (limited.error) return json({ error: 'rate limited' }, 429,
    { ...privateHeaders, 'retry-after': String(limited.retryAfter) });
  let raw;
  try { raw = await boundedBody(ctx.request); } catch { return json({ error: 'invalid request body' }, 400, privateHeaders); }
  if (raw === null) return json({ error: 'batch too large' }, 413, privateHeaders);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'invalid JSON' }, 400, privateHeaders); }
  const items = body?.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) return json({ error: 'invalid batch' }, 400, privateHeaders);
  const seen = new Set();
  for (const item of items) {
    if (!item || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.campaign_id) ||
        !Number.isSafeInteger(item.row_index) || item.row_index < 0 || item.row_index > 100000 ||
        !/^\+[1-9][0-9]{7,14}$/.test(item.phone) || !Number.isSafeInteger(item.sent_at) ||
        item.sent_at < 946684800000 || item.sent_at > Date.now() + 86400000 ||
        Object.keys(item).some(key => !['campaign_id','row_index','phone','sent_at'].includes(key)))
      return json({ error: 'invalid success record' }, 400, privateHeaders);
    const identity = `${item.campaign_id}:${item.row_index}`;
    if (seen.has(identity)) return json({ error: 'duplicate batch identity' }, 400, privateHeaders);
    seen.add(identity);
  }
  const binding = await authenticatedSmsMixBinding(ctx.env, body.key, body.device_id);
  if (!binding) return denied();
  // Recheck entitlement and the current binding within every write. A reset or
  // expiry between lookup and insert must not authorize a stale request.
  const statements = items.map(item => ctx.env.DB.prepare(`INSERT INTO vision7_smsmix_successful_sends
      (license_id,user_id,device_hash,campaign_id,row_index,recipient_phone,sent_at)
    SELECT l.id,l.user_id,b.device_hash,?,?,?,?
    FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
      JOIN vision7_smsmix_bindings b ON b.license_id=l.id
    WHERE l.id=? AND l.status='active' AND (l.expires_at IS NULL OR l.expires_at>datetime('now'))
      AND p.code='sms-mix' AND p.platform_type='android' AND p.active=1 AND b.device_hash=?
    ON CONFLICT(license_id,device_hash,campaign_id,row_index) DO NOTHING`)
    .bind(item.campaign_id,item.row_index,item.phone,item.sent_at,binding.id,binding.device_hash));
  // Each guarded insert is followed by an assertion in the same D1 transaction.
  // A stale/no-op insert cannot be reported as accepted and then removed locally.
  const assertions = items.map(item => ctx.env.DB.prepare(`INSERT INTO vision7_programs(id,code)
    SELECT p.id,p.code FROM vision7_programs p WHERE p.code='sms-mix' AND NOT EXISTS (
      SELECT 1 FROM vision7_smsmix_successful_sends s
      WHERE s.license_id=? AND s.device_hash=? AND s.campaign_id=? AND s.row_index=?)`)
    .bind(binding.id,binding.device_hash,item.campaign_id,item.row_index));
  try { await ctx.env.DB.batch([...statements,...assertions]); }
  catch { return json({ error: 'success records were not stored; retry' }, 503, privateHeaders); }
  if (!await authenticatedSmsMixBinding(ctx.env, body.key, body.device_id)) return denied();
  return json({ ok: true, accepted: items.length }, 200, privateHeaders);
}
