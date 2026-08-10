import {ensureVision7KeyCenterSchema} from './_vision7_key_center.js';

export async function ensureVEasyShopSchema(env){
  await ensureVision7KeyCenterSchema(env);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS veasy_shops (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,license_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,meta_page_id TEXT NOT NULL UNIQUE,meta_page_name TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(license_id) REFERENCES vision7_licenses(id) ON DELETE RESTRICT,CHECK(status IN ('active','suspended','disconnected')))`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_veasy_shop_owner ON veasy_shops(user_id,status,updated_at DESC)').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_veasy_shop_owner_chain ON veasy_shops(id,user_id,license_id,meta_page_id)').run();
}

export const cleanShopName=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,120);
export const cleanPageName=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,120);
export const cleanMetaPageId=value=>/^\d{5,40}$/.test(String(value||'').trim())?String(value).trim():'';

export async function ownedVEasyLicense(env,userId,keyHash){
  return env.DB.prepare(`SELECT l.id,l.user_id,l.status,l.expires_at,l.binding_state,p.platform_type,p.active program_active FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id WHERE l.key_hash=? AND l.user_id=? AND p.platform_type='veasy'`).bind(keyHash,userId).first();
}

export async function ownedShopByLicense(env,userId,licenseId){
  return env.DB.prepare(`SELECT s.id,s.user_id,s.license_id,s.name,s.meta_page_id,s.meta_page_name,s.status,s.created_at,s.updated_at FROM veasy_shops s JOIN vision7_licenses l ON l.id=s.license_id WHERE s.license_id=? AND s.user_id=? AND l.user_id=s.user_id`).bind(licenseId,userId).first();
}
