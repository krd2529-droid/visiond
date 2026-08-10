import {ensureVision7KeyCenterSchema} from './_vision7_key_center.js';

export async function ensureVEasyShopSchema(env){
  await ensureVision7KeyCenterSchema(env);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS veasy_shops (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,license_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,meta_page_id TEXT NOT NULL UNIQUE,meta_page_name TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(license_id) REFERENCES vision7_licenses(id) ON DELETE RESTRICT,CHECK(status IN ('active','suspended','disconnected')))`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_veasy_shop_owner ON veasy_shops(user_id,status,updated_at DESC)').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_veasy_shop_owner_chain ON veasy_shops(id,user_id,license_id,meta_page_id)').run();
  await env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_veasy_shop_license_platform_insert BEFORE INSERT ON veasy_shops
    WHEN NOT EXISTS(
      SELECT 1 FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
      WHERE l.id=NEW.license_id AND l.user_id=NEW.user_id AND lower(p.platform_type)='veasy'
    ) BEGIN SELECT RAISE(ABORT,'VEASY_LICENSE_REQUIRED'); END`).run();
  await env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_veasy_shop_license_platform_update BEFORE UPDATE OF license_id,user_id ON veasy_shops
    WHEN NOT EXISTS(
      SELECT 1 FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id
      WHERE l.id=NEW.license_id AND l.user_id=NEW.user_id AND lower(p.platform_type)='veasy'
    ) BEGIN SELECT RAISE(ABORT,'VEASY_LICENSE_REQUIRED'); END`).run();
  const columns=(await env.DB.prepare('PRAGMA table_info(veasy_shops)').all()).results||[];
  if(!columns.some(column=>column.name==='plan_limit'))await env.DB.prepare('ALTER TABLE veasy_shops ADD COLUMN plan_limit INTEGER NOT NULL DEFAULT 20').run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS veasy_categories (id TEXT PRIMARY KEY,shop_id TEXT NOT NULL,name TEXT NOT NULL,slug TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,UNIQUE(shop_id,slug))`).run();
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS veasy_products (id TEXT PRIMARY KEY,shop_id TEXT NOT NULL,category_id TEXT NOT NULL,idempotency_key TEXT NOT NULL,sku TEXT NOT NULL,slug TEXT NOT NULL,name TEXT NOT NULL,short_description TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',specifications TEXT NOT NULL DEFAULT '',warranty TEXT NOT NULL DEFAULT '',shipping_detail TEXT NOT NULL DEFAULT '',price INTEGER NOT NULL CHECK(price>=0),stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0),status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft','active','hidden')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(shop_id) REFERENCES veasy_shops(id) ON DELETE CASCADE,FOREIGN KEY(category_id) REFERENCES veasy_categories(id) ON DELETE RESTRICT,UNIQUE(shop_id,sku),UNIQUE(shop_id,slug),UNIQUE(shop_id,idempotency_key))`).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_veasy_products_shop ON veasy_products(shop_id,status,created_at DESC)').run();
}

export const cleanShopName=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,120);
export const cleanPageName=value=>String(value||'').trim().replace(/\s+/g,' ').slice(0,120);
export const cleanMetaPageId=value=>/^\d{5,40}$/.test(String(value||'').trim())?String(value).trim():'';
export const cleanCatalogText=(value,max=180)=>String(value||'').trim().replace(/\s+/g,' ').slice(0,max);
export const cleanCatalogSlug=value=>String(value||'').trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);

export async function ownedVEasyLicense(env,userId,keyHash){
  return env.DB.prepare(`SELECT l.id,l.user_id,l.status,l.expires_at,l.binding_state,p.platform_type,p.active program_active FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id WHERE l.key_hash=? AND l.user_id=? AND p.platform_type='veasy'`).bind(keyHash,userId).first();
}

export async function ownedShopByLicense(env,userId,licenseId){
  return env.DB.prepare(`SELECT s.id,s.user_id,s.license_id,s.name,s.meta_page_id,s.meta_page_name,s.status,s.created_at,s.updated_at FROM veasy_shops s JOIN vision7_licenses l ON l.id=s.license_id WHERE s.license_id=? AND s.user_id=? AND l.user_id=s.user_id`).bind(licenseId,userId).first();
}
