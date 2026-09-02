export async function ensureToysCenterSchema(env){
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS toys_center_settings (id INTEGER PRIMARY KEY CHECK(id=1),storefront_mode TEXT NOT NULL DEFAULT 'unlisted' CHECK(storefront_mode IN ('public','unlisted')),updated_by INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS toys_center_products (id INTEGER PRIMARY KEY AUTOINCREMENT,meta_id TEXT NOT NULL UNIQUE,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT NOT NULL,availability TEXT NOT NULL DEFAULT 'in stock',condition TEXT NOT NULL DEFAULT 'used',price_cents INTEGER NOT NULL DEFAULT 0,currency TEXT NOT NULL DEFAULT 'THB',brand TEXT NOT NULL,quantity INTEGER NOT NULL DEFAULT 1,image_1_key TEXT NOT NULL,image_2_key TEXT NOT NULL,google_product_category TEXT NOT NULL DEFAULT '',fb_product_category TEXT NOT NULL DEFAULT '',gtin TEXT NOT NULL DEFAULT '',item_group_id TEXT NOT NULL DEFAULT '',color TEXT NOT NULL DEFAULT '',size TEXT NOT NULL DEFAULT '',material TEXT NOT NULL DEFAULT '',pattern TEXT NOT NULL DEFAULT '',age_group TEXT NOT NULL DEFAULT '',gender TEXT NOT NULL DEFAULT '',product_tags TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'draft',created_by INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    env.DB.prepare("INSERT OR IGNORE INTO toys_center_settings(id,storefront_mode) VALUES(1,'unlisted')"),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_toys_center_status_updated ON toys_center_products(status,updated_at DESC,id DESC)')
  ]);
}
export const clean=(value,max=9999)=>String(value??'').trim().slice(0,max);
export const slugify=value=>clean(value,100).toLowerCase().replace(/[^a-z0-9ก-๙]+/g,'-').replace(/^-|-$/g,'')||`toy-${Date.now()}`;
export const mediaUrl=(origin,id,slot)=>`${origin}/api/toys-center/images/${encodeURIComponent(id)}/${slot}`;
export function publicProduct(row,origin){return {...row,price:Number(row.price_cents)/100,image_1_url:mediaUrl(origin,row.id,1),image_2_url:mediaUrl(origin,row.id,2),link:`${origin}/toyscenter?product=${encodeURIComponent(row.slug)}`}}
