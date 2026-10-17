import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { fulfillVision7Order } from '../functions/_vision7_orders.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY); CREATE TABLE products(id INTEGER PRIMARY KEY);
CREATE TABLE orders(id INTEGER PRIMARY KEY,user_id INTEGER,status TEXT);
CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_id INTEGER,vision7_renew_license_id TEXT);
INSERT INTO users VALUES(1); INSERT INTO products VALUES(10);
INSERT INTO orders VALUES(1,1,'paid'),(2,1,'paid');`);
let failAt = 0;
const wrap = (sql, args = []) => ({
  bind(...values) { return wrap(sql, values); },
  async run() { const result = sqlite.prepare(sql).run(...args); return { meta: { changes: result.changes, last_row_id: result.lastInsertRowid } }; },
  async first() { return sqlite.prepare(sql).get(...args) || null; },
  async all() { return { results: sqlite.prepare(sql).all(...args) }; },
  sql, args,
});
const env = { VISION7_LICENSE_ENCRYPTION_KEY: 'local-test-only-vision7-crypto-key-32-chars', DB: {
  prepare: sql => wrap(sql),
  async batch(statements) {
    sqlite.exec('BEGIN');
    try {
      for (let i = 0; i < statements.length; i++) {
        if (failAt === i + 1) throw new Error(`injected batch step ${failAt}`);
        sqlite.prepare(statements[i].sql).run(...statements[i].args);
      }
      sqlite.exec('COMMIT');
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  },
} };
// Build the same local schema that the production fulfillment function ensures.
await fulfillVision7Order(env, { id: 999, user_id: 1 });
sqlite.exec(`INSERT INTO vision7_programs(id,code,platform_type,max_devices,trial_hours,active) VALUES(7,'v-record','windows',1,168,1);
INSERT INTO vision7_plans(id,program_id,product_id,plan_code,name,price,offer_price,duration_days,active) VALUES(8,7,10,'monthly','Monthly',19900,19900,30,1);
INSERT INTO order_items VALUES(20,1,10,NULL);`);
const order1 = { id: 1, user_id: 1 };
for (failAt of [1, 2, 3]) {
  await assert.rejects(fulfillVision7Order(env, order1), /injected batch step/);
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_licenses').get().n, 0, 'failed issue leaves no key');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_order_fulfillments').get().n, 0, 'failed issue leaves no marker');
}
failAt = 0;
const issued = await fulfillVision7Order(env, order1);
assert.equal(issued.length, 1);
const licenseId = issued[0].license_id;
assert.equal((await fulfillVision7Order(env, order1))[0].license_id, licenseId, 'replay keeps original key');
const originalExpiry = sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(licenseId).expires_at;
sqlite.prepare('INSERT INTO order_items VALUES(21,2,10,?)').run(licenseId);
const order2 = { id: 2, user_id: 1 };
for (failAt of [1, 2, 3]) {
  await assert.rejects(fulfillVision7Order(env, order2), /injected batch step/);
  assert.equal(sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(licenseId).expires_at, originalExpiry, 'failed renewal leaves term intact');
  assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_order_fulfillments WHERE order_item_id=21').get().n, 0, 'failed renewal leaves no marker');
}
failAt = 0;
const renewed = await fulfillVision7Order(env, order2);
assert.equal(renewed.length, 1);
assert.notEqual(sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(licenseId).expires_at, originalExpiry);
assert.equal((await fulfillVision7Order(env, order2))[0].existing, true, 'renewal replay does not extend again');
sqlite.exec(`INSERT INTO vision7_programs(id,code,platform_type,max_devices,trial_hours,active) VALUES(9,'sms-mix','android',1,0,1);
INSERT INTO products VALUES(11); INSERT INTO products VALUES(12);
INSERT INTO vision7_plans(id,program_id,product_id,plan_code,name,price,offer_price,duration_days,active)
VALUES(10,9,11,'monthly','30 days',99900,99900,30,1),(11,9,12,'yearly','365 days',999900,999900,365,1);
INSERT INTO orders VALUES(3,1,'paid'),(4,1,'paid'),(5,1,'paid'),(6,1,'paid');
INSERT INTO order_items VALUES(30,3,11,NULL),(31,4,12,NULL),(32,5,12,NULL),(33,6,11,NULL);`);
const smsOrder = { id: 3, user_id: 1 };
for (failAt of [1, 2, 3]) {
  await assert.rejects(fulfillVision7Order(env, smsOrder), /injected batch step/);
  assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM vision7_licenses WHERE program_id=9").get().n, 0, 'failed VSMS issue leaves no key');
}
failAt = 0;
const smsIssued = (await fulfillVision7Order(env, smsOrder))[0];
assert.equal(sqlite.prepare('SELECT user_id,max_devices,source FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).max_devices, 1);
assert.equal((await fulfillVision7Order(env, smsOrder))[0].license_id, smsIssued.license_id, 'VSMS issue replay preserves the key');
const smsExpiry = sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).expires_at;
assert.ok(Date.parse(smsExpiry.replace(' ', 'T') + 'Z') > Date.now() + 29 * 86400000);
sqlite.prepare('UPDATE order_items SET vision7_renew_license_id=? WHERE id=31').run(smsIssued.license_id);
const smsRenewOrder = { id: 4, user_id: 1 };
for (failAt of [1, 2, 3]) {
  await assert.rejects(fulfillVision7Order(env, smsRenewOrder), /injected batch step/);
  assert.equal(sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).expires_at, smsExpiry);
  assert.equal(sqlite.prepare('SELECT plan_id FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).plan_id, 10, 'failed 30→365 renewal leaves old plan');
}
failAt = 0;
assert.equal((await fulfillVision7Order(env, smsRenewOrder))[0].action, 'renewed');
const renewedSmsExpiry = sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).expires_at;
assert.ok(Date.parse(renewedSmsExpiry.replace(' ', 'T') + 'Z') > Date.parse(smsExpiry.replace(' ', 'T') + 'Z') + 364 * 86400000);
assert.equal(sqlite.prepare('SELECT plan_id FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).plan_id, 11, '30→365 renewal switches entitlement plan');
assert.equal((await fulfillVision7Order(env, smsRenewOrder))[0].existing, true);
assert.equal(sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).expires_at, renewedSmsExpiry);
sqlite.prepare('UPDATE order_items SET vision7_renew_license_id=? WHERE id=33').run(smsIssued.license_id);
const smsBackOrder = { id: 6, user_id: 1 };
for (failAt of [1, 2, 3]) {
  await assert.rejects(fulfillVision7Order(env, smsBackOrder), /injected batch step/);
  assert.equal(sqlite.prepare('SELECT expires_at,plan_id FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).plan_id, 11, 'failed 365→30 renewal leaves old plan');
}
failAt = 0;
assert.equal((await fulfillVision7Order(env, smsBackOrder))[0].action, 'renewed');
const smsBack = sqlite.prepare('SELECT expires_at,plan_id FROM vision7_licenses WHERE id=?').get(smsIssued.license_id);
assert.equal(smsBack.plan_id, 10, '365→30 renewal switches entitlement plan');
assert.ok(Date.parse(smsBack.expires_at.replace(' ', 'T') + 'Z') > Date.parse(renewedSmsExpiry.replace(' ', 'T') + 'Z') + 29 * 86400000);
assert.equal((await fulfillVision7Order(env, smsBackOrder))[0].existing, true);
sqlite.prepare("INSERT INTO orders VALUES(8,1,'paid')").run();
sqlite.prepare("INSERT INTO orders VALUES(9,1,'paid')").run();
sqlite.prepare('INSERT INTO order_items VALUES(35,8,11,?)').run(smsIssued.license_id);
sqlite.prepare('INSERT INTO order_items VALUES(36,9,11,?)').run(smsIssued.license_id);
const beforeParallel = sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).expires_at;
await Promise.all([8,9].map(id => fulfillVision7Order(env, { id, user_id: 1 }, {}, 'sms-mix')));
const afterParallel = sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(smsIssued.license_id).expires_at;
assert.ok(Date.parse(afterParallel.replace(' ', 'T') + 'Z') > Date.parse(beforeParallel.replace(' ', 'T') + 'Z') + 59 * 86400000, 'two paid renewals extend twice without stale-expiry loss');
const yearly = (await fulfillVision7Order(env, { id: 5, user_id: 1 }))[0];
const yearlyExpiry = sqlite.prepare('SELECT expires_at FROM vision7_licenses WHERE id=?').get(yearly.license_id).expires_at;
assert.ok(Date.parse(yearlyExpiry.replace(' ', 'T') + 'Z') > Date.now() + 364 * 86400000);
sqlite.exec("INSERT INTO orders VALUES(7,1,'paid'); INSERT INTO order_items VALUES(34,7,11,NULL);");
failAt = 2;
await assert.rejects(fulfillVision7Order(env, { id: 7, user_id: 1 }, {}, 'sms-mix'), /injected batch step/);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM vision7_order_fulfillments WHERE order_item_id=34').get().n, 0, 'post-payment failure leaves retryable paid item');
failAt = 0;
const recovered = (await fulfillVision7Order(env, { id: 7, user_id: 1 }, {}, 'sms-mix'))[0];
assert.equal(recovered.action, 'issued');
assert.equal((await fulfillVision7Order(env, { id: 7, user_id: 1 }, {}, 'sms-mix'))[0].existing, true, 'paid replay issues no second key');
sqlite.close();
console.log('V-Record and VSMS paid issue, cross-plan renewal, failure recovery and replay PASS');
