const readyByDatabase=new WeakMap();
export const vpageCreateSchemaStatements=[
  "CREATE TABLE vpage_owner_assets (\r\n  id TEXT PRIMARY KEY,\r\n  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,\r\n  object_key TEXT NOT NULL UNIQUE,\r\n  source_hash TEXT NOT NULL CHECK(length(source_hash)=64),\r\n  content_hash TEXT NOT NULL CHECK(length(content_hash)=64),\r\n  mime_type TEXT NOT NULL CHECK(mime_type='image/webp'),\r\n  file_size INTEGER NOT NULL CHECK(file_size BETWEEN 1 AND 5242880),\r\n  width INTEGER NOT NULL CHECK(width BETWEEN 1 AND 4096),\r\n  height INTEGER NOT NULL CHECK(height BETWEEN 1 AND 4096),\r\n  idempotency_key TEXT NOT NULL,\r\n  state TEXT NOT NULL CHECK(state IN ('pending','ready','deleting','deleted')),\r\n  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r\n  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,\r\n  UNIQUE(owner_id,idempotency_key)\r\n);",
  "CREATE INDEX idx_vpage_owner_assets_list ON vpage_owner_assets(owner_id,state,id DESC);",
  "CREATE TRIGGER vpage_owner_assets_limit BEFORE INSERT ON vpage_owner_assets\r\nWHEN (SELECT COUNT(*) FROM vpage_owner_assets WHERE owner_id=NEW.owner_id AND state IN ('pending','ready'))>=48\r\nBEGIN SELECT RAISE(ABORT,'vpage owner asset limit'); END;",
  "CREATE TABLE vpage_create_drafts (\r\n  owner_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,\r\n  draft_json TEXT NOT NULL CHECK(length(draft_json) BETWEEN 2 AND 65536),\r\n  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision > 0),\r\n  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP\r\n);",
  "CREATE TABLE vpage_create_draft_refs (\r\n  owner_id INTEGER NOT NULL REFERENCES vpage_create_drafts(owner_id) ON DELETE CASCADE,\r\n  media_id TEXT NOT NULL REFERENCES vpage_owner_assets(id) ON DELETE RESTRICT,\r\n  PRIMARY KEY(owner_id,media_id)\r\n);",
  "CREATE INDEX idx_vpage_create_draft_refs_media ON vpage_create_draft_refs(media_id);",
  "CREATE TABLE vpage_draft_transition_guards(token TEXT PRIMARY KEY NOT NULL);",
  "CREATE TRIGGER vpage_create_draft_ref_ready BEFORE INSERT ON vpage_create_draft_refs\r\nWHEN NOT EXISTS(SELECT 1 FROM vpage_owner_assets WHERE id=NEW.media_id AND owner_id=NEW.owner_id AND state='ready')\r\nBEGIN SELECT RAISE(ABORT,'vpage draft media not ready'); END;",
  "CREATE TRIGGER vpage_owner_asset_draft_guard BEFORE UPDATE OF state ON vpage_owner_assets\r\nWHEN NEW.state IN ('deleting','deleted') AND EXISTS(SELECT 1 FROM vpage_create_draft_refs WHERE media_id=NEW.id)\r\nBEGIN SELECT RAISE(ABORT,'vpage media in draft'); END;"
];
const canonical=sql=>String(sql).replace(/\bIF NOT EXISTS\s+/gi,'').replace(/\s+/g,'').replace(/;$/,'').toLowerCase();
export async function ensureVpageCreateSchema(env){
  let ready=readyByDatabase.get(env.DB);
  if(!ready){
    ready=(async()=>{
      const names=vpageCreateSchemaStatements.map(sql=>sql.match(/^CREATE (?:TABLE|INDEX|TRIGGER) (\w+)/)[1]);
      const read=async()=>((await env.DB.prepare(`SELECT name,sql FROM sqlite_master WHERE name IN (${names.map(()=>'?').join(',')})`).bind(...names).all()).results||[]);
      const verify=rows=>{for(const row of rows){const index=names.indexOf(row.name);if(index<0||canonical(row.sql)!==canonical(vpageCreateSchemaStatements[index]))throw new Error('VPAGE_CREATE_SCHEMA_INVALID')}};
      let rows=await read();verify(rows);
      if(rows.length!==names.length){await env.DB.batch(vpageCreateSchemaStatements.map(sql=>env.DB.prepare(sql.replace(/^CREATE (TABLE|INDEX|TRIGGER) /,'CREATE $1 IF NOT EXISTS '))));rows=await read();verify(rows)}
      if(rows.length!==names.length)throw new Error('VPAGE_CREATE_SCHEMA_INVALID');
    })().catch(error=>{readyByDatabase.delete(env.DB);throw error});readyByDatabase.set(env.DB,ready);
  }
  return ready;
}
