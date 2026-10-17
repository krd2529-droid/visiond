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
sqlite.close();
console.log('V-Record paid issue/renewal failure and replay PASS');
