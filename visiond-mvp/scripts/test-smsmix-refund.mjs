import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../functions/api/admin/orders/[id]/refund.js', import.meta.url), 'utf8');
const statement = source.match(/DB\.prepare\("(UPDATE vision7_licenses SET status='refunded'[^\"]+)"\)/)?.[1];
assert.ok(statement, 'refund must update issued Vision7 licenses');
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT,admin_note TEXT);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT);
CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY,order_id INTEGER,program_id INTEGER,status TEXT,source TEXT,updated_at TEXT);
INSERT INTO orders VALUES(1,'refunded','approved refund'),(2,'paid',NULL);
INSERT INTO vision7_programs VALUES(7,'sms-mix'),(8,'other');
INSERT INTO vision7_licenses(id,order_id,program_id,status,source) VALUES
 ('sms-refund',1,7,'active','paid_order'),('sms-unpaid',2,7,'active','paid_order'),
 ('sms-admin',1,7,'active','admin'),('other-refund',1,8,'active','paid_order');`);
assert.equal(sqlite.prepare(statement).run(1,1,'approved refund').changes, 1);
assert.equal(sqlite.prepare("SELECT status FROM vision7_licenses WHERE id='sms-refund'").get().status, 'refunded');
for (const id of ['sms-unpaid','sms-admin','other-refund'])
  assert.equal(sqlite.prepare('SELECT status FROM vision7_licenses WHERE id=?').get(id).status, 'active');
assert.equal(sqlite.prepare(statement).run(1,1,'approved refund').changes, 0, 'refund replay makes no extra change');
sqlite.close();
console.log('VSMS refund revokes only paid issued key PASS');
