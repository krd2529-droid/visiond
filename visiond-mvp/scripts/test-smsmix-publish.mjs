import assert from 'node:assert/strict';
import { validSmsMixDraft } from '../functions/api/admin/vision7/programs.js';
import { onRequestPost } from '../functions/api/admin/vision7/smsmix-publish.js';

const plans = [
  { plan_code: 'monthly', price: 999, duration_days: 30, active: true, product_id: null },
  { plan_code: 'yearly', price: 9999, duration_days: 365, active: true, product_id: null },
];
const draft = { name: 'VSMS', platform: 'android', version: '0.5.2', minimumVersion: '0.5.2', active: 'false', rawPlans: plans, plans, productId: null, multipart: true, hasCover: true, hasInstaller: true };
assert.equal(validSmsMixDraft(draft), true);
assert.equal(validSmsMixDraft({ ...draft, plans: [{ ...plans[0], duration_days: 31 }, plans[1]] }), false);
assert.equal(validSmsMixDraft({ ...draft, plans: [{ ...plans[0], price: 9990 }, plans[1]] }), false);
assert.equal(validSmsMixDraft({ ...draft, active: 'true' }), false);

const hash = 'a'.repeat(64), release = { object_key: 'vision7/releases/9/app', file_name: 'VSMS-0.5.2.apk', mime_type: 'application/vnd.android.package-archive', file_size: 250000, sha256: hash };
let active = 0, offerPrice = 99900, currentRelease = { ...release }, activated = 0;
const env = {
  FILES: { async head(key) { assert.equal(key, release.object_key); return { size: release.file_size, customMetadata: { sha256: release.sha256 } }; } },
  DB: { prepare(sql) { return {
    bind(...args) { this.args = args; return this; },
    async first() {
      if (sql.includes('runtime_schema_state')) return { version: 999999 };
      if (sql.includes('FROM sessions')) return { id: 8, role: 'boss' };
      if (sql.includes("FROM vision7_programs WHERE id=? AND code='sms-mix'")) return { id: 9, active, cover_url: '/cover.png', platform_type: 'android', current_version: '0.5.2', minimum_version: '0.5.2', trial_hours: 0, max_devices: 1, requires_online: 1 };
      if (sql.includes('SELECT id,code,app_name,app_description,cover_url,active FROM vision7_programs')) return { id: 9, code: 'sms-mix', app_name: 'VSMS', app_description: 'Android SMS', cover_url: '/cover.png', active };
      if (sql.includes('FROM vision7_releases WHERE program_id=')) return currentRelease;
      if (sql.includes('SELECT id,source,product_kind FROM products')) return { id: this.args[0], source: 'vision7', product_kind: 'vision7-key' };
      return null;
    },
    async all() {
      if (sql.includes('FROM vision7_plans')) return { results: [
        { id: 10, plan_code: 'monthly', name: '30 days', offer_price: offerPrice, duration_days: 30, product_id: 11, active: 1 },
        { id: 11, plan_code: 'yearly', name: '365 days', offer_price: 999900, duration_days: 365, product_id: 12, active: 1 },
      ] };
      return { results: [] };
    },
    async run() {
      if (sql.startsWith('UPDATE vision7_programs SET active=1')) {
        assert.deepEqual(this.args, [9, 9, release.object_key, release.file_size, release.sha256]);
        if (currentRelease.sha256 !== release.sha256) return { meta: { changes: 0 } };
        active = 1; activated++; return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    },
  }; } },
};
const request = apk_sha256 => ({ env, request: new Request('https://visiondonline.com/api/admin/vision7/smsmix-publish', { method: 'POST', headers: { cookie: 'vd_session=test', 'content-type': 'application/json' }, body: JSON.stringify({ program_id: 9, confirm: 'publish-vsms', apk_sha256 }) }) });
assert.equal((await onRequestPost(request('b'.repeat(64)))).status, 409, 'wrong inspected APK hash cannot publish');
offerPrice = 9900;
assert.equal((await onRequestPost(request(hash))).status, 409, 'wrong monthly price cannot publish');
offerPrice = 99900;
currentRelease = { ...release, sha256: 'c'.repeat(64) };
assert.equal((await onRequestPost(request(hash))).status, 409, 'replacement release cannot publish');
currentRelease = { ...release };
assert.equal((await onRequestPost(request(hash))).status, 200);
assert.equal(activated, 1);
console.log('VSMS staged offer and inspected APK publish guard PASS');
