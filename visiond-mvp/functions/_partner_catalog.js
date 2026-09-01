const ready=new WeakMap();

export async function ensurePartnerCatalogSchema(env){
  let pending=ready.get(env.DB);if(pending)return pending;
  pending=(async()=>{
    await env.DB.exec(`CREATE TABLE IF NOT EXISTS partner_product_changes (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,action TEXT NOT NULL CHECK(action IN ('upsert','delete')),changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);CREATE INDEX IF NOT EXISTS idx_partner_product_changes_cursor ON partner_product_changes(id);`);
    await env.DB.prepare(`INSERT INTO partner_product_changes(product_id,action) SELECT p.id,CASE WHEN p.status='published' AND p.deleted_at IS NULL AND COALESCE(p.product_kind,'product') IN ('product','vision7-key') AND p.category<>'resale-rights' THEN 'upsert' ELSE 'delete' END FROM products p WHERE NOT EXISTS(SELECT 1 FROM partner_product_changes c WHERE c.product_id=p.id)`).run();
    await env.DB.exec(`CREATE TRIGGER IF NOT EXISTS partner_products_insert AFTER INSERT ON products BEGIN INSERT INTO partner_product_changes(product_id,action) VALUES(NEW.id,CASE WHEN NEW.status='published' AND NEW.deleted_at IS NULL AND COALESCE(NEW.product_kind,'product') IN ('product','vision7-key') AND NEW.category<>'resale-rights' THEN 'upsert' ELSE 'delete' END);END;CREATE TRIGGER IF NOT EXISTS partner_products_update AFTER UPDATE ON products BEGIN INSERT INTO partner_product_changes(product_id,action) VALUES(NEW.id,CASE WHEN NEW.status='published' AND NEW.deleted_at IS NULL AND COALESCE(NEW.product_kind,'product') IN ('product','vision7-key') AND NEW.category<>'resale-rights' THEN 'upsert' ELSE 'delete' END);END;CREATE TRIGGER IF NOT EXISTS partner_products_delete AFTER DELETE ON products BEGIN INSERT INTO partner_product_changes(product_id,action) VALUES(OLD.id,'delete');END;`);
    return true;
  })().catch(error=>{ready.delete(env.DB);throw error});ready.set(env.DB,pending);return pending;
}

export const partnerPreviews=value=>{try{const parsed=JSON.parse(value||'[]');return Array.isArray(parsed)?parsed.filter(url=>/^https?:\/\/|^\//.test(String(url))).slice(0,10):[]}catch{return []}};
export const partnerAssets=item=>[item.cover_url,...partnerPreviews(item.preview_urls)].filter(Boolean).filter((url,index,all)=>all.indexOf(url)===index).map((source_url,index)=>({kind:index?'preview':'cover',source_url}));
