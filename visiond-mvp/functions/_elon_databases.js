const missing=name=>new Error(`${name}_BINDING_REQUIRED`);

export function elonWebDb(env={}){
  if(!env.ELON_WEB_DB)throw missing('ELON_WEB_DB');
  return env.ELON_WEB_DB;
}

export function elonV7Db(env={}){
  if(!env.ELON_V7_DB)throw missing('ELON_V7_DB');
  return env.ELON_V7_DB;
}

export async function ensureElonWebSchema(env){
  const db=elonWebDb(env);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS elon_web_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS elon_web_conversations (id TEXT PRIMARY KEY CHECK(id LIKE 'ew_%'),subject_type TEXT NOT NULL CHECK(subject_type IN ('member','guest')),subject_id TEXT NOT NULL,title TEXT NOT NULL DEFAULT 'สนทนากับ ELON',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,ended_at TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS elon_web_messages (id INTEGER PRIMARY KEY AUTOINCREMENT,conversation_id TEXT NOT NULL,subject_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,page_path TEXT NOT NULL DEFAULT '',page_title TEXT NOT NULL DEFAULT '',page_context TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(conversation_id) REFERENCES elon_web_conversations(id) ON DELETE CASCADE)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS elon_web_rate_limits (subject_id TEXT NOT NULL,window_start TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(subject_id,window_start))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS elon_web_usage_limits (rate_key TEXT NOT NULL,window_start TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(rate_key,window_start))`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_elon_web_conversations_subject_updated ON elon_web_conversations(subject_id,updated_at DESC)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_elon_web_messages_conversation_created ON elon_web_messages(conversation_id,created_at DESC,id DESC)`)
  ]);
  return db;
}

export async function ensureElonV7Boundary(env){
  const db=elonV7Db(env);
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS elon_v7_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS elon_v7_migration_state (id INTEGER PRIMARY KEY CHECK(id=1),status TEXT NOT NULL DEFAULT 'reserved',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`INSERT OR IGNORE INTO elon_v7_migration_state(id,status) VALUES(1,'reserved')`)
  ]);
  return db;
}
