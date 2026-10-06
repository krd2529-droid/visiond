import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const migration=name=>readFileSync(new URL(`../services/vpage/migrations/${name}`,import.meta.url),'utf8');
const base=migration('0001_vpage_service.sql')+migration('0002_vpage_editor.sql');
const multi=migration('0003_vpage_multi_items.sql');
const db=new DatabaseSync(':memory:');
try{
  db.exec('PRAGMA foreign_keys=ON;'+base);
  db.prepare("INSERT INTO vpage_pages(id,domain_id,owner_ref,slug,display_name,status,create_idempotency_key,create_request_hash,created_at,expires_at,updated_at) VALUES('vp_11111111111111111111111111111111','dom_smartlinkpage',?,'legacy','Legacy','active','legacy-key','legacy-hash',CURRENT_TIMESTAMP,datetime('now','+1 day'),CURRENT_TIMESTAMP)").run('a'.repeat(64));
  db.exec("INSERT INTO vpage_content_sets(page_id,set_no) VALUES('vp_11111111111111111111111111111111',1),('vp_11111111111111111111111111111111',2)");
  db.prepare("UPDATE vpage_content_sets SET product_url=?,contact_url=? WHERE page_id='vp_11111111111111111111111111111111' AND set_no=1").run('https://shop.example/legacy?x=1','https://www.facebook.com/legacy');
  db.prepare("UPDATE vpage_content_sets SET product_url=?,contact_url=? WHERE page_id='vp_11111111111111111111111111111111' AND set_no=2").run('https://shop.example/legacy-two','https://line.me/R/ti/p/@legacy');
  db.exec(multi);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM vpage_content_sets').get().count,2,'content-set rows survive upgrade');
  assert.deepEqual(db.prepare('SELECT set_no,position,destination_url FROM vpage_product_items ORDER BY set_no,position').all().map(row=>({...row})),[
    {set_no:1,position:1,destination_url:'https://shop.example/legacy?x=1'},
    {set_no:2,position:1,destination_url:'https://shop.example/legacy-two'}
  ]);
  assert.deepEqual(db.prepare('SELECT set_no,position,contact_type,destination_url FROM vpage_contact_items ORDER BY set_no,position').all().map(row=>({...row})),[
    {set_no:1,position:1,contact_type:'facebook',destination_url:'https://www.facebook.com/legacy'},
    {set_no:2,position:1,contact_type:'line',destination_url:'https://line.me/R/ti/p/@legacy'}
  ]);
  const productPlan=db.prepare('EXPLAIN QUERY PLAN SELECT position,destination_url,image_url FROM vpage_product_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').all('vp_11111111111111111111111111111111',1).map(row=>row.detail).join(' | ');
  const contactPlan=db.prepare('EXPLAIN QUERY PLAN SELECT position,contact_type,destination_url,image_url FROM vpage_contact_items WHERE page_id=? AND set_no=? ORDER BY position LIMIT 3').all('vp_11111111111111111111111111111111',1).map(row=>row.detail).join(' | ');
  assert.match(productPlan,/sqlite_autoindex_vpage_product_items_1|idx_vpage_product_items_set_order/);assert.match(contactPlan,/sqlite_autoindex_vpage_contact_items_1|idx_vpage_contact_items_set_order/);assert.doesNotMatch(productPlan+contactPlan,/TEMP B-TREE|SCAN vpage_/);
}finally{db.close()}

const invalid=new DatabaseSync(':memory:');
try{
  invalid.exec('PRAGMA foreign_keys=ON;'+base);
  invalid.prepare("INSERT INTO vpage_pages(id,domain_id,owner_ref,slug,display_name,status,create_idempotency_key,create_request_hash,created_at,expires_at,updated_at) VALUES('vp_22222222222222222222222222222222','dom_smartlinkpage',?,'invalid','Invalid','active','invalid-key','invalid-hash',CURRENT_TIMESTAMP,datetime('now','+1 day'),CURRENT_TIMESTAMP)").run('b'.repeat(64));
  invalid.exec("INSERT INTO vpage_content_sets(page_id,set_no) VALUES('vp_22222222222222222222222222222222',1),('vp_22222222222222222222222222222222',2)");
  invalid.prepare("UPDATE vpage_content_sets SET contact_url='https://unclassified.example/contact' WHERE page_id='vp_22222222222222222222222222222222' AND set_no=1").run();
  assert.throws(()=>invalid.exec(multi),/NOT NULL constraint failed: vpage_contact_items.contact_type/,'unclassifiable legacy contact fails migration visibly');
}finally{invalid.close()}
console.log('PASS Vpage populated upgrade backfill, contact inference failure, ordered indexed child reads');
