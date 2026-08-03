export async function ensureDatabase(env) {
  if (!env.DB) throw new Error('D1_NOT_CONNECTED');

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL UNIQUE,username TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,short_description TEXT,description TEXT,price INTEGER NOT NULL,cover_url TEXT,preview_urls TEXT DEFAULT '[]',category TEXT DEFAULT 'digital-product',status TEXT NOT NULL DEFAULT 'draft',source TEXT NOT NULL DEFAULT 'manual',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,parent_slug TEXT,file_type TEXT NOT NULL DEFAULT 'PDF',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS product_files (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,label TEXT NOT NULL,object_key TEXT NOT NULL,mime_type TEXT DEFAULT 'application/pdf',file_size INTEGER DEFAULT 0,version TEXT DEFAULT '1.0',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,order_no TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'awaiting_payment',slip_key TEXT,transfer_note TEXT,admin_note TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_title TEXT,price INTEGER NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products(id))`,
    `CREATE TABLE IF NOT EXISTS entitlements (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,product_id INTEGER NOT NULL,order_id INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,product_id,order_id),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(product_id) REFERENCES products(id),FOREIGN KEY(order_id) REFERENCES orders(id))`,
    `CREATE TABLE IF NOT EXISTS unlock_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,actor_user_id INTEGER NOT NULL,actor_name TEXT NOT NULL,actor_role TEXT NOT NULL,target_user_id INTEGER NOT NULL,target_name TEXT NOT NULL,product_id INTEGER NOT NULL,product_title TEXT NOT NULL,order_id INTEGER NOT NULL,order_no TEXT NOT NULL,method TEXT NOT NULL DEFAULT 'manual',note TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ad_costs (spend_date TEXT PRIMARY KEY,facebook_cost INTEGER NOT NULL DEFAULT 0,note TEXT,updated_by INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS downloads (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,product_file_id INTEGER NOT NULL,downloaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,ip TEXT,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(product_file_id) REFERENCES product_files(id))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS prompt_usage_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,user_name TEXT NOT NULL,user_role TEXT NOT NULL,project_name TEXT NOT NULL DEFAULT '',topic TEXT NOT NULL DEFAULT '',image_count INTEGER NOT NULL DEFAULT 0,prompt_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id))`
  ];

  for (const statement of statements) await env.DB.prepare(statement).run();

  const columns = (await env.DB.prepare('PRAGMA table_info(users)').all()).results.map(column => column.name);
  if (!columns.includes('username')) await env.DB.prepare('ALTER TABLE users ADD COLUMN username TEXT').run();
  if (!columns.includes('phone')) await env.DB.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_unlock_logs_created ON unlock_logs(created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_unlock_logs_target ON unlock_logs(target_user_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_costs_date ON ad_costs(spend_date DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_prompt_usage_created ON prompt_usage_logs(created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_prompt_usage_user ON prompt_usage_logs(user_id)').run();
  const productColumns = (await env.DB.prepare('PRAGMA table_info(products)').all()).results.map(column => column.name);
  if (!productColumns.includes('file_type')) await env.DB.prepare("ALTER TABLE products ADD COLUMN file_type TEXT DEFAULT 'PDF'").run();
  const orderItemColumns = (await env.DB.prepare('PRAGMA table_info(order_items)').all()).results.map(column => column.name);
  if (!orderItemColumns.includes('product_title')) await env.DB.prepare('ALTER TABLE order_items ADD COLUMN product_title TEXT').run();
  await env.DB.prepare('UPDATE order_items SET product_title=(SELECT title FROM products WHERE products.id=order_items.product_id) WHERE product_title IS NULL').run();
  await env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_order_item_product_title AFTER INSERT ON order_items WHEN NEW.product_title IS NULL BEGIN UPDATE order_items SET product_title=(SELECT title FROM products WHERE id=NEW.product_id) WHERE id=NEW.id; END`).run();
  const orderColumns = (await env.DB.prepare('PRAGMA table_info(orders)').all()).results.map(column => column.name);
  if (!orderColumns.includes('sale_price_recorded')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN sale_price_recorded INTEGER NOT NULL DEFAULT 1').run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('coloring','ภาพระบายสี',NULL,'PDF',1,10)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('dinosaur','ไดโนเสาร์','coloring','PDF',1,11)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('paper-doll','ตุ๊กตากระดาษ',NULL,'PDF',1,20)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('document','เอกสารและแบบฟอร์ม',NULL,'PDF',1,30)").run();
}
