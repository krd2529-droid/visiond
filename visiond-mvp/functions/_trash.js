const mediaKey = (url) => url?.startsWith('/api/media/') ? url.slice('/api/media/'.length) : '';

async function isProductMediaReferenced(db,key){
  if(!key)return false;
  const url=`/api/media/${key}`;
  return Boolean(await db.prepare(`SELECT 1 FROM (
    SELECT 1 FROM products WHERE deleted_at IS NULL AND cover_url=?
    UNION ALL SELECT 1 FROM products WHERE deleted_at IS NULL AND json_valid(preview_urls) AND json_extract(preview_urls,'$[0]')=?
    UNION ALL SELECT 1 FROM products WHERE deleted_at IS NULL AND json_valid(preview_urls) AND json_extract(preview_urls,'$[1]')=?
    UNION ALL SELECT 1 FROM products WHERE deleted_at IS NULL AND json_valid(preview_urls) AND json_extract(preview_urls,'$[2]')=?
  ) LIMIT 1`).bind(url,url,url,url).first());
}

export async function purgeExpiredTrash(env,{trashBatchSize=20,productBatchSize=10}={}) {
  trashBatchSize=Math.max(1,Math.min(20,Number(trashBatchSize)||20));productBatchSize=Math.max(1,Math.min(10,Number(productBatchSize)||10));
  const {results: items=[]} = await env.DB.prepare("SELECT id,item_type,product_id,object_key FROM trash_items WHERE expires_at<=datetime('now') ORDER BY expires_at,id LIMIT ?").bind(trashBatchSize).all();
  let removedItems=0;
  for (const item of items) {
    const result=await permanentlyDeleteTrashItem(env,item,{deferReferenced:true});if(!result.preserved_reference)removedItems++;
  }
  const {results: products=[]} = await env.DB.prepare("SELECT * FROM products WHERE deleted_at IS NOT NULL AND deleted_at<=datetime('now','-30 days') AND COALESCE(product_kind,'product')='product' AND category<>'resale-rights' ORDER BY deleted_at,id LIMIT ?").bind(productBatchSize).all();
  for (const product of products) await permanentlyDeleteProduct(env, product);
  return {trash_items_removed:removedItems,products_processed:products.length,has_more:items.length===trashBatchSize||products.length===productBatchSize};
}

export async function permanentlyDeleteProduct(env, product) {
  if(String(product.product_kind||'product')!=='product'||product.category==='resale-rights')return {preserved_service:true};
  // Keep purchased products as hidden tombstones so order history and foreign
  // keys remain intact. Keep their paid files/bundle links too: an old buyer
  // must not lose a download merely because the product was removed from sale.
  const bundleLink=await env.DB.prepare('SELECT bundle_product_id FROM product_bundle_items WHERE source_product_id=? LIMIT 1').bind(product.id).first();
  if(bundleLink){await env.DB.prepare("UPDATE products SET status='draft',deleted_at='9999-12-31 23:59:59',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(product.id).run();return {preserved_bundle:true}}
  const orderReference = await env.DB.prepare(`SELECT 1 found FROM order_items WHERE product_id=?
    UNION ALL SELECT 1 FROM product_bundle_items b
      WHERE b.source_product_id=? AND (EXISTS(SELECT 1 FROM order_items oi WHERE oi.product_id=b.bundle_product_id) OR EXISTS(SELECT 1 FROM entitlements e WHERE e.product_id=b.bundle_product_id AND e.active=1))
    LIMIT 1`).bind(product.id,product.id).first();
  if (orderReference) {
    await env.DB.prepare("UPDATE products SET status='draft',deleted_at='9999-12-31 23:59:59',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(product.id).run();
    return {preserved_purchase:true};
  }
  const {results: files=[]} = await env.DB.prepare('SELECT id,object_key FROM product_files WHERE product_id=?').bind(product.id).all();
  for (const file of files) {
    await env.DB.prepare('DELETE FROM downloads WHERE product_file_id=?').bind(file.id).run();
    await env.FILES.delete(file.object_key);
  }
  let previews=[];
  try { previews=JSON.parse(product.preview_urls||'[]'); } catch {}
  if (product.source!=='bundle') for (const key of new Set([product.cover_url,...previews].map(mediaKey).filter(Boolean))) if(!await isProductMediaReferenced(env.DB,key))await env.FILES.delete(key);
  await env.DB.prepare('DELETE FROM entitlements WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM unlock_logs WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM product_bundle_items WHERE bundle_product_id=? OR source_product_id=?').bind(product.id,product.id).run();
  await env.DB.prepare('DELETE FROM product_files WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM product_slug_history WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM products WHERE id=?').bind(product.id).run();
  return {deleted:true};
}

export async function permanentlyDeleteTrashItem(env,item,{deferReferenced=false}={}){
  if(item.item_type==='product_image'&&await isProductMediaReferenced(env.DB,item.object_key)){
    if(deferReferenced)await env.DB.prepare("UPDATE trash_items SET expires_at=datetime('now','+1 day') WHERE id=?").bind(item.id).run();
    return {preserved_reference:true,deferred:deferReferenced};
  }
  if(item.object_key)await env.FILES.delete(item.object_key);
  await env.DB.prepare('DELETE FROM trash_items WHERE id=?').bind(item.id).run();
  return {deleted:true};
}

export async function putTrash(env, item) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS trash_items (id INTEGER PRIMARY KEY AUTOINCREMENT,item_type TEXT NOT NULL,title TEXT NOT NULL,product_id INTEGER,object_key TEXT,payload TEXT NOT NULL DEFAULT '{}',deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL DEFAULT (datetime('now','+30 days')))").run();
  return env.DB.prepare("INSERT INTO trash_items(item_type,title,product_id,object_key,payload,deleted_at,expires_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,datetime('now','+30 days')) RETURNING *")
    .bind(item.item_type,item.title,item.product_id||null,item.object_key||null,JSON.stringify(item.payload||{})).first();
}
