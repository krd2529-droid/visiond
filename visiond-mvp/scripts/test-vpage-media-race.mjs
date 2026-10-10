import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON; CREATE TABLE vpage_pages(id TEXT PRIMARY KEY,active_set INTEGER NOT NULL,status TEXT NOT NULL,expires_at TEXT NOT NULL);');
db.exec(readFileSync(new URL('../services/vpage/migrations/0006_vpage_media.sql',import.meta.url),'utf8'));
const media='vpm_'+'a'.repeat(32),key=`media/${media}.webp`;
db.prepare("INSERT INTO vpage_media(id,owner_ref,object_key,content_hash,mime_type,file_size,width,height,state) VALUES(?,?,?,?,'image/webp',100,10,10,'ready')").run(media,'b'.repeat(64),key,'c'.repeat(64));

// Deletion wins first: content and reference inserts must roll back together.
db.prepare("UPDATE vpage_media SET state='deleting' WHERE id=?").run(media);
assert.throws(()=>{db.exec('BEGIN');try{db.prepare("INSERT INTO vpage_pages VALUES('vp_new',1,'active','2099-01-01')").run();db.prepare('INSERT INTO vpage_media_refs VALUES(?,?,?,?)').run('vp_new',1,'hero',media);db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}},/vpage media not ready/);
assert.equal(db.prepare("SELECT count(*) n FROM vpage_pages WHERE id='vp_new'").get().n,0);
db.prepare("UPDATE vpage_media SET state='ready' WHERE id=?").run(media);

// Reference wins first: deletion cannot invalidate a published image.
db.exec("INSERT INTO vpage_pages VALUES('vp_live',1,'active','2099-01-01')");
db.prepare('INSERT INTO vpage_media_refs VALUES(?,?,?,?)').run('vp_live',1,'hero',media);
assert.throws(()=>db.prepare("UPDATE vpage_media SET state='deleting' WHERE id=?").run(media),/vpage media in use/);
assert.equal(db.prepare('SELECT state FROM vpage_media WHERE id=?').get(media).state,'ready');
const plan=db.prepare("EXPLAIN QUERY PLAN SELECT m.object_key FROM vpage_media m JOIN vpage_media_refs r INDEXED BY idx_vpage_media_refs_media ON r.media_id=m.id JOIN vpage_pages p ON p.id=r.page_id AND p.active_set=r.set_no WHERE m.id=? AND m.state='ready' AND p.status='active' LIMIT 1").all(media);
assert(plan.some(row=>String(row.detail).includes('idx_vpage_media_refs_media')));
const ownerDb=new DatabaseSync(':memory:');ownerDb.exec('PRAGMA foreign_keys=ON; CREATE TABLE users(id INTEGER PRIMARY KEY); INSERT INTO users VALUES(1);');ownerDb.exec(readFileSync(new URL('../migrations/0131_vpage_owner_assets.sql',import.meta.url),'utf8'));
const add=ownerDb.prepare("INSERT INTO vpage_owner_assets(id,owner_id,object_key,source_hash,content_hash,mime_type,file_size,width,height,idempotency_key,state) VALUES(?,1,?,?,?,'image/webp',100,10,10,?,'ready')");
for(let index=0;index<48;index++)add.run(`asset-${index}`,`key-${index}`,'a'.repeat(64),'b'.repeat(64),`request-${index}`);
assert.throws(()=>add.run('asset-49','key-49','a'.repeat(64),'b'.repeat(64),'request-49'),/vpage owner asset limit/);
ownerDb.prepare("UPDATE vpage_owner_assets SET state='deleted' WHERE object_key='key-0'").run();add.run('asset-49','key-49','a'.repeat(64),'b'.repeat(64),'request-49');
console.log('PASS Vpage media reference/delete transaction guards and indexed public lookup');
