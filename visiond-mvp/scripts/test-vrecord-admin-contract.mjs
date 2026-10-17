import assert from 'node:assert/strict';
import { validVRecordDraft, onRequestPost } from '../functions/api/admin/vision7/programs.js';

const monthly = { plan_code: 'monthly', price: 199, product_id: null };
const yearly = { plan_code: 'yearly', price: 999, product_id: null };
const valid = { name: 'V-Record', platform: 'windows', version: '0.6.0', minimumVersion: '0.6.0', active: 'false', rawPlans: [monthly, yearly], plans: [monthly, yearly], productId: null, multipart: true, hasCover: true, hasInstaller: true };
assert.equal(validVRecordDraft(valid), true);
for (const variation of [
  { multipart: false }, { hasCover: false }, { hasInstaller: false },
  { name: 'Other' }, { platform: 'android' }, { version: '0.6.1' }, { minimumVersion: '0.5.0' }, { active: 'true' }, { productId: 1 },
  { plans: [{ ...monthly, price: 198 }, yearly] }, { plans: [monthly, { ...yearly, price: 1000 }] },
  { plans: [monthly, yearly, { plan_code: 'lifetime', price: 1000 }] },
  { rawPlans: [monthly, yearly, { plan_code: 'invalid', price: 1 }] },
  { plans: [{ ...monthly, active: false }, yearly] },
  { plans: [{ ...monthly, product_id: 7 }, yearly] },
]) assert.equal(validVRecordDraft({ ...valid, ...variation }), false, JSON.stringify(variation));
let programWrites = 0;
const db = { prepare(sql) { return {
  bind() { return this; },
  async first() { return sql.includes('runtime_schema_state') ? { version: 999999 } : sql.includes('FROM sessions') ? { id: 1, role: 'boss' } : null; },
  async all() { return { results: [] }; },
  async run() { if (sql.includes('INSERT INTO vision7_programs')) programWrites++; return { meta: { last_row_id: 1 } }; },
}; } };
const response = await onRequestPost({
  env: { DB: db },
  request: new Request('https://visiondonline.com/api/admin/vision7/programs', {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: 'vd_session=unit-test' },
    body: JSON.stringify({ code: 'v-record', name: 'V-Record', description: 'Windows recorder', platform_type: 'windows', current_version: '0.6.0', minimum_version: '0.6.0', active: 'false', plans: [monthly, yearly] }),
  }),
});
assert.equal(response.status, 400, 'JSON request without cover and installer is rejected');
assert.equal(programWrites, 0, 'incomplete V-Record cannot reserve the unique code');
console.log('PASS V-Record admin API draft contract: exact Windows version, inactive state, two prices, no lifetime');
