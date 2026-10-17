import assert from 'node:assert/strict';
import { onRequestPatch } from '../functions/api/admin/vision7/licenses.js';

let mutations = 0;
const env = { DB: { prepare(sql) { return {
  sql,
  bind(...args) { this.args = args; return this; },
  async all() { return { results: sql.startsWith('PRAGMA table_info') ? ['app_name','app_description','cover_url','product_id','offer_price','key_ciphertext','renewed_at','vision7_renew_license_id','participant_ciphertext','last_customer_message_at','last_outbound_at','attempts','last_attempt_at','event_timestamp'].map(name => ({ name })) : [] }; },
  async first() {
    if (sql.includes('runtime_schema_state')) return { version: 999999 };
    if (sql.includes('FROM sessions')) return { id: 8, role: 'boss' };
    if (sql.includes('FROM vision7_licenses l JOIN vision7_programs p')) return { id: 'vsms-paid-key', program_id: 9, plan_id: 10, status: 'refunded', expires_at: '2026-11-17 00:00:00', program_code: 'sms-mix' };
    return null;
  },
  async run() { if (sql.startsWith('UPDATE vision7_licenses') || sql.startsWith('INSERT INTO vision7_license_events')) mutations++; return { meta: { changes: 1 } }; },
}; } } };
const request = body => ({ env, request: new Request('https://visiondonline.com/api/admin/vision7/licenses', { method: 'PATCH', headers: { cookie: 'vd_session=test', 'content-type': 'application/json' }, body: JSON.stringify({ id: 'vsms-paid-key', ...body }) }) });
assert.equal((await onRequestPatch(request({ action: 'renew', plan_id: 10 }))).status, 403);
assert.equal((await onRequestPatch(request({ action: 'status', status: 'active' }))).status, 403);
assert.equal((await onRequestPatch(request({ action: 'status', status: 'trial' }))).status, 403);
assert.equal(mutations, 0, 'manual paid bypass never writes');
console.log('VSMS admin cannot renew or reactivate paid key without order PASS');
