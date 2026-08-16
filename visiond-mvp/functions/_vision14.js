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
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS vision14_source_pages (
      source_id TEXT NOT NULL,page_number INTEGER NOT NULL,raw_text TEXT NOT NULL,clean_text TEXT NOT NULL,
      removed_credit_lines TEXT NOT NULL DEFAULT '[]',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      extraction_method TEXT NOT NULL DEFAULT 'manual',extraction_status TEXT NOT NULL DEFAULT 'success',extraction_error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(source_id,page_number),
      FOREIGN KEY(source_id) REFERENCES vision14_sources(id) ON DELETE CASCADE
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_v14_pages_source ON vision14_source_pages(source_id,page_number)').run();
    const pageColumns=(await env.DB.prepare('PRAGMA table_info(vision14_source_pages)').all()).results.map(column=>column.name);
    if(!pageColumns.includes('extraction_method'))await env.DB.prepare("ALTER TABLE vision14_source_pages ADD COLUMN extraction_method TEXT NOT NULL DEFAULT 'manual'").run();
    if(!pageColumns.includes('extraction_status'))await env.DB.prepare("ALTER TABLE vision14_source_pages ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'success'").run();
    if(!pageColumns.includes('extraction_error'))await env.DB.prepare("ALTER TABLE vision14_source_pages ADD COLUMN extraction_error TEXT NOT NULL DEFAULT ''").run();
    })().catch(error=>{readyByDatabase.delete(env.DB);throw error});
    readyByDatabase.set(env.DB,ready);
  }
  return ready;
}

export const canSellWithRights=status=>['owned','plr','public_domain','licensed'].includes(status);

const creditLinePatterns=[/^(ผู้เขียน|เขียนโดย|ผู้เรียบเรียง|เรียบเรียงโดย|ผู้จัดทำ|จัดทำโดย|บรรณาธิการ|แปลโดย|ผู้แปล)\s*[:：]?/iu,/^(สำนักพิมพ์|จัดพิมพ์โดย|ผลิตโดย|บริษัท|ห้างหุ้นส่วน|พิมพ์ที่|ครั้งที่พิมพ์|สงวนลิขสิทธิ์|ลิขสิทธิ์)\s*[:：]?/iu,/^(isbn|copyright|published by|publisher|written by|author|editor|credits?)\s*[:：]?/iu,/(?:https?:\/\/|www\.)\S+/iu,/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/iu,/\bISBN(?:-1[03])?\s*:?\s*[0-9Xx-]{10,}\b/iu];
export function cleanVision14PageText(value){const raw=String(value||'').replaceAll('\r\n','\n').replaceAll('\r','\n').trim(),removed=[];const kept=raw.split('\n').map(line=>line.trim()).filter(line=>{if(!line)return true;if(creditLinePatterns.some(pattern=>pattern.test(line))){removed.push(line.slice(0,500));return false}return true});return {raw_text:raw,clean_text:kept.join('\n').replace(/\n{3,}/g,'\n\n').trim(),removed_credit_lines:removed}}
