import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/admin/vision7/licenses.js';

let role = 'boss', writes = [], plan = { plan_code: 'monthly', duration_days: 30, issue_cost: 99900 };
const DB = { prepare(sql) { return {
  sql,
  bind(...args) { this.args = args; return this; },
  async all() { return { results: sql.startsWith('PRAGMA table_info') ? ['binding_state', 'offer_price', 'key_ciphertext', 'issuance_type', 'issue_cost'].map(name => ({ name })) : [] }; },
  async first() {
    if (sql.includes('runtime_schema_state')) return { version: 999999 };
    if (sql.includes('FROM sessions')) return { id: 7, role };
    if (sql === 'SELECT id FROM users WHERE id=?') return this.args[0] === 91 ? { id: 91 } : null;
    if (sql.includes('FROM vision7_programs WHERE id=? AND active=1')) return this.args[0] === 74 ? { id: 74, code: 'sms-mix', platform_type: 'android', max_devices: 9 } : { id: 75, code: 'other-app', platform_type: 'windows', max_devices: 3 };
    if (sql.includes('FROM vision7_plans q')) return this.args[0] === 501 ? plan : null;
    return null;
  },
  async run() { if (sql.startsWith('INSERT INTO vision7_licenses') || sql.startsWith('INSERT INTO vision7_license_events')) writes.push({ sql, args: this.args }); return { meta: { changes: 1 } }; },
}; } };
const env = { DB, VISION7_LICENSE_ENCRYPTION_KEY: 'test-only-secret-of-at-least-32-characters' };
const post = body => onRequestPost({ env, request: new Request('https://visiondonline.com/api/admin/vision7/licenses', { method: 'POST', headers: { cookie: 'vd_session=test', 'content-type': 'application/json' }, body: JSON.stringify({ key_mode: 'vsms_manual', program_id: 74, user_id: 91, plan_id: 501, ...body }) }) });

for (const body of [{ key_mode: 'test' }, { key_mode: 'customer' }, { plan_id: 0 }, { user_id: 999 }, { user_id: null }, { test_duration: 'lifetime' }, { order_id: 42 }, { plan_id: 999 }]) {
  assert.notEqual((await post(body)).status, 201, `reject ${JSON.stringify(body)}`);
}
plan = { plan_code: 'lifetime', duration_days: 30, issue_cost: 99900 };
assert.equal((await post({})).status, 400, 'reject nonstandard plan code');
plan = { plan_code: 'monthly', duration_days: 31, issue_cost: 99900 };
assert.equal((await post({})).status, 400, 'reject nonstandard duration');
assert.equal(writes.length, 0, 'invalid requests do not issue keys');
role = 'customer';
assert.equal((await post({})).status, 403, 'customer cannot issue');
role = 'boss';
plan = { plan_code: 'monthly', duration_days: 30, issue_cost: 99900 };
for (const allowedPlan of [{ plan_code: 'monthly', duration_days: 30 }, { plan_code: 'yearly', duration_days: 365 }]) {
  plan = { ...allowedPlan, issue_cost: 99900 };
  const response = await post({});
  assert.equal(response.status, 201, `${allowedPlan.plan_code} admin issue`);
  const issued = writes.filter(x => x.sql.startsWith('INSERT INTO vision7_licenses')).at(-1).args;
  assert.equal(issued[4], 91, 'selected recipient');
  assert.equal(issued[5], 74, 'internal VSMS program ID');
  assert.equal(issued[6], 501, 'selected plan');
  assert.equal(issued[7], null, 'no paid order');
  assert.equal(issued[10], 1, 'one device');
  assert.equal(issued[11], 'admin_manual', 'distinct audit source');
  assert.equal(issued[13], 7, 'actor recorded');
  assert.equal(issued[14], 'admin_manual', 'distinct issuance type');
  assert.equal(issued[15], 0, 'no purchase cost claimed');
  assert.ok(writes.some(x => x.sql.startsWith('INSERT INTO vision7_license_events') && x.args[1] === 7), 'audit event names actor');
}
role = 'admin';
assert.equal((await post({})).status, 201, 'existing admin role can issue');
console.log('VSMS admin manual issue rejects invalid scope and writes audited 30/365-day one-device keys PASS');
