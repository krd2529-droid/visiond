import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequestPost as activate } from '../functions/api/vision7/sms-mix/activate.js';
import { onRequestPost as check } from '../functions/api/vision7/sms-mix/check.js';
import { hashLicenseKey } from '../functions/_vision7.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY, code TEXT, platform_type TEXT, active INTEGER);
CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY, key_hash TEXT UNIQUE, program_id INTEGER, status TEXT, expires_at TEXT);
CREATE TABLE vision7_smsmix_bindings(license_id TEXT PRIMARY KEY, device_hash TEXT NOT NULL, device_name TEXT NOT NULL DEFAULT 'Android', generation INTEGER NOT NULL DEFAULT 1, activated_at TEXT);
CREATE TABLE vision7_license_events(id INTEGER PRIMARY KEY, license_id TEXT, actor_user_id INTEGER, event_type TEXT, detail TEXT);
CREATE TABLE security_rate_limits(rate_key TEXT PRIMARY KEY, hits INTEGER, window_start TEXT, blocked_until TEXT);
INSERT INTO vision7_programs VALUES(1,'sms-mix','android',1);
INSERT INTO vision7_programs VALUES(2,'other','android',1);`);
let firstHook = null;

const DB = {
  prepare(sql) {
    const statement = { sql, args: [] };
    return {
      bind(...args) { statement.args = args; return this; },
      async first() {
        const value = sqlite.prepare(sql).get(...statement.args) || null;
        if (firstHook) await firstHook(sql, statement.args, value);
        return value;
      },
      all() { return { results: sqlite.prepare(sql).all(...statement.args) }; },
      run() { const result = sqlite.prepare(sql).run(...statement.args); return { meta: { changes: result.changes } }; },
      get __statement() { return statement; }
    };
  },
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map(statement => {
        const { sql, args } = statement.__statement;
        const result = sqlite.prepare(sql).run(...args);
        return { meta: { changes: result.changes } };
      });
      sqlite.exec('COMMIT');
      return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  }
};

async function request(handler, key, device_id, device_name = 'Test Android') {
  const ctx = { env: { DB }, request: new Request('https://visiondonline.com/api/vision7/sms-mix/test', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ key, device_id, device_name, app_version: '0.2.0' })
  }) };
  const response = await handler(ctx);
  return { status: response.status, headers: response.headers, body: await response.json() };
}

const key = 'VD7-SMSMIX-TEST-ONLY';
sqlite.prepare('INSERT INTO vision7_licenses VALUES(?,?,?,?,?)').run('one', await hashLicenseKey(key), 1, 'active', null);
sqlite.prepare('INSERT INTO vision7_licenses VALUES(?,?,?,?,?)').run('other', await hashLicenseKey('VD7-OTHER-TEST-ONLY'), 2, 'active', null);
assert.equal((await request(check, key, 'device-A-1234')).status, 403, 'check never activates');
assert.equal((await request(activate, key, 'device-A-1234', 'Pixel <7>\u0001')).status, 200);
assert.equal(sqlite.prepare('SELECT device_name FROM vision7_smsmix_bindings WHERE license_id=?').get('one').device_name, 'Pixel  7');
const bindingPlan = sqlite.prepare(`EXPLAIN QUERY PLAN SELECT b.device_name FROM vision7_licenses l
  JOIN vision7_smsmix_bindings b ON b.license_id=l.id WHERE l.key_hash=?`).all(await hashLicenseKey(key));
assert.match(bindingPlan.map(x => x.detail).join(' '), /sqlite_autoindex_vision7_smsmix_bindings_1/, 'bound-device detail uses binding PK');
assert.equal((await request(check, key, 'device-A-1234')).status, 200);
assert.equal((await request(activate, key, 'device-B-1234')).status, 200);
const afterB = sqlite.prepare('SELECT device_hash,generation FROM vision7_smsmix_bindings WHERE license_id=?').get('one');
assert.equal(afterB.generation, 2);
assert.equal(sqlite.prepare('SELECT device_name FROM vision7_smsmix_bindings WHERE license_id=?').get('one').device_name, 'Test Android');
const changesBeforeCheck = sqlite.prepare('SELECT total_changes() changes').get().changes;
assert.equal((await request(check, key, 'device-A-1234')).status, 403, 'old device cannot reclaim on check');
assert.deepEqual(sqlite.prepare('SELECT device_hash,generation FROM vision7_smsmix_bindings WHERE license_id=?').get('one'), afterB, 'check is read only');
assert.equal((await request(check, key, 'device-B-1234')).status, 200);
assert.equal(sqlite.prepare('SELECT total_changes() changes').get().changes, changesBeforeCheck, 'routine check makes zero DB writes');
assert.equal((await request(activate, key, 'device-A-1234')).status, 200);
assert.equal((await request(check, key, 'device-B-1234')).status, 403);
assert.equal(sqlite.prepare('SELECT generation FROM vision7_smsmix_bindings WHERE license_id=?').get('one').generation, 3);
assert.equal((await request(activate, 'VD7-OTHER-TEST-ONLY', 'device-A-1234')).status, 403, 'wrong program key');
sqlite.prepare("UPDATE vision7_licenses SET expires_at=datetime('now','-1 minute') WHERE id='one'").run();
assert.equal((await request(check, key, 'device-A-1234')).status, 403, 'monthly expiry enforced');
sqlite.prepare("UPDATE vision7_licenses SET expires_at=NULL,status='revoked' WHERE id='one'").run();
assert.equal((await request(check, key, 'device-A-1234')).status, 403, 'revocation enforced');

sqlite.prepare("UPDATE vision7_licenses SET status='active' WHERE id='one'").run();
let releaseA, aWrote;
const aWritten = new Promise(resolve => { aWrote = resolve; });
const waitA = new Promise(resolve => { releaseA = resolve; });
firstHook = async (sql, args) => {
  if (sql.includes('RETURNING device_hash,generation') && args[0] === await import('../functions/_lib.js').then(({ sha256 }) => sha256('device-A-1234'))) {
    firstHook = null;
    aWrote();
    await waitA;
  }
};
const racingA = request(activate, key, 'device-A-1234');
await aWritten;
assert.equal((await request(activate, key, 'device-B-1234')).status, 200);
releaseA();
assert.equal((await racingA).status, 403, 'stale activation response rejected after takeover');
assert.equal((await request(check, key, 'device-B-1234')).status, 200);

firstHook = async (sql) => {
  if (sql.includes('SELECT l.id,l.status,l.expires_at,p.active program_active')) {
    firstHook = null;
    sqlite.prepare("UPDATE vision7_licenses SET status='revoked' WHERE id='one'").run();
  }
};
assert.equal((await request(activate, key, 'device-A-1234')).status, 403, 'revoke between lookup and write rejected');
assert.equal((await request(check, key, 'device-A-1234')).status, 403);

sqlite.exec(`ALTER TABLE vision7_licenses ADD COLUMN user_id INTEGER;
ALTER TABLE vision7_licenses ADD COLUMN key_last4 TEXT;
ALTER TABLE vision7_licenses ADD COLUMN plan_id INTEGER;
ALTER TABLE vision7_licenses ADD COLUMN created_at TEXT;
ALTER TABLE vision7_programs ADD COLUMN product_id INTEGER;
ALTER TABLE vision7_programs ADD COLUMN current_version TEXT;
ALTER TABLE vision7_programs ADD COLUMN minimum_version TEXT;
ALTER TABLE vision7_programs ADD COLUMN force_update INTEGER;
ALTER TABLE vision7_programs ADD COLUMN requires_online INTEGER;
CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT);
CREATE TABLE products(id INTEGER PRIMARY KEY,title TEXT,cover_url TEXT);
CREATE TABLE vision7_plans(id INTEGER PRIMARY KEY,product_id INTEGER,name TEXT);
INSERT INTO users VALUES(7,'Owner','owner@example.test');
UPDATE vision7_licenses SET user_id=7,key_last4='TEST',created_at=CURRENT_TIMESTAMP WHERE id='one';
UPDATE vision7_programs SET current_version='0.2.0',minimum_version='0.2.0',force_update=0,requires_online=1 WHERE id=1;
UPDATE vision7_licenses SET status='active' WHERE id='one';`);
const sqlFrom = (relative, marker) => {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const offset = source.indexOf(marker);
  assert.ok(offset >= 0, `missing SQL marker ${marker}`);
  const match = source.slice(offset).match(/DB\.prepare\(`([\s\S]*?)`\)/);
  assert.ok(match, `missing SQL after ${marker}`);
  return match[1];
};
const ownerSql = sqlFrom('../functions/api/vision7/my-programs.js', 'const rows = await');
const adminSql = sqlFrom('../functions/api/admin/vision7/licenses/[id]/history.js', 'const license = await');
const ownerBound = sqlite.prepare(ownerSql).get(7);
const adminBound = sqlite.prepare(adminSql).get('one');
assert.equal(ownerBound.smsmix_device_name, 'Test Android');
assert.equal(adminBound.smsmix_device_name, 'Test Android');
assert.equal(ownerBound.smsmix_hash_suffix, adminBound.smsmix_hash_suffix);
assert.equal(ownerBound.smsmix_generation, adminBound.smsmix_generation);
assert.equal((await request(check, key, 'device-B-1234')).status, 200);
const adminSource = readFileSync(new URL('../functions/api/admin/vision7/licenses.js', import.meta.url), 'utf8');
const resetSql = adminSource.match(/DB\.prepare\("(DELETE FROM vision7_smsmix_bindings WHERE license_id=\?)"\)/)?.[1];
assert.ok(resetSql, 'admin reset must delete SMS Mix binding');
sqlite.prepare(resetSql).run('one');
assert.equal((await request(check, key, 'device-B-1234')).status, 403, 'admin reset revokes old device');
assert.equal(sqlite.prepare(ownerSql).get(7).smsmix_device_name, null, 'owner sees no bound device after reset');
assert.equal(sqlite.prepare(adminSql).get('one').smsmix_device_name, null, 'admin sees no bound device after reset');
console.log('PASS SMS Mix key-only single-device activation/check');
