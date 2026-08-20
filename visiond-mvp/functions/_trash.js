const mediaKey = (url) => url?.startsWith('/api/media/') ? url.slice('/api/media/'.length) : '';

export async function purgeExpiredTrash(env) {
  const {results: items=[]} = await env.DB.prepare("SELECT id,object_key FROM trash_items WHERE expires_at<=datetime('now') ORDER BY expires_at LIMIT 20").all();
  for (const item of items) {
    if (item.object_key) await env.FILES.delete(item.object_key);
    await env.DB.prepare('DELETE FROM trash_items WHERE id=?').bind(item.id).run();
  }
  const {results: products=[]} = await env.DB.prepare("SELECT * FROM products WHERE deleted_at IS NOT NULL AND deleted_at<=datetime('now','-30 days') ORDER BY deleted_at LIMIT 10").all();
  for (const product of products) await permanentlyDeleteProduct(env, product);
  return {trash_items_removed:items.length,products_processed:products.length};
}

export async function permanentlyDeleteProduct(env, product) {
  // Keep purchased products as hidden tombstones so order history and foreign
  // keys remain intact. Keep their paid files/bundle links too: an old buyer
  // must not lose a download merely because the product was removed from sale.
  const orderReference = await env.DB.prepare('SELECT 1 found FROM order_items WHERE product_id=? LIMIT 1').bind(product.id).first();
  if (orderReference) {
    await env.DB.prepare("UPDATE products SET status='draft',deleted_at='9999-12-31 23:59:59',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(product.id).run();
    return;
  }
  const {results: files=[]} = await env.DB.prepare('SELECT id,object_key FROM product_files WHERE product_id=?').bind(product.id).all();
  for (const file of files) {
    await env.DB.prepare('DELETE FROM downloads WHERE product_file_id=?').bind(file.id).run();
    await env.FILES.delete(file.object_key);
  }
  let previews=[];
  try { previews=JSON.parse(product.preview_urls||'[]'); } catch {}
  if (product.source!=='bundle') for (const key of new Set([product.cover_url,...previews].map(mediaKey).filter(Boolean))) await env.FILES.delete(key);
  await env.DB.prepare('DELETE FROM entitlements WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM unlock_logs WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM product_bundle_items WHERE bundle_product_id=? OR source_product_id=?').bind(product.id,product.id).run();
  await env.DB.prepare('DELETE FROM product_files WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM product_slug_history WHERE product_id=?').bind(product.id).run();
  await env.DB.prepare('DELETE FROM products WHERE id=?').bind(product.id).run();
}

export async function putTrash(env, item) {
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS trash_items (id INTEGER PRIMARY KEY AUTOINCREMENT,item_type TEXT NOT NULL,title TEXT NOT NULL,product_id INTEGER,object_key TEXT,payload TEXT NOT NULL DEFAULT '{}',deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL DEFAULT (datetime('now','+30 days')))").run();
  return env.DB.prepare("INSERT INTO trash_items(item_type,title,product_id,object_key,payload,deleted_at,expires_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP,datetime('now','+30 days')) RETURNING *")
    .bind(item.item_type,item.title,item.product_id||null,item.object_key||null,JSON.stringify(item.payload||{})).first();
}
