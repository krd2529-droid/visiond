import { json, sha256 } from './_lib.js';
import { hashLicenseKey } from './_vision7.js';
import { rateLimitIdentityAtomic, requestIp } from './_security.js';

const privateHeaders = { 'cache-control': 'private, no-store' };
const invalid = () => json({ ok: false, code: 'SMSMIX_LICENSE_INVALID' }, 403, privateHeaders);

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
  return env.DB.prepare(`SELECT l.id,l.status,l.expires_at,p.active program_active
    FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
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
  if (!current(row)) return invalid();
  const binding = await ctx.env.DB.prepare(`INSERT INTO vision7_smsmix_bindings(license_id,device_hash,device_name,generation,activated_at)
    SELECT l.id,?,?,1,CURRENT_TIMESTAMP FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
    WHERE l.id=? AND l.status='active' AND (l.expires_at IS NULL OR l.expires_at>datetime('now'))
      AND p.code='sms-mix' AND p.platform_type='android' AND p.active=1
    ON CONFLICT(license_id) DO UPDATE SET
      generation=vision7_smsmix_bindings.generation+CASE WHEN vision7_smsmix_bindings.device_hash=excluded.device_hash THEN 0 ELSE 1 END,
      device_hash=excluded.device_hash,device_name=excluded.device_name,activated_at=CURRENT_TIMESTAMP
    WHERE EXISTS(SELECT 1 FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
      WHERE l.id=excluded.license_id AND l.status='active' AND (l.expires_at IS NULL OR l.expires_at>datetime('now'))
        AND p.code='sms-mix' AND p.platform_type='android' AND p.active=1)
    RETURNING device_hash,generation`).bind(data.deviceHash, data.deviceName, row.id).first();
  if (!binding || binding.device_hash !== data.deviceHash) return invalid();
  const stillCurrent = await currentBinding(ctx.env, data.keyHash, data.deviceHash);
  if (!stillCurrent || Number(stillCurrent.generation) !== Number(binding.generation)) return invalid();
  await ctx.env.DB.prepare(`INSERT INTO vision7_license_events(license_id,actor_user_id,event_type,detail)
    VALUES(?,NULL,'smsmix_device_activated','{}')`).bind(row.id).run();
  return json({ ok: true, status: 'active', expires_at: stillCurrent.expires_at, generation: Number(binding.generation) }, 200, privateHeaders);
}

async function currentBinding(env, keyHash, deviceHash) {
  const row = await env.DB.prepare(`SELECT l.status,l.expires_at,p.active program_active,b.device_hash,b.generation
    FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
    LEFT JOIN vision7_smsmix_bindings b ON b.license_id=l.id
    WHERE l.key_hash=? AND p.code='sms-mix' AND p.platform_type='android'`).bind(keyHash).first();
  return current(row) && row.device_hash === deviceHash ? row : null;
}

export async function checkSmsMix(ctx) {
  const data = await input(ctx);
  if (!data) return json({ ok: false, code: 'SMSMIX_INPUT_INVALID' }, 400, privateHeaders);
  const row = await currentBinding(ctx.env, data.keyHash, data.deviceHash);
  if (!row) return invalid();
  return json({ ok: true, status: 'active', expires_at: row.expires_at, generation: Number(row.generation) }, 200, privateHeaders);
}
