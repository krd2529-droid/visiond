// Cloudflare reuses a Worker isolate for many requests. Schema compatibility
// checks only need to run once per D1 binding in that isolate, not on every API
// call. A rejected initialization is removed so the next request can retry.
const schemaReadyByDatabase=new WeakMap();
export async function ensureDatabase(env) {
  if (!env.DB) throw new Error('D1_NOT_CONNECTED');
  let ready=schemaReadyByDatabase.get(env.DB);
  if(!ready){
    ready=initializeDatabase(env).catch(error=>{schemaReadyByDatabase.delete(env.DB);throw error});
    schemaReadyByDatabase.set(env.DB,ready);
  }
  return ready;
}

async function initializeDatabase(env) {

  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL UNIQUE,username TEXT UNIQUE,name TEXT NOT NULL,phone TEXT,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,short_description TEXT,description TEXT,price INTEGER NOT NULL,cover_url TEXT,preview_urls TEXT DEFAULT '[]',category TEXT DEFAULT 'digital-product',pages INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'draft',source TEXT NOT NULL DEFAULT 'manual',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,name TEXT NOT NULL,parent_slug TEXT,file_type TEXT NOT NULL DEFAULT 'PDF',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS product_files (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL,label TEXT NOT NULL,object_key TEXT NOT NULL,mime_type TEXT DEFAULT 'application/pdf',file_size INTEGER DEFAULT 0,version TEXT DEFAULT '1.0',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS product_bundle_items (bundle_product_id INTEGER NOT NULL,source_product_id INTEGER NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(bundle_product_id,source_product_id),FOREIGN KEY(bundle_product_id) REFERENCES products(id) ON DELETE CASCADE,FOREIGN KEY(source_product_id) REFERENCES products(id) ON DELETE CASCADE)`,
    `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,order_no TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'awaiting_payment',slip_key TEXT,transfer_note TEXT,admin_note TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,product_id INTEGER NOT NULL,product_title TEXT,price INTEGER NOT NULL,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,FOREIGN KEY(product_id) REFERENCES products(id))`,
    `CREATE TABLE IF NOT EXISTS entitlements (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,product_id INTEGER NOT NULL,order_id INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,product_id,order_id),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(product_id) REFERENCES products(id),FOREIGN KEY(order_id) REFERENCES orders(id))`,
    `CREATE TABLE IF NOT EXISTS course_right_credits (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,product_id INTEGER NOT NULL,order_id INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1,granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,used_at TEXT,used_course_id INTEGER,source_entitlement_id INTEGER UNIQUE,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(product_id) REFERENCES products(id),FOREIGN KEY(order_id) REFERENCES orders(id))`,
    `CREATE TABLE IF NOT EXISTS category_memberships (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,category_slug TEXT NOT NULL,order_id INTEGER NOT NULL,starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,category_slug),FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(order_id) REFERENCES orders(id))`,
    `CREATE TABLE IF NOT EXISTS unlock_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,actor_user_id INTEGER NOT NULL,actor_name TEXT NOT NULL,actor_role TEXT NOT NULL,target_user_id INTEGER NOT NULL,target_name TEXT NOT NULL,product_id INTEGER NOT NULL,product_title TEXT NOT NULL,order_id INTEGER NOT NULL,order_no TEXT NOT NULL,method TEXT NOT NULL DEFAULT 'manual',note TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS ad_costs (spend_date TEXT PRIMARY KEY,facebook_cost INTEGER NOT NULL DEFAULT 0,note TEXT,updated_by INTEGER,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS downloads (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,product_file_id INTEGER NOT NULL,downloaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,ip TEXT,FOREIGN KEY(user_id) REFERENCES users(id),FOREIGN KEY(product_file_id) REFERENCES product_files(id))`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS prompt_usage_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,user_name TEXT NOT NULL,user_role TEXT NOT NULL,project_name TEXT NOT NULL DEFAULT '',topic TEXT NOT NULL DEFAULT '',image_count INTEGER NOT NULL DEFAULT 0,prompt_count INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id))`
    ,`CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL UNIQUE,subtitle TEXT,teacher_name TEXT,total_minutes INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS course_lessons (id INTEGER PRIMARY KEY AUTOINCREMENT,course_id INTEGER NOT NULL,title TEXT NOT NULL,description TEXT,sort_order INTEGER NOT NULL DEFAULT 0,video_key TEXT,pdf_key TEXT,video_mime TEXT,pdf_mime TEXT DEFAULT 'application/pdf',duration_seconds INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS course_lesson_files (id INTEGER PRIMARY KEY AUTOINCREMENT,lesson_id INTEGER NOT NULL,object_key TEXT NOT NULL UNIQUE,file_name TEXT NOT NULL,mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',file_size INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS course_progress (user_id INTEGER NOT NULL,course_id INTEGER NOT NULL,lesson_id INTEGER NOT NULL,last_position_seconds INTEGER NOT NULL DEFAULT 0,completed INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,lesson_id),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,FOREIGN KEY(lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS notification_reads (user_id INTEGER NOT NULL,notification_key TEXT NOT NULL,read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,notification_key),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS elon_conversations (id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,title TEXT NOT NULL DEFAULT 'สนทนากับ ELON',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,ended_at TEXT,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS elon_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,conversation_id TEXT NOT NULL,user_id INTEGER NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,page_path TEXT NOT NULL DEFAULT '',page_title TEXT NOT NULL DEFAULT '',page_context TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(conversation_id) REFERENCES elon_conversations(id) ON DELETE CASCADE,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS elon_rate_limits (user_id INTEGER NOT NULL,window_start TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,window_start),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS trash_items (id INTEGER PRIMARY KEY AUTOINCREMENT,item_type TEXT NOT NULL,title TEXT NOT NULL,product_id INTEGER,object_key TEXT,payload TEXT NOT NULL DEFAULT '{}',deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,expires_at TEXT NOT NULL DEFAULT (datetime('now','+30 days')))`
    ,`CREATE TABLE IF NOT EXISTS product_slug_history (old_slug TEXT PRIMARY KEY,product_id INTEGER NOT NULL,changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS security_rate_limits (rate_key TEXT PRIMARY KEY,hits INTEGER NOT NULL DEFAULT 0,window_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,blocked_until TEXT)`
    ,`CREATE TABLE IF NOT EXISTS security_logs (id INTEGER PRIMARY KEY AUTOINCREMENT,event_type TEXT NOT NULL,severity TEXT NOT NULL DEFAULT 'info',user_id INTEGER,ip TEXT,path TEXT,detail TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
    ,`CREATE TABLE IF NOT EXISTS page_views (id INTEGER PRIMARY KEY AUTOINCREMENT,path TEXT NOT NULL,product_id INTEGER,visitor_key TEXT NOT NULL,viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,aggregated_at TEXT,FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL)`
    ,`CREATE TABLE IF NOT EXISTS analytics_daily (day_local TEXT NOT NULL,path TEXT NOT NULL,product_id INTEGER NOT NULL DEFAULT 0,views INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day_local,path,product_id))`
    ,`CREATE TABLE IF NOT EXISTS analytics_visitors (visitor_key TEXT PRIMARY KEY,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL)`
    ,`CREATE TABLE IF NOT EXISTS user_terms_acceptances (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,terms_version TEXT NOT NULL,accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,ip_hash TEXT NOT NULL,UNIQUE(user_id,terms_version),FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS password_reset_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,used_at TEXT,consume_id TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`
    ,`CREATE TABLE IF NOT EXISTS verified_slips (id INTEGER PRIMARY KEY AUTOINCREMENT,trans_ref TEXT NOT NULL UNIQUE,order_id INTEGER NOT NULL UNIQUE,provider TEXT NOT NULL DEFAULT 'easyslip',amount INTEGER NOT NULL,receiver_name TEXT,receiver_account TEXT,verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(order_id) REFERENCES orders(id))`
    ,`CREATE TABLE IF NOT EXISTS order_slip_evidence (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,object_key TEXT NOT NULL UNIQUE,mime_type TEXT NOT NULL DEFAULT 'image/jpeg',file_size INTEGER NOT NULL DEFAULT 0,uploaded_by_user_id INTEGER,source TEXT NOT NULL DEFAULT 'buyer_upload',note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(order_id) REFERENCES orders(id),FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id))`
    ,`CREATE TABLE IF NOT EXISTS vision4_pending_files (id INTEGER PRIMARY KEY AUTOINCREMENT,file_name TEXT NOT NULL,object_key TEXT NOT NULL UNIQUE,mime_type TEXT NOT NULL,file_size INTEGER NOT NULL DEFAULT 0,pages INTEGER NOT NULL DEFAULT 1,preview_urls TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'waiting_bundle',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`
  ];

  for (const statement of statements) await env.DB.prepare(statement).run();

  const columns = (await env.DB.prepare('PRAGMA table_info(users)').all()).results.map(column => column.name);
  if (!columns.includes('username')) await env.DB.prepare('ALTER TABLE users ADD COLUMN username TEXT').run();
  if (!columns.includes('phone')) await env.DB.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
  if (!columns.includes('seller_bank_name')) await env.DB.prepare("ALTER TABLE users ADD COLUMN seller_bank_name TEXT NOT NULL DEFAULT ''").run();
  if (!columns.includes('seller_account_name')) await env.DB.prepare("ALTER TABLE users ADD COLUMN seller_account_name TEXT NOT NULL DEFAULT ''").run();
  if (!columns.includes('seller_account_number')) await env.DB.prepare("ALTER TABLE users ADD COLUMN seller_account_number TEXT NOT NULL DEFAULT ''").run();
  if (!columns.includes('seller_payment_qr_url')) await env.DB.prepare("ALTER TABLE users ADD COLUMN seller_payment_qr_url TEXT NOT NULL DEFAULT ''").run();
  if (!columns.includes('seller_payment_status')) await env.DB.prepare("ALTER TABLE users ADD COLUMN seller_payment_status TEXT NOT NULL DEFAULT 'unset'").run();
  if (!columns.includes('seller_payment_submitted_at')) await env.DB.prepare('ALTER TABLE users ADD COLUMN seller_payment_submitted_at TEXT').run();
  if (!columns.includes('seller_payment_verified_at')) await env.DB.prepare('ALTER TABLE users ADD COLUMN seller_payment_verified_at TEXT').run();
  if (!columns.includes('seller_payment_verified_by')) await env.DB.prepare('ALTER TABLE users ADD COLUMN seller_payment_verified_by INTEGER').run();
  if (!columns.includes('seller_slip_api_key')) await env.DB.prepare("ALTER TABLE users ADD COLUMN seller_slip_api_key TEXT NOT NULL DEFAULT ''").run();
  if (!columns.includes('seller_slip_api_provider')) await env.DB.prepare("ALTER TABLE users ADD COLUMN seller_slip_api_provider TEXT NOT NULL DEFAULT 'easyslip'").run();
  if (!columns.includes('seller_slip_api_updated_at')) await env.DB.prepare('ALTER TABLE users ADD COLUMN seller_slip_api_updated_at TEXT').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id,created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_password_reset_expiry ON password_reset_tokens(expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_course_right_credits_user ON course_right_credits(user_id,active,granted_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_course_right_credits_order ON course_right_credits(order_id)').run();
  const creditColumns=(await env.DB.prepare('PRAGMA table_info(course_right_credits)').all()).results.map(column=>column.name);
  if(!creditColumns.includes('source_entitlement_id'))await env.DB.prepare('ALTER TABLE course_right_credits ADD COLUMN source_entitlement_id INTEGER').run();
  if(!creditColumns.includes('source_order_item_id'))await env.DB.prepare('ALTER TABLE course_right_credits ADD COLUMN source_order_item_id INTEGER').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_course_right_credits_source_entitlement ON course_right_credits(source_entitlement_id) WHERE source_entitlement_id IS NOT NULL').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_course_right_credits_source_order_item ON course_right_credits(source_order_item_id) WHERE source_order_item_id IS NOT NULL').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_unlock_logs_created ON unlock_logs(created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_unlock_logs_target ON unlock_logs(target_user_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ad_costs_date ON ad_costs(spend_date DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_prompt_usage_created ON prompt_usage_logs(created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_prompt_usage_user ON prompt_usage_logs(user_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_bundle_source ON product_bundle_items(source_product_id)').run();
  const productColumns = (await env.DB.prepare('PRAGMA table_info(products)').all()).results.map(column => column.name);
  if (!productColumns.includes('file_type')) await env.DB.prepare("ALTER TABLE products ADD COLUMN file_type TEXT DEFAULT 'PDF'").run();
  if (!productColumns.includes('preview_urls')) await env.DB.prepare("ALTER TABLE products ADD COLUMN preview_urls TEXT DEFAULT '[]'").run();
  if (!productColumns.includes('pages')) await env.DB.prepare("ALTER TABLE products ADD COLUMN pages INTEGER NOT NULL DEFAULT 0").run();
  if (!productColumns.includes('deleted_at')) await env.DB.prepare("ALTER TABLE products ADD COLUMN deleted_at TEXT").run();
  if (!productColumns.includes('deleted_prev_status')) await env.DB.prepare("ALTER TABLE products ADD COLUMN deleted_prev_status TEXT").run();
  if (!productColumns.includes('product_kind')) await env.DB.prepare("ALTER TABLE products ADD COLUMN product_kind TEXT NOT NULL DEFAULT 'product'").run();
  if (!productColumns.includes('member_category')) await env.DB.prepare("ALTER TABLE products ADD COLUMN member_category TEXT").run();
  if (!productColumns.includes('member_duration_months')) await env.DB.prepare("ALTER TABLE products ADD COLUMN member_duration_months INTEGER").run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_trash_expires_at ON trash_items(expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_slug_history_product ON product_slug_history(product_id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_security_logs_created ON security_logs(created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_security_logs_event ON security_logs(event_type,created_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_views_path_time ON page_views(path,viewed_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_views_product_time ON page_views(product_id,viewed_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_views_visitor_time ON page_views(visitor_key,viewed_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_views_time ON page_views(viewed_at DESC)').run();
  const pageViewColumns=(await env.DB.prepare('PRAGMA table_info(page_views)').all()).results.map(column=>column.name);
  if(!pageViewColumns.includes('aggregated_at'))await env.DB.prepare('ALTER TABLE page_views ADD COLUMN aggregated_at TEXT').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_page_views_aggregation ON page_views(aggregated_at,id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_analytics_daily_product_day ON analytics_daily(product_id,day_local)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_terms_acceptances_user ON user_terms_acceptances(user_id,accepted_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_category_memberships_user ON category_memberships(user_id,active,expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_category_memberships_category ON category_memberships(category_slug,active,expires_at)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_course_lessons_course_sort ON course_lessons(course_id,sort_order,id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_course_lesson_files_lesson ON course_lesson_files(lesson_id,sort_order,id)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_course_progress_user_course ON course_progress(user_id,course_id,updated_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_elon_conversations_user_updated ON elon_conversations(user_id,updated_at DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_elon_messages_conversation_created ON elon_messages(conversation_id,created_at DESC,id DESC)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_elon_rate_limits_window ON elon_rate_limits(window_start)').run();
  const elonMessageColumns=(await env.DB.prepare('PRAGMA table_info(elon_messages)').all()).results.map(column=>column.name);
  if(!elonMessageColumns.includes('page_path'))await env.DB.prepare("ALTER TABLE elon_messages ADD COLUMN page_path TEXT NOT NULL DEFAULT ''").run();
  if(!elonMessageColumns.includes('page_title'))await env.DB.prepare("ALTER TABLE elon_messages ADD COLUMN page_title TEXT NOT NULL DEFAULT ''").run();
  if(!elonMessageColumns.includes('page_context'))await env.DB.prepare("ALTER TABLE elon_messages ADD COLUMN page_context TEXT NOT NULL DEFAULT '{}'").run();
  const vision4PendingColumns=(await env.DB.prepare('PRAGMA table_info(vision4_pending_files)').all()).results.map(column=>column.name);
  if(!vision4PendingColumns.includes('preview_urls'))await env.DB.prepare("ALTER TABLE vision4_pending_files ADD COLUMN preview_urls TEXT NOT NULL DEFAULT '[]'").run();
  const courseColumns=(await env.DB.prepare('PRAGMA table_info(courses)').all()).results.map(column=>column.name);
  if(!courseColumns.includes('course_type'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN course_type TEXT NOT NULL DEFAULT 'online_course'").run();
  if(!courseColumns.includes('license_edit_days'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN license_edit_days INTEGER NOT NULL DEFAULT 30").run();
  if(!courseColumns.includes('owner_user_id'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN owner_user_id INTEGER').run();
  if(!courseColumns.includes('license_entitlement_id'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN license_entitlement_id INTEGER').run();
  if(!courseColumns.includes('edit_expires_at'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN edit_expires_at TEXT').run();
  if(!courseColumns.includes('contact_info'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN contact_info TEXT NOT NULL DEFAULT ''").run();
  if(!courseColumns.includes('payment_bank_name'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN payment_bank_name TEXT NOT NULL DEFAULT ''").run();
  if(!courseColumns.includes('payment_account_name'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN payment_account_name TEXT NOT NULL DEFAULT ''").run();
  if(!courseColumns.includes('payment_account_number'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN payment_account_number TEXT NOT NULL DEFAULT ''").run();
  if(!courseColumns.includes('payment_qr_url'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN payment_qr_url TEXT NOT NULL DEFAULT ''").run();
  if(!courseColumns.includes('platform_tags'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN platform_tags TEXT NOT NULL DEFAULT '[]'").run();
  if(!courseColumns.includes('learner_level'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN learner_level TEXT NOT NULL DEFAULT 'beginner'").run();
  if(!courseColumns.includes('expected_episodes'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN expected_episodes INTEGER NOT NULL DEFAULT 1').run();
  if(!courseColumns.includes('review_status'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved'").run();
  if(!courseColumns.includes('review_note'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN review_note TEXT NOT NULL DEFAULT ''").run();
  if(!courseColumns.includes('submitted_at'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN submitted_at TEXT').run();
  if(!courseColumns.includes('approved_at'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN approved_at TEXT').run();
  if(!courseColumns.includes('approved_by'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN approved_by INTEGER').run();
  if(!courseColumns.includes('course_origin'))await env.DB.prepare("ALTER TABLE courses ADD COLUMN course_origin TEXT NOT NULL DEFAULT 'company'").run();
  if(!courseColumns.includes('basket_binding_locked'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN basket_binding_locked INTEGER NOT NULL DEFAULT 0').run();
  if(!courseColumns.includes('basket_bound_at'))await env.DB.prepare('ALTER TABLE courses ADD COLUMN basket_bound_at TEXT').run();
  await env.DB.prepare("UPDATE courses SET course_origin='seller_rights' WHERE owner_user_id IS NOT NULL AND course_type='online_course' AND course_origin='company'").run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_license_entitlement ON courses(license_entitlement_id) WHERE license_entitlement_id IS NOT NULL').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_courses_owner ON courses(owner_user_id,created_at DESC)').run();
  await env.DB.prepare(`INSERT OR IGNORE INTO course_right_credits(user_id,product_id,order_id,active,granted_at,source_entitlement_id) SELECT e.user_id,e.product_id,e.order_id,e.active,e.granted_at,e.id FROM entitlements e JOIN products p ON p.id=e.product_id WHERE p.category='resale-rights' AND NOT EXISTS(SELECT 1 FROM courses c WHERE c.license_entitlement_id=e.id)`).run();
  const lessonColumns=(await env.DB.prepare('PRAGMA table_info(course_lessons)').all()).results.map(column=>column.name);
  if(!lessonColumns.includes('document_name'))await env.DB.prepare("ALTER TABLE course_lessons ADD COLUMN document_name TEXT NOT NULL DEFAULT ''").run();
  if(!lessonColumns.includes('upload_claim'))await env.DB.prepare('ALTER TABLE course_lessons ADD COLUMN upload_claim TEXT').run();
  if(!lessonColumns.includes('upload_claimed_at'))await env.DB.prepare('ALTER TABLE course_lessons ADD COLUMN upload_claimed_at TEXT').run();
  const orderItemColumns = (await env.DB.prepare('PRAGMA table_info(order_items)').all()).results.map(column => column.name);
  if (!orderItemColumns.includes('product_title')) await env.DB.prepare('ALTER TABLE order_items ADD COLUMN product_title TEXT').run();
  await env.DB.prepare('UPDATE order_items SET product_title=(SELECT title FROM products WHERE products.id=order_items.product_id) WHERE product_title IS NULL').run();
  await env.DB.prepare(`CREATE TRIGGER IF NOT EXISTS trg_order_item_product_title AFTER INSERT ON order_items WHEN NEW.product_title IS NULL BEGIN UPDATE order_items SET product_title=(SELECT title FROM products WHERE id=NEW.product_id) WHERE id=NEW.id; END`).run();
  const orderColumns = (await env.DB.prepare('PRAGMA table_info(orders)').all()).results.map(column => column.name);
  if (!orderColumns.includes('sale_price_recorded')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN sale_price_recorded INTEGER NOT NULL DEFAULT 1').run();
  if (!orderColumns.includes('payment_account_type')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN payment_account_type TEXT').run();
  if (!orderColumns.includes('payment_bank_name')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN payment_bank_name TEXT').run();
  if (!orderColumns.includes('payment_account_name')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN payment_account_name TEXT').run();
  if (!orderColumns.includes('payment_account_number')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN payment_account_number TEXT').run();
  if (!orderColumns.includes('slip_verification_status')) await env.DB.prepare("ALTER TABLE orders ADD COLUMN slip_verification_status TEXT NOT NULL DEFAULT 'not_checked'").run();
  if (!orderColumns.includes('slip_verification_code')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN slip_verification_code TEXT').run();
  if (!orderColumns.includes('slip_trans_ref')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN slip_trans_ref TEXT').run();
  if (!orderColumns.includes('slip_verified_at')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN slip_verified_at TEXT').run();
  if (!orderColumns.includes('course_owner_user_id')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN course_owner_user_id INTEGER').run();
  if (!orderColumns.includes('seller_course_id')) await env.DB.prepare('ALTER TABLE orders ADD COLUMN seller_course_id INTEGER').run();
  if (!orderColumns.includes('payment_qr_url')) await env.DB.prepare("ALTER TABLE orders ADD COLUMN payment_qr_url TEXT NOT NULL DEFAULT ''").run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_slips_trans_ref ON verified_slips(trans_ref)').run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_orders_slip_verification ON orders(slip_verification_status,updated_at DESC)').run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('coloring','ระบายสี',NULL,'PDF',1,10)").run();
  await env.DB.prepare("UPDATE categories SET name='ระบายสี',parent_slug=NULL,active=1,sort_order=10 WHERE slug='coloring'").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('tattoo','แบบรอยสัก',NULL,'PDF',1,20)").run();
  await env.DB.prepare("UPDATE categories SET name='แบบรอยสัก',parent_slug=NULL,file_type='PDF',active=1,sort_order=20 WHERE slug='tattoo'").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('set-coloring','คละแบบระบายสี',NULL,'ชุด PDF',1,21)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('set-tattoo','คละแบบรอยสัก',NULL,'ชุด PDF',1,22)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('worksheet','แบบฝึกหัด',NULL,'PDF',1,25)").run();
  await env.DB.prepare("UPDATE categories SET name='แบบฝึกหัด',parent_slug=NULL,file_type='PDF',active=1,sort_order=25 WHERE slug='worksheet'").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('development-game','เกมเสริมพัฒนาการ',NULL,'PDF',1,26)").run();
  await env.DB.prepare("UPDATE categories SET name='เกมเสริมพัฒนาการ',parent_slug=NULL,file_type='PDF',active=1,sort_order=26 WHERE slug='development-game'").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('online-course','คอร์สออนไลน์',NULL,'วิดีโอ + เอกสาร',1,50)").run();
  await env.DB.prepare("UPDATE categories SET name='คอร์สออนไลน์',parent_slug=NULL,file_type='วิดีโอ + เอกสาร',active=1,sort_order=50 WHERE slug='online-course'").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('resale-rights','สิทธิ์ลงขายคอร์สออนไลน์',NULL,'สิทธิ์ใช้งาน',1,51)").run();
  await env.DB.prepare("UPDATE categories SET name='สิทธิ์ลงขายคอร์สออนไลน์',parent_slug=NULL,file_type='สิทธิ์ใช้งาน',active=1,sort_order=51 WHERE slug='resale-rights'").run();
  await env.DB.prepare("UPDATE products SET slug='course-selling-rights',title='สิทธิ์เปิดตะกร้าขายคอร์ส 1 ตะกร้า',short_description='ตะกร้าขายได้ต่อเนื่อง โดยแก้ไขข้อมูลและเนื้อหาได้ 30 วันนับจากวันที่เผยแพร่',updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights-30-days' AND NOT EXISTS(SELECT 1 FROM products x WHERE x.slug='course-selling-rights')").run();
  await env.DB.prepare(`INSERT OR IGNORE INTO products(slug,title,short_description,description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind)
    VALUES('course-selling-rights','สิทธิ์เปิดตะกร้าขายคอร์ส 1 ตะกร้า','ตะกร้าขายได้ต่อเนื่อง โดยแก้ไขข้อมูลและเนื้อหาได้ 30 วันนับจากวันที่เผยแพร่','สิทธิ์ลงขายคอร์สออนไลน์จำนวน 1 ตะกร้า\n\n• สร้างและเปิดขายคอร์สออนไลน์ได้ 1 ตะกร้า\n• แก้ไขชื่อ ราคา รายละเอียด และเนื้อหาได้อิสระภายใน 30 วัน\n• เพิ่มวิดีโอและเอกสารประกอบแยกตาม EP\n• รองรับ PDF, DOCX, XLSX, PPTX และ ZIP\n• กำหนด QR หรือบัญชีรับเงินของเจ้าของคอร์สได้\n• VisionD ตรวจสลิปแบบแมนนวลก่อนปลดล็อกบทเรียน\n• มีหน้ารวมยอดขาย จำนวนออเดอร์ และวันเวลา\n• 1 สิทธิ์ผูกกับ 1 ตะกร้าถาวร การลบตะกร้าไม่คืนสิทธิ์\n• VisionD ดูแลระบบ แต่เจ้าของคอร์สดูแลเนื้อหาของตนเอง',49900,'/assets/course-rights-499-online-mobile.png','["/assets/course-rights-499-online-mobile.png","/assets/course-rights-conditions-part-1.png","/assets/course-rights-conditions-part-2.png"]','resale-rights','สิทธิ์ใช้งาน',1,'published','system-course-rights','product')`).run();
  await env.DB.prepare(`INSERT OR IGNORE INTO courses(product_id,subtitle,teacher_name,total_minutes,active,course_type,license_edit_days)
    SELECT id,'1 สิทธิ์ • 1 ตะกร้า • แก้ไขได้ 30 วัน','VisionD',0,1,'resale_rights',30 FROM products WHERE slug='course-selling-rights'`).run();
  await env.DB.prepare("UPDATE products SET product_kind='product' WHERE slug='course-selling-rights'").run();
  await env.DB.prepare("UPDATE products SET title='สิทธิ์ลงขายคอร์สออนไลน์ 1 ตะกร้า',short_description='ตะกร้าขายได้ต่อเนื่อง โดยแก้ไขข้อมูลและเนื้อหาได้ 30 วันนับจากวันที่เผยแพร่',price=49900,status='published',product_kind='product',updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights'").run();
  await env.DB.prepare("UPDATE products SET title='สิทธิ์เปิดตะกร้าขายคอร์ส 1 ตะกร้า',updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND title='สิทธิ์ลงขายคอร์ส 1 ตะกร้า แก้ไขได้ 30 วัน'").run();
  await env.DB.prepare(`UPDATE products SET preview_urls='["/assets/course-rights-499-online-mobile.png","/assets/course-rights-conditions-part-1.png","/assets/course-rights-conditions-part-2.png"]',updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND (preview_urls IS NULL OR preview_urls='' OR preview_urls='["/assets/course-rights-499-mobile.png"]' OR preview_urls='["/assets/course-rights-499-online-mobile.png"]')`).run();
  await env.DB.prepare("UPDATE products SET cover_url='/assets/course-rights-499-online-mobile.png',preview_urls=REPLACE(COALESCE(preview_urls,'[]'),'/assets/course-rights-499-mobile.png','/assets/course-rights-499-online-mobile.png'),updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND cover_url='/assets/course-rights-499-mobile.png'").run();
  await env.DB.prepare("UPDATE products SET cover_url='/assets/course-rights-999-to-499-online-mobile.png',preview_urls=REPLACE(COALESCE(preview_urls,'[]'),'/assets/course-rights-499-online-mobile.png','/assets/course-rights-999-to-499-online-mobile.png'),price=49900,updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND cover_url='/assets/course-rights-499-online-mobile.png'").run();
  await env.DB.prepare(`UPDATE products SET description=COALESCE(description,'') || ?,updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND INSTR(COALESCE(description,''),'กติกาภาพปกคอร์ส')=0`).bind(`\n\nกติกาภาพปกคอร์ส\n• ห้ามใช้โลโก้ เครื่องหมายการค้า ภาพหน้าจอ หรือสื่อประชาสัมพันธ์ของบุคคลและแบรนด์อื่นเป็นภาพปก\n• ใช้ได้เฉพาะกรณีมีหนังสืออนุญาต และส่งหลักฐานให้ VisionD ตรวจสอบก่อน\n• พิมพ์ชื่อแพลตฟอร์มเป็นข้อความธรรมดาได้ เช่น “สอนเปิดร้านบน Shopee”\n• ห้ามใช้สี ตัวอักษร รูปแบบ หรือองค์ประกอบที่ทำให้เข้าใจว่าเป็นคอร์สทางการหรือได้รับการรับรองจากแบรนด์\n• VisionD มีสิทธิ์ขอให้เปลี่ยนหรือระงับภาพปกที่เสี่ยงละเมิดสิทธิ์`).run();
  await env.DB.prepare(`UPDATE products SET description=COALESCE(description,'') || ?,updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND INSTR(COALESCE(description,''),'ระบบเครดิตสิทธิ์')=0`).bind(`\n\nระบบเครดิตสิทธิ์\n• ซื้อ 1 ชิ้น ได้รับ 1 เครดิตสิทธิ์\n• 1 เครดิตใช้เปิดตะกร้าคอร์สได้ 1 ตะกร้า\n• ระบบหักเครดิต 1 แต้มเมื่อสร้างตะกร้าคอร์สสำเร็จเท่านั้น\n• ระยะเวลาแก้ไขเริ่มนับเมื่อสร้างตะกร้าสำเร็จ ไม่ได้นับจากวันซื้อ\n• เครดิตสิทธิ์ที่ได้รับแล้วไม่สามารถคืนเงินหรือแลกเป็นเงินสดได้`).run();
  await env.DB.prepare(`UPDATE products SET description=REPLACE(description,'เครดิตสิทธิ์ที่ได้รับแล้วไม่สามารถคืนเงินหรือแลกเป็นเงินสดได้','เครดิตสิทธิ์ไม่สามารถแลกเป็นเงินสดได้ และไม่คืนเงิน เว้นแต่ระบบยังใช้งานไม่ได้ภายใน 7 วันนับจากวันที่ได้รับอนุมัติ และ VisionD ตรวจสอบแล้วว่าเกิดจากระบบจริง'),updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND INSTR(COALESCE(description,''),'เครดิตสิทธิ์ที่ได้รับแล้วไม่สามารถคืนเงินหรือแลกเป็นเงินสดได้')>0`).run();
  await env.DB.prepare(`UPDATE products SET description=REPLACE(description,'VisionD ตรวจสลิปแบบแมนนวลก่อนปลดล็อกบทเรียน','ระบบ API ของ VisionD ตรวจบัญชี ยอดเงิน และสลิปซ้ำอัตโนมัติก่อนเพิ่มเครดิตสิทธิ์'),updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND INSTR(COALESCE(description,''),'VisionD ตรวจสลิปแบบแมนนวลก่อนปลดล็อกบทเรียน')>0`).run();
  await env.DB.prepare(`UPDATE products SET description=REPLACE(description,'ระบบ API ของ VisionD ตรวจบัญชี ยอดเงิน และสลิปซ้ำอัตโนมัติก่อนเพิ่มเครดิตสิทธิ์','ผู้ซื้อใช้ EasySlip API และโควต้าของตนเองตรวจบัญชี VisionD ยอดเงิน และสลิปซ้ำอัตโนมัติก่อนเพิ่มเครดิตสิทธิ์ โดยไม่ใช้ API บริษัท'),updated_at=CURRENT_TIMESTAMP WHERE slug='course-selling-rights' AND INSTR(COALESCE(description,''),'ระบบ API ของ VisionD ตรวจบัญชี ยอดเงิน และสลิปซ้ำอัตโนมัติก่อนเพิ่มเครดิตสิทธิ์')>0`).run();
  const canonicalRights=await env.DB.prepare("SELECT id FROM products WHERE slug='course-selling-rights'").first();
  if(canonicalRights){
    const rightsId=Number(canonicalRights.id);
    await env.DB.prepare("DELETE FROM entitlements WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?) AND EXISTS(SELECT 1 FROM entitlements keep WHERE keep.user_id=entitlements.user_id AND keep.order_id=entitlements.order_id AND keep.product_id=?)").bind(rightsId,rightsId).run();
    await env.DB.prepare("UPDATE order_items SET product_id=?,product_title='สิทธิ์ลงขายคอร์สออนไลน์ 1 ตะกร้า' WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId,rightsId).run();
    await env.DB.prepare("UPDATE entitlements SET product_id=? WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId,rightsId).run();
    await env.DB.prepare("UPDATE course_right_credits SET product_id=? WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId,rightsId).run();
    await env.DB.prepare("UPDATE unlock_logs SET product_id=?,product_title='สิทธิ์ลงขายคอร์สออนไลน์ 1 ตะกร้า' WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId,rightsId).run();
    await env.DB.prepare(`INSERT INTO analytics_daily(day_local,path,product_id,views)
      SELECT day_local,path,?,SUM(views) FROM analytics_daily WHERE product_id IN
      (SELECT id FROM products WHERE category='resale-rights' AND id<>?) GROUP BY day_local,path
      ON CONFLICT(day_local,path,product_id) DO UPDATE SET views=views+excluded.views`).bind(rightsId,rightsId).run();
    await env.DB.prepare("DELETE FROM analytics_daily WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId).run();
    await env.DB.prepare("UPDATE page_views SET product_id=? WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId,rightsId).run();
    await env.DB.prepare("UPDATE trash_items SET product_id=? WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId,rightsId).run();
    await env.DB.prepare("UPDATE product_slug_history SET product_id=? WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId,rightsId).run();
    await env.DB.prepare("DELETE FROM courses WHERE product_id IN (SELECT id FROM products WHERE category='resale-rights' AND id<>?)").bind(rightsId).run();
    await env.DB.prepare("DELETE FROM products WHERE category='resale-rights' AND id<>?").bind(rightsId).run();
  }
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('dinosaur','ไดโนเสาร์','coloring','PDF',1,11)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('paper-doll','ตุ๊กตากระดาษ',NULL,'PDF',1,30)").run();
  await env.DB.prepare("INSERT OR IGNORE INTO categories(slug,name,parent_slug,file_type,active,sort_order) VALUES('document','เอกสารและแบบฟอร์ม',NULL,'PDF',1,40)").run();
}
