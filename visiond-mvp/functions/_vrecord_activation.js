import { json, sha256 } from './_lib.js';
import { hashLicenseKey } from './_vision7.js';

const noStore = { 'cache-control': 'private, no-store' };
const day = 86400;
const reject = (error, status) => json({ error }, status, noStore);
const epoch = value => Math.floor(Date.parse(`${String(value).replace(' ', 'T').replace(/Z$/, '')}Z`) / 1000);
const base64 = bytes => btoa(String.fromCharCode(...bytes));

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) return null;
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

async function signingKey(env) {
  const encoded = String(env.VRECORD_LICENSE_SIGNING_PKCS8 || '');
  if (!/^[A-Za-z0-9+/=]{100,8192}$/.test(encoded)) return null;
  try {
    const der = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    return await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  } catch { return null; }
}

export async function vRecordActivation(ctx, refresh = false) {
  const signer = await signingKey(ctx.env);
  if (!signer) return reject('ระบบใบอนุญาต V-Record ยังไม่พร้อม', 503);
  const body = await readBody(ctx.request);
  const licenseKey = body?.licenseKey, deviceId = body?.deviceId;
  if (typeof licenseKey !== 'string' || licenseKey.length < 20 || licenseKey.length > 100 || typeof deviceId !== 'string' || !/^[a-f0-9]{64}$/.test(deviceId)) return reject('คีย์หรือรหัสเครื่องไม่ถูกต้อง', 400);
  const license = await ctx.env.DB.prepare(`SELECT l.id,l.status,l.expires_at,l.source,l.order_id,l.max_devices,o.status order_status,
    EXISTS(SELECT 1 FROM vision7_trial_entitlements t WHERE t.license_id=l.id) trial_claimed
    FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
    LEFT JOIN orders o ON o.id=l.order_id
    WHERE l.key_hash=? AND p.code='v-record' AND p.active=1 LIMIT 1`).bind(await hashLicenseKey(licenseKey)).first();
  if (!license) return reject('ไม่พบคีย์ V-Record', 403);
  if (!((license.source === 'paid_order' && license.order_status === 'paid') || (license.source === 'trial' && license.trial_claimed))) return reject('คีย์นี้ไม่มีสิทธิ์ใช้งาน', 403);
  if (!['active', 'trial'].includes(license.status)) return reject('คีย์ถูกระงับหรือหมดอายุ', 403);
  const now = Math.floor(Date.now() / 1000), expires = epoch(license.expires_at);
  if (!Number.isSafeInteger(expires) || expires <= now) return reject('คีย์หมดอายุ', 410);
  const deviceHash = await sha256(deviceId);
  const known = await ctx.env.DB.prepare('SELECT revoked_at FROM vision7_license_devices WHERE license_id=? AND device_hash=?').bind(license.id, deviceHash).first();
  if (known?.revoked_at || (refresh && !known)) return reject('เครื่องนี้ไม่ได้รับอนุญาต', 403);
  const result = await ctx.env.DB.prepare(`INSERT INTO vision7_license_devices(license_id,device_hash,device_name,platform,app_version)
    SELECT ?,?,'V-Record','windows','0.6.0' WHERE
      EXISTS(SELECT 1 FROM vision7_license_devices WHERE license_id=? AND device_hash=? AND revoked_at IS NULL)
      OR (SELECT COUNT(*) FROM vision7_license_devices WHERE license_id=? AND revoked_at IS NULL)<1
    ON CONFLICT(license_id,device_hash) DO UPDATE SET last_seen_at=CURRENT_TIMESTAMP WHERE vision7_license_devices.revoked_at IS NULL`)
    .bind(license.id, deviceHash, license.id, deviceHash, license.id).run();
  if (!result.meta?.changes) return reject('คีย์นี้ใช้ครบ 1 เครื่องแล้ว', 409);
  const payload = new TextEncoder().encode(JSON.stringify({ v: 1, product: 'v-record', licenseId: license.id, deviceId, issuedAt: now, expiresAt: expires, leaseUntil: Math.min(expires, now + 7 * day), generation: 1 }));
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signer, payload));
  return json({ payload: base64(payload), signature: base64(signature) }, 200, noStore);
}
