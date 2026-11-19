import { json } from '../../_lib.js';
import { ensureDatabase } from '../../_schema.js';
import { ensureVision7Schema } from '../../_vision7_schema.js';
import { requireVision7User as requireUser } from '../../_vision7_auth.js';
import { maskedLicense, refreshLicenseExpiry } from '../../_vision7.js';
import { decryptVision7Key, vision7LicenseEncryptionConfigured } from '../../_vision7_license_crypto.js';
import { ensureAutoInviteSchema } from '../../_auto_invite.js';

export const autoInviteCustomerPageSql = `SELECT oi.id order_item_id,oi.order_id,oi.product_title,p.current_version,
    i.machine_id,i.key_ciphertext,i.issued_at,r.id release_id,r.version release_version,r.file_name,r.file_size,r.sha256
    FROM orders o INDEXED BY idx_orders_user_id
    CROSS JOIN order_items oi INDEXED BY idx_order_items_order_product
    JOIN vision7_plans q ON q.product_id=oi.product_id AND q.plan_code='lifetime'
    JOIN vision7_programs p ON p.id=q.program_id AND p.code='auto-invite'
    LEFT JOIN auto_invite_issues i ON i.order_item_id=oi.id
    LEFT JOIN vision7_releases r ON r.id=(SELECT id FROM vision7_releases WHERE program_id=p.id AND status='published' ORDER BY published_at DESC,id DESC LIMIT 1)
    WHERE o.user_id=? AND o.status='paid' AND oi.order_id=o.id AND oi.price=69000 AND (? IS NULL OR oi.id<?)
    ORDER BY oi.id DESC LIMIT 25`;

export async function onRequestGet(ctx) {
  await ensureDatabase(ctx.env);
  await ensureVision7Schema(ctx.env);
  await ensureAutoInviteSchema(ctx.env);
  const a = await requireUser(ctx);
  if (a.error) return a.error;
  const rows = await ctx.env.DB.prepare(`SELECT l.*,p.code,p.platform_type,p.current_version,p.minimum_version,p.force_update,p.requires_online,
    COALESCE(x.title,px.title) title,COALESCE(x.cover_url,px.cover_url) cover_url,q.name plan_name,
    b.device_name smsmix_device_name,substr(b.device_hash,-8) smsmix_hash_suffix,
    b.generation smsmix_generation,b.activated_at smsmix_activated_at
    FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
    LEFT JOIN products x ON x.id=p.product_id LEFT JOIN vision7_plans q ON q.id=l.plan_id
    LEFT JOIN products px ON px.id=q.product_id
    LEFT JOIN vision7_smsmix_bindings b ON p.code='sms-mix' AND b.license_id=l.id
    WHERE l.user_id=? ORDER BY l.created_at DESC`).bind(a.user.id).all();
  const items = [];
  for (let row of rows.results || []) {
    row = await refreshLicenseExpiry(ctx.env, row);
    const d = row.code === 'sms-mix' ? { results: row.smsmix_hash_suffix ? [{
      id: null, device_name: row.smsmix_device_name, platform: 'Android',
      hash_suffix: row.smsmix_hash_suffix, generation: row.smsmix_generation,
      activated_at: row.smsmix_activated_at
    }] : [] } : await ctx.env.DB.prepare(`SELECT id,device_name,platform,app_version,activated_at,last_seen_at
      FROM vision7_license_devices WHERE license_id=? AND revoked_at IS NULL ORDER BY last_seen_at DESC`).bind(row.id).all();
    const release = await ctx.env.DB.prepare(`SELECT id,version,minimum_version,mandatory,file_name,file_size,sha256,release_notes,published_at
      FROM vision7_releases WHERE program_id=? AND status='published' ORDER BY published_at DESC,id DESC LIMIT 1`).bind(row.program_id).first();
    let key = null;
    if (row.key_ciphertext && vision7LicenseEncryptionConfigured(ctx.env)) {
      try { key = await decryptVision7Key(ctx.env, row.key_ciphertext); } catch {}
    }
    items.push({ ...row, key, key_masked: maskedLicense(row), key_ciphertext: undefined,
      key_hash: undefined, devices: d.results || [], release: release ? {
        ...release, download_url: `/api/vision7/releases/${release.id}/download`
      } : null });
  }
  const rawCursor = new URL(ctx.request.url).searchParams.get('auto_invite_cursor');
  const cursor = rawCursor && /^[1-9]\d*$/.test(rawCursor) ? Number(rawCursor) : null;
  if (rawCursor !== null && (cursor === null || !Number.isSafeInteger(cursor)))
    return json({ error:'cursor ไม่ถูกต้อง' },400,{'cache-control':'private, no-store'});
  const autoRows = (await ctx.env.DB.prepare(autoInviteCustomerPageSql).bind(a.user.id,cursor,cursor).all()).results || [];
  const autoInviteItems = [];
  for (const row of autoRows.slice(0,24)) {
    let key = null;
    if (row.key_ciphertext && vision7LicenseEncryptionConfigured(ctx.env)) {
      try { key = await decryptVision7Key(ctx.env,row.key_ciphertext); } catch {}
    }
    autoInviteItems.push({ order_item_id:row.order_item_id,order_id:row.order_id,title:row.product_title,
      current_version:row.current_version,machine_id:row.machine_id,issued_at:row.issued_at,key,
      release:row.release_id?{id:row.release_id,version:row.release_version,file_name:row.file_name,
        file_size:row.file_size,sha256:row.sha256,download_url:`/api/vision7/releases/${row.release_id}/download`}:null });
  }
  return json({ items, auto_invite_items:autoInviteItems,
    auto_invite_next_cursor:autoRows.length>24?autoRows[23].order_item_id:null,
    encryption_ready: vision7LicenseEncryptionConfigured(ctx.env) },200,{'cache-control':'private, no-store'});
}
