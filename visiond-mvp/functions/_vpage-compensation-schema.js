const readyByDatabase=new WeakMap();
const required=['id','page_id','user_id','actor_id','days','idempotency_key','state','before_expires_at','after_expires_at','last_error_code','created_at','updated_at'];

export async function ensureVpageCompensationSchema(env){
  let ready=readyByDatabase.get(env.DB);
  if(!ready){
    ready=(async()=>{
      const state=await env.DB.prepare("SELECT version FROM runtime_schema_state WHERE schema_key='vpage_compensation'").first();
      if(!state||Number(state.version)<1){
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS vpage_compensation_requests (id TEXT PRIMARY KEY,page_id TEXT NOT NULL REFERENCES vpage_pages(id) ON DELETE RESTRICT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,actor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,days INTEGER NOT NULL CHECK(days BETWEEN 1 AND 365),idempotency_key TEXT NOT NULL UNIQUE,state TEXT NOT NULL CHECK(state IN ('held','committed','released')),before_expires_at TEXT NOT NULL,after_expires_at TEXT,last_error_code TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
        await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_vpage_compensation_page_live ON vpage_compensation_requests(page_id) WHERE state='held'").run();
        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_vpage_compensation_actor ON vpage_compensation_requests(actor_id,created_at DESC,id DESC)').run();
        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_vpage_pages_domain_cursor ON vpage_pages(domain_id,status,id DESC)').run();
      }
      const columns=new Set(((await env.DB.prepare('PRAGMA table_info(vpage_compensation_requests)').all()).results||[]).map(row=>String(row.name)));
      const indexes=new Set(((await env.DB.prepare('PRAGMA index_list(vpage_compensation_requests)').all()).results||[]).map(row=>String(row.name)));
      const pageIndexes=new Set(((await env.DB.prepare('PRAGMA index_list(vpage_pages)').all()).results||[]).map(row=>String(row.name)));
      if(required.some(name=>!columns.has(name))||!indexes.has('idx_vpage_compensation_page_live')||!indexes.has('idx_vpage_compensation_actor')||!pageIndexes.has('idx_vpage_pages_domain_cursor'))throw new Error('VPAGE_COMPENSATION_SCHEMA_INVALID');
      if(!state||Number(state.version)<1)await env.DB.prepare("INSERT INTO runtime_schema_state(schema_key,version) VALUES('vpage_compensation',1) ON CONFLICT(schema_key) DO UPDATE SET version=excluded.version").run();
    })().catch(error=>{readyByDatabase.delete(env.DB);throw error});readyByDatabase.set(env.DB,ready);
  }
  return ready;
}
