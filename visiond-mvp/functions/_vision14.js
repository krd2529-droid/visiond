export const V14_RIGHTS=['owned','plr','public_domain','licensed','reference_only'];
export const V14_RIGHT_LABELS={owned:'เจ้าของลิขสิทธิ์เอง',plr:'PLR / สิทธิ์แก้ไขและขาย',public_domain:'Public Domain',licensed:'ได้รับอนุญาต',reference_only:'ใช้อ้างอิงเท่านั้น'};

const readyByDatabase=new WeakMap();
export function ensureVision14Schema(env){
  let ready=readyByDatabase.get(env.DB);
  if(!ready){
    ready=(async()=>{
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vision14_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      mime_type TEXT NOT NULL DEFAULT 'application/pdf',
      file_size INTEGER NOT NULL DEFAULT 0,
      rights_status TEXT NOT NULL DEFAULT 'reference_only',
      rights_note TEXT NOT NULL DEFAULT '',
      processing_status TEXT NOT NULL DEFAULT 'source_received',
      sale_eligible INTEGER NOT NULL DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v14_sources_created ON vision14_sources(created_at DESC)').run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v14_sources_rights ON vision14_sources(rights_status,sale_eligible)').run();
    })().catch(error=>{readyByDatabase.delete(env.DB);throw error});
    readyByDatabase.set(env.DB,ready);
  }
  return ready;
}

export const canSellWithRights=status=>['owned','plr','public_domain','licensed'].includes(status);
