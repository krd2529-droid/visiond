import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { issueLicense } from '../functions/_vision7.js';

const refund = readFileSync(new URL('../functions/api/admin/orders/[id]/refund.js', import.meta.url), 'utf8');
const trial = readFileSync(new URL('../functions/api/vision7/trial.js', import.meta.url), 'utf8');
const renewalCheck = refund.match(/SELECT 1 FROM vision7_order_fulfillments f JOIN vision7_licenses l ON l.id=f.license_id JOIN vision7_programs p ON p.id=l.program_id WHERE f.order_id=\? AND f.action='renewed' AND p.code='v-record' LIMIT 1/)?.[0];
const revoke = refund.match(/UPDATE vision7_licenses SET status='refunded'[^"\n]+/)?.[0];
const claim = trial.match(/INSERT INTO vision7_trial_entitlements\(user_id,program_id,started_at,expires_at\) VALUES\(\?,\?,CURRENT_TIMESTAMP,\?\) ON CONFLICT\(user_id,program_id\) DO NOTHING/)?.[0];
assert.ok(renewalCheck && revoke && claim, 'scoped lifecycle SQL is present');
const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT,admin_note TEXT);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT);
CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY,order_id INTEGER,program_id INTEGER,source TEXT,status TEXT,updated_at TEXT);
CREATE TABLE vision7_order_fulfillments(order_item_id INTEGER PRIMARY KEY,order_id INTEGER,license_id TEXT,action TEXT);
CREATE TABLE vision7_trial_entitlements(user_id INTEGER,program_id INTEGER,started_at TEXT,expires_at TEXT,license_id TEXT,PRIMARY KEY(user_id,program_id));
INSERT INTO orders VALUES(1,'refunded','reason'),(2,'paid',''),(3,'refunded','reason');
INSERT INTO vision7_programs VALUES(1,'v-record'),(2,'other');
INSERT INTO vision7_licenses VALUES('v1',1,1,'paid_order','active',NULL),('v2',2,1,'paid_order','active',NULL),('other',3,2,'paid_order','active',NULL);
INSERT INTO vision7_order_fulfillments VALUES(11,1,'v1','issued'),(22,2,'v2','renewed');`);
assert.equal(Boolean(db.prepare(renewalCheck).get(2)), true, 'renewal refund needs explicit review');
assert.equal(Boolean(db.prepare(renewalCheck).get(1)), false, 'initial issue can be revoked on refund');
assert.equal(db.prepare(revoke).run(1,1,'reason').changes, 1);
assert.equal(db.prepare("SELECT status FROM vision7_licenses WHERE id='v1'").get().status, 'refunded');
assert.equal(db.prepare("SELECT status FROM vision7_licenses WHERE id='v2'").get().status, 'active');
assert.equal(db.prepare("SELECT status FROM vision7_licenses WHERE id='other'").get().status, 'active');
assert.equal(db.prepare(claim).run(10,1,'2030-01-08 00:00:00').changes, 1);
assert.equal(db.prepare(claim).run(10,1,'2030-01-08 00:00:00').changes, 0, 'second trial claim cannot issue another key');
db.close();
const trialDb = new DatabaseSync(':memory:');
trialDb.exec(`CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY,key_hash TEXT,key_ciphertext TEXT,key_last4 TEXT,user_id INTEGER,program_id INTEGER,plan_id INTEGER,order_id INTEGER,status TEXT,expires_at TEXT,max_devices INTEGER,source TEXT,note TEXT,created_by INTEGER,issuance_type TEXT,issue_cost INTEGER);
CREATE TABLE vision7_trial_entitlements(user_id INTEGER,program_id INTEGER,license_id TEXT NOT NULL,started_at TEXT,expires_at TEXT,PRIMARY KEY(user_id,program_id));
CREATE TABLE vision7_license_events(license_id TEXT,actor_user_id INTEGER,event_type TEXT,detail TEXT);
CREATE TABLE vision7_order_fulfillments(order_item_id INTEGER PRIMARY KEY,order_id INTEGER,license_id TEXT,action TEXT);`);
let failAt = 0;
const trialDB = {
  prepare(sql) { return { bind(...args) { return { sql, args }; }, async run() { trialDb.prepare(sql).run(); } }; },
  async batch(statements) {
    trialDb.exec('BEGIN');
    try {
      for (let i = 0; i < statements.length; i++) {
        if (failAt === i + 1) throw new Error(`injected step ${failAt}`);
        trialDb.prepare(statements[i].sql).run(...statements[i].args);
      }
      trialDb.exec('COMMIT');
    } catch (error) { trialDb.exec('ROLLBACK'); throw error; }
  },
};
const env = { DB: trialDB, VISION7_LICENSE_ENCRYPTION_KEY: 'local-test-only-vision7-crypto-key-32-chars' };
const options = { userId: 77, programId: 9, status: 'trial', source: 'trial', maxDevices: 1, createdBy: 77, expiresAt: '2030-01-08 00:00:00', atomicTrialHours: 168 };
for (failAt of [1, 2, 3, 4]) {
  await assert.rejects(issueLicense(env, options), /injected step/);
  for (const table of ['vision7_licenses', 'vision7_trial_entitlements', 'vision7_license_events'])
    assert.equal(trialDb.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n, 0, `step ${failAt} rolls back ${table}`);
}
failAt = 0;
const out = await issueLicense(env, options);
assert.ok(out.key.startsWith('VD7-'));
assert.equal(trialDb.prepare('SELECT license_id FROM vision7_trial_entitlements').get().license_id, out.id);
await assert.rejects(issueLicense(env, options), /UNIQUE constraint failed/);
assert.equal(trialDb.prepare('SELECT COUNT(*) n FROM vision7_licenses').get().n, 1, 'duplicate claim cannot create orphan key');
trialDb.close();
const orderDb = new DatabaseSync(':memory:');
orderDb.exec(`CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY,key_hash TEXT,key_ciphertext TEXT,key_last4 TEXT,user_id INTEGER,program_id INTEGER,plan_id INTEGER,order_id INTEGER,status TEXT,expires_at TEXT,max_devices INTEGER,source TEXT,note TEXT,created_by INTEGER,issuance_type TEXT,issue_cost INTEGER);
CREATE TABLE vision7_order_fulfillments(order_item_id INTEGER PRIMARY KEY,order_id INTEGER,license_id TEXT,action TEXT);
CREATE TABLE vision7_license_events(license_id TEXT,actor_user_id INTEGER,event_type TEXT,detail TEXT);`);
let orderFailAt = 0;
const orderDB = {
  prepare(sql) { return { bind(...args) { return { sql, args }; }, async run() { orderDb.prepare(sql).run(); } }; },
  async batch(statements) {
    orderDb.exec('BEGIN');
    try { for (let i=0;i<statements.length;i++) { if (orderFailAt===i+1) throw new Error(`injected order step ${orderFailAt}`); orderDb.prepare(statements[i].sql).run(...statements[i].args); } orderDb.exec('COMMIT'); }
    catch(error) { orderDb.exec('ROLLBACK'); throw error; }
  },
};
const paid = { ...options, userId: 88, status: 'active', source: 'paid_order', orderId: 55, planId: 3, atomicTrialHours: null, atomicOrderItemId: 123 };
for (orderFailAt of [1,2,3]) {
  await assert.rejects(issueLicense({DB:orderDB,VISION7_LICENSE_ENCRYPTION_KEY:env.VISION7_LICENSE_ENCRYPTION_KEY},paid), /injected order step/);
  for (const table of ['vision7_licenses','vision7_order_fulfillments','vision7_license_events']) assert.equal(orderDb.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n,0,`paid step ${orderFailAt} rolls back ${table}`);
}
orderFailAt=0;
const paidKey=await issueLicense({DB:orderDB,VISION7_LICENSE_ENCRYPTION_KEY:env.VISION7_LICENSE_ENCRYPTION_KEY},paid);
assert.equal(orderDb.prepare('SELECT license_id FROM vision7_order_fulfillments').get().license_id,paidKey.id);
await assert.rejects(issueLicense({DB:orderDB,VISION7_LICENSE_ENCRYPTION_KEY:env.VISION7_LICENSE_ENCRYPTION_KEY},paid),/UNIQUE constraint failed/);
assert.equal(orderDb.prepare('SELECT COUNT(*) n FROM vision7_licenses').get().n,1,'paid replay cannot orphan a second key');
orderDb.close();
console.log('V-Record refund and transactional trial/paid issuance PASS');
