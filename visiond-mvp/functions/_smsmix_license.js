import { json, sha256 } from './_lib.js';
import { hashLicenseKey } from './_vision7.js';
import { rateLimitIdentityAtomic, requestIp } from './_security.js';

const privateHeaders = { 'cache-control': 'private, no-store' };
// Only a key with a durable first-bind marker may retain a legacy NULL (lifetime) expiry.
const legacyLifetimeExpiry = '9999-12-31 23:59:59';
const invalid = () => json({ ok: false, code: 'SMSMIX_LICENSE_INVALID' }, 403, privateHeaders);
const boundElsewhere = () => json({ ok: false, code: 'SMSMIX_BOUND_OTHER_DEVICE' }, 409, privateHeaders);

async function input(ctx) {
  const body = await ctx.request.json().catch(() => ({}));
  const key = String(body.key || '').trim();
  const deviceId = String(body.device_id || '').trim();
  if (key.length < 12 || key.length > 200 || deviceId.length < 8 || deviceId.length > 200) return null;
  const deviceName = String(body.device_name || 'Android').normalize('NFKC')
    .replace(/[\x00-\x1f\x7f<>]/g, ' ').trim().slice(0, 80) || 'Android';
  return { key, deviceName, deviceHash: await sha256(deviceId), keyHash: await hashLicenseKey(key) };
}

async function license(env, keyHash) {
  return env.DB.prepare(`SELECT l.id,l.status,l.expires_at,l.smsmix_first_activated_at,l.smsmix_pending_days,p.active program_active,b.device_hash
    FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
    LEFT JOIN vision7_smsmix_bindings b ON b.license_id=l.id
    WHERE l.key_hash=? AND p.code='sms-mix' AND p.platform_type='android'`)
    .bind(keyHash).first();
}

function current(row) {
  return row && row.status === 'active' && Number(row.program_active) === 1 &&
    (!row.expires_at || Date.parse(String(row.expires_at).replace(' ', 'T') + 'Z') > Date.now());
}

export async function activateSmsMix(ctx) {
  const data = await input(ctx);
  if (!data) return json({ ok: false, code: 'SMSMIX_INPUT_INVALID' }, 400, privateHeaders);
  const ipLimited = await rateLimitIdentityAtomic(ctx.env, 'smsmix-activate-ip', requestIp(ctx.request), { limit: 30, windowMinutes: 15, blockMinutes: 15 });
  if (ipLimited.error) return json({ ok: false, code: 'SMSMIX_RATE_LIMIT' }, 429, { ...privateHeaders, 'retry-after': String(ipLimited.retryAfter) });
  const limited = await rateLimitIdentityAtomic(ctx.env, 'smsmix-activate', data.keyHash, { limit: 12, windowMinutes: 15, blockMinutes: 15 });
  if (limited.error) return json({ ok: false, code: 'SMSMIX_RATE_LIMIT' }, 429, { ...privateHeaders, 'retry-after': String(limited.retryAfter) });
  const row = await license(ctx.env, data.keyHash);
  if (!current(row) || (!row.smsmix_first_activated_at && Number(row.smsmix_pending_days) <= 0)) return invalid();
  if (row.device_hash && row.device_hash !== data.deviceHash) return boundElsewhere();
  const startTerm = ctx.env.DB.prepare(`UPDATE vision7_licenses SET
      smsmix_first_activated_at=CURRENT_TIMESTAMP,
      expires_at=CASE WHEN expires_at>datetime('now','+' || smsmix_pending_days || ' days') THEN expires_at ELSE datetime('now','+' || smsmix_pending_days || ' days') END,
      smsmix_pending_days=0,updated_at=CURRENT_TIMESTAMP
    WHERE id=? AND status='active' AND smsmix_first_activated_at IS NULL AND smsmix_pending_days>0
      AND (expires_at IS NULL OR expires_at>datetime('now'))
      AND NOT EXISTS(SELECT 1 FROM vision7_smsmix_bindings WHERE license_id=?)`).bind(row.id,row.id);
  const bindDevice = ctx.env.DB.prepare(`INSERT INTO vision7_smsmix_bindings(license_id,device_hash,device_name,generation,activated_at)
    SELECT l.id,?,?,1,CURRENT_TIMESTAMP FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
    WHERE l.id=? AND l.status='active' AND (l.expires_at>datetime('now') OR (l.expires_at IS NULL AND l.smsmix_pending_days=0)) AND l.smsmix_first_activated_at IS NOT NULL
      AND p.code='sms-mix' AND p.platform_type='android' AND p.active=1
    ON CONFLICT(license_id) DO UPDATE SET device_name=excluded.device_name
    WHERE vision7_smsmix_bindings.device_hash=excluded.device_hash`).bind(data.deviceHash,data.deviceName,row.id);
  // A competing device makes the binding insert a no-op; force rollback of the
  // first-term update in the same transaction instead of starting an unusable term.
  const assertBound = ctx.env.DB.prepare(`INSERT INTO vision7_programs(id,code)
    SELECT p.id,p.code FROM vision7_programs p WHERE p.code='sms-mix' AND NOT EXISTS (
      SELECT 1 FROM vision7_smsmix_bindings b WHERE b.license_id=? AND b.device_hash=?)`)
    .bind(row.id,data.deviceHash);
  try { await ctx.env.DB.batch([startTerm,bindDevice,assertBound]); }
  catch {
    const after = await license(ctx.env, data.keyHash);
    return current(after) && after.device_hash && after.device_hash !== data.deviceHash ? boundElsewhere() : invalid();
  }
  const stillCurrent = await currentBinding(ctx.env, data.keyHash, data.deviceHash);
  if (!stillCurrent) return invalid();
  await ctx.env.DB.prepare(`INSERT INTO vision7_license_events(license_id,actor_user_id,event_type,detail)
    VALUES(?,NULL,'smsmix_device_activated','{}')`).bind(row.id).run();
  return json({ ok: true, status: 'active', expires_at: stillCurrent.expires_at || legacyLifetimeExpiry, activated_at: stillCurrent.smsmix_first_activated_at, server_time: Date.now(), generation: Number(stillCurrent.generation) }, 200, privateHeaders);
}

async function currentBinding(env, keyHash, deviceHash) {
  const row = await env.DB.prepare(`SELECT l.id,l.user_id,l.status,l.expires_at,l.smsmix_first_activated_at,l.smsmix_pending_days,p.active program_active,b.device_hash,b.generation
    FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
    LEFT JOIN vision7_smsmix_bindings b ON b.license_id=l.id
    WHERE l.key_hash=? AND p.code='sms-mix' AND p.platform_type='android'`).bind(keyHash).first();
  return current(row) && row.smsmix_first_activated_at && (row.expires_at || Number(row.smsmix_pending_days)===0) && row.device_hash === deviceHash ? row : null;
}

export async function authenticatedSmsMixBinding(env, key, deviceId) {
  if (typeof key !== 'string' || key.length < 12 || key.length > 200 ||
      typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 200) return null;
  return currentBinding(env, await hashLicenseKey(key.trim()), await sha256(deviceId.trim()));
}

export async function checkSmsMix(ctx) {
  const data = await input(ctx);
  if (!data) return json({ ok: false, code: 'SMSMIX_INPUT_INVALID' }, 400, privateHeaders);
  const row = await currentBinding(ctx.env, data.keyHash, data.deviceHash);
  if (!row) return invalid();
  return json({ ok: true, status: 'active', expires_at: row.expires_at || legacyLifetimeExpiry, activated_at: row.smsmix_first_activated_at, server_time: Date.now(), generation: Number(row.generation) }, 200, privateHeaders);
}
