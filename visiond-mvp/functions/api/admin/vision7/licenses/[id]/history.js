import { json, requireAdmin } from '../../../../../_lib.js';
import { ensureDatabase } from '../../../../../_schema.js';
import { ensureVision7Schema } from '../../../../../_vision7_schema.js';

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  const a = await requireAdmin(ctx);
  if (a.error) return a.error;
  const license = await ctx.env.DB.prepare(`SELECT l.id,l.key_last4,l.status,l.expires_at,u.name user_name,u.email,p.code program_code,
    b.device_name smsmix_device_name,substr(b.device_hash,-8) smsmix_hash_suffix,
    b.generation smsmix_generation,b.activated_at smsmix_activated_at
    FROM vision7_licenses l JOIN users u ON u.id=l.user_id JOIN vision7_programs p ON p.id=l.program_id
    LEFT JOIN vision7_smsmix_bindings b ON p.code='sms-mix' AND b.license_id=l.id
    WHERE l.id=?`).bind(String(ctx.params.id)).first();
  if (!license) return json({ error: 'ไม่พบคีย์' }, 404);
  const events = await ctx.env.DB.prepare(`SELECT e.id,e.event_type,e.detail,e.created_at,u.name actor_name,u.role actor_role
    FROM vision7_license_events e LEFT JOIN users u ON u.id=e.actor_user_id
    WHERE e.license_id=? ORDER BY e.id DESC LIMIT 300`).bind(license.id).all();
  const devices = license.program_code === 'sms-mix' ? (license.smsmix_hash_suffix ? [{
    id: null, device_name: license.smsmix_device_name, platform: 'Android',
    hash_suffix: license.smsmix_hash_suffix, generation: license.smsmix_generation,
    activated_at: license.smsmix_activated_at, last_seen_at: null, revoked_at: null
  }] : []) : (await ctx.env.DB.prepare(`SELECT id,device_name,platform,app_version,activated_at,last_seen_at,revoked_at
    FROM vision7_license_devices WHERE license_id=? ORDER BY id DESC`).bind(license.id).all()).results || [];
  return json({ license: { ...license, key_masked: `VD7-••••-••••-${license.key_last4}` },
    events: events.results || [], devices }, 200, { 'cache-control': 'no-store' });
}
