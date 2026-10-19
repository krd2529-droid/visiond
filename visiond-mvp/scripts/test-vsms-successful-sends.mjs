import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestPost as ingest } from '../functions/api/vision7/sms-mix/successful-sends.js';
import { onRequestGet as list } from '../functions/api/admin/vision7/smsmix-successful-sends.js';
import { hashLicenseKey } from '../functions/_vision7.js';
import { sha256 } from '../functions/_lib.js';

const sqlite = new DatabaseSync(':memory:');
let suppressNextInsert=false;
sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT,platform_type TEXT,active INTEGER);
CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY,key_hash TEXT UNIQUE,user_id INTEGER,program_id INTEGER,status TEXT,expires_at TEXT,smsmix_first_activated_at TEXT,smsmix_pending_days INTEGER NOT NULL DEFAULT 0);
CREATE TABLE vision7_smsmix_bindings(license_id TEXT PRIMARY KEY,device_hash TEXT,device_name TEXT,generation INTEGER);
CREATE TABLE security_rate_limits(rate_key TEXT PRIMARY KEY,hits INTEGER,window_start TEXT,blocked_until TEXT);
INSERT INTO users VALUES(1,'Owner A','a@example.test'),(2,'Owner B','b@example.test');
INSERT INTO vision7_programs VALUES(1,'sms-mix','android',1);`);
sqlite.exec(readFileSync(new URL('../migrations/0140_vsms_successful_sends.sql',import.meta.url),'utf8'));
const DB = {
  prepare(sql) {
    const statement={sql,args:[]};
    return {
      bind(...args) { statement.args=args; return this; },
      async first() {
        if (sql.includes('FROM sessions s JOIN users u')) return {id:1,role:DB.role,name:'Boss'};
        return sqlite.prepare(sql).get(...statement.args)||null;
      },
      async all() { return {results:sqlite.prepare(sql).all(...statement.args)}; },
      async run() { const result=sqlite.prepare(sql).run(...statement.args);return {meta:{changes:result.changes}}; },
      get __statement() {return statement;}
    };
  },
  role:'boss',
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const result=statements.map(x=>{
        if(suppressNextInsert && x.__statement.sql.includes('INSERT INTO vision7_smsmix_successful_sends')) {
          suppressNextInsert=false;return {meta:{changes:0}};
        }
        const y=sqlite.prepare(x.__statement.sql).run(...x.__statement.args);return {meta:{changes:y.changes}};
      });
      sqlite.exec('COMMIT');return result;
    } catch(error) {sqlite.exec('ROLLBACK');throw error;}
  }
};
const keyA='VD7-TEST-KEY-OWNER-A',keyB='VD7-TEST-KEY-OWNER-B',deviceA='device-A-1234',deviceB='device-B-1234';
sqlite.prepare("INSERT INTO vision7_licenses(id,key_hash,user_id,program_id,status,expires_at,smsmix_first_activated_at) VALUES(?,?,?,?,?,datetime('now','+30 days'),CURRENT_TIMESTAMP)").run('A',await hashLicenseKey(keyA),1,1,'active');
sqlite.prepare("INSERT INTO vision7_licenses(id,key_hash,user_id,program_id,status,expires_at,smsmix_first_activated_at) VALUES(?,?,?,?,?,datetime('now','+30 days'),CURRENT_TIMESTAMP)").run('B',await hashLicenseKey(keyB),2,1,'active');
sqlite.prepare('INSERT INTO vision7_smsmix_bindings VALUES(?,?,?,1)').run('A',await sha256(deviceA),'Android A');
sqlite.prepare('INSERT INTO vision7_smsmix_bindings VALUES(?,?,?,1)').run('B',await sha256(deviceB),'Android B');
let count=0;
const campaign='123e4567-e89b-42d3-a456-426614174000';
const item=(row_index,phone='+66800000001')=>({campaign_id:campaign,row_index,phone,sent_at:1700000000000+row_index});
async function post(key,device_id,items) {
  const response=await ingest({env:{DB},request:new Request('https://visiondonline.com/api/vision7/sms-mix/successful-sends',{
    method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'127.0.0.1'},body:JSON.stringify({key,device_id,items})})});
  return response;
}
const first=await post(keyA,deviceA,[item(0)]);
assert.equal(first.status,200);
assert.equal(first.headers.get('cache-control'),'private, no-store');
assert.equal((await post(keyA,deviceA,[item(0)])).status,200,'retry accepted idempotently');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_smsmix_successful_sends').get().n,1);
assert.equal((await post(keyA,deviceB,[item(1)])).status,403,'wrong device cannot inject');
assert.equal((await post(keyB,deviceB,[item(0)])).status,200,'same campaign/recipient on a different licensed device is distinct');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_smsmix_successful_sends').get().n,2);
assert.equal((await post(keyA,deviceA,[{...item(2),status:'FAILED'}])).status,400,'client status fields are rejected');
assert.equal((await post(keyA,deviceA,[{...item(2),body:'private text'}])).status,400,'message body is rejected');
assert.equal((await post(keyA,deviceA,[item(2),item(2)])).status,400,'duplicate batch rejected');
suppressNextInsert=true;
assert.equal((await post(keyA,deviceA,[item(99)])).status,503,'conditional insert no-op cannot be acknowledged');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_smsmix_successful_sends WHERE row_index=99').get().n,0);
sqlite.prepare("UPDATE vision7_licenses SET expires_at=datetime('now','-1 minute') WHERE id='A'").run();
assert.equal((await post(keyA,deviceA,[item(2)])).status,403,'expired key rejected');
sqlite.prepare("UPDATE vision7_licenses SET expires_at=datetime('now','+30 days') WHERE id='A'").run();
sqlite.prepare("DELETE FROM vision7_smsmix_bindings WHERE license_id='A'").run();
assert.equal((await post(keyA,deviceA,[item(2)])).status,403,'reset binding rejected');
sqlite.prepare('INSERT INTO vision7_smsmix_bindings VALUES(?,?,?,1)').run('A',await sha256(deviceA),'Android A');
for(let i=2;i<27;i++) assert.equal((await post(keyA,deviceA,[item(i)])).status,200);
async function page(cursor,session=true) {
  const response=await list({env:{DB},request:new Request(`https://visiondonline.com/api/admin/vision7/smsmix-successful-sends${cursor?`?cursor=${cursor}`:''}`,{
    headers:session?{cookie:'vd_session=test'}:{}})});
  return {response,body:await response.json()};
}
assert.equal((await page(null,false)).response.status,401);
DB.role='admin';assert.equal((await page(null)).response.status,403);
DB.role='boss';
const p1=await page(null),p2=await page(p1.body.next_cursor);
assert.equal(p1.body.items.length,24);assert.equal(p2.body.items.length,3);
assert.equal(new Set([...p1.body.items,...p2.body.items].map(x=>x.id)).size,27,'keyset has no duplicate/gap');
const allRows=[...p1.body.items,...p2.body.items];
assert.equal(allRows.filter(x=>x.license_id==='A').length,26);
for(const row of allRows.filter(x=>x.license_id==='A')) {
  assert.equal(row.user_name,'ไม่แสดง','logged-in owner name is masked in API');
  assert.equal(row.user_email,null,'logged-in owner email is masked in API');
  assert.equal('user_id' in row,false,'internal comparison ID is not exposed');
}
const other=allRows.find(x=>x.license_id==='B');
assert.equal(other.user_name,'Owner B');
assert.equal(other.user_email,'b@example.test');
assert.equal(p2.body.next_cursor,null);
assert.equal(p1.response.headers.get('cache-control'),'private, no-store');
const sql=`SELECT s.id FROM vision7_smsmix_successful_sends s WHERE s.id<? ORDER BY s.id DESC LIMIT 25`;
assert.match(sqlite.prepare('EXPLAIN QUERY PLAN '+sql).all(100).map(x=>x.detail).join(' '),/SEARCH s USING COVERING INDEX idx_vsms_success_recent/,'cursor uses recency index');
assert.equal(sqlite.prepare('SELECT user_id FROM vision7_smsmix_successful_sends WHERE license_id=? LIMIT 1').get('B').user_id,2,'owner comes from server license');
console.log('VSMS successful-send ingest/list PASS');
