const ready = new WeakMap();
export const noStore = {'cache-control':'private, no-store'};

export async function ensureToyPostSchema(env) {
  let task = ready.get(env.DB);
  if (!task) {
    task = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS toy_post_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        destinations TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`).run();
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS toy_post_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        line_id INTEGER NOT NULL REFERENCES toy_post_lines(id),
        detail TEXT NOT NULL,
        photo_key TEXT UNIQUE,
        photo_type TEXT,
        deleted_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`).run();
      await env.DB.prepare('CREATE INDEX IF NOT EXISTS toy_post_products_line_active_id ON toy_post_products(line_id, deleted_at, id)').run();
    })().catch(error => { ready.delete(env.DB); throw error; });
    ready.set(env.DB, task);
  }
  return task;
}

export function destinations(value) {
  if (!Array.isArray(value) || value.length > 20) return null;
  const items = [];
  for (const item of value) {
    const name = String(item?.name || '').trim();
    const url = String(item?.url || '').trim();
    const type = String(item?.type || 'page');
    if (!name || name.length > 120 || !['page','group'].includes(type) || !/^https:\/\/(?:www\.|web\.|m\.)?facebook\.com\//i.test(url) || url.length > 500) return null;
    items.push({type, name, url});
  }
  return items;
}

export function photoUrl(id) { return `/api/admin/toy-post-products/${id}/photo`; }
