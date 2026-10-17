import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { onRequestPost } from '../functions/api/admin/vision7/vrecord-publish.js';

const signer = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const old = { object_key: 'vision7/releases/2/old', file_size: 120000, sha256: 'a'.repeat(64) };
let release = { ...old }, active = 0, replacementDuringHead = false, activated = 0;
const env = {
  VRECORD_LICENSE_SIGNING_PKCS8: signer,
  FILES: { async head(key) {
    assert.equal(key, old.object_key);
    if (replacementDuringHead) release = { ...old, object_key: 'vision7/releases/2/new', sha256: 'b'.repeat(64) };
    return { size: old.file_size, customMetadata: { sha256: old.sha256 } };
  } },
  DB: { prepare(sql) { return {
    bind(...args) { this.args = args; return this; },
    async first() {
      if (sql.includes('runtime_schema_state')) return { version: 999999 };
      if (sql.includes('FROM sessions')) return { id: 8, role: 'boss' };
      if (sql.includes('FROM vision7_programs WHERE id=')) return { id: 2, active, cover_url: '/cover.png', platform_type: 'windows', trial_hours: 168, max_devices: 1 };
      if (sql.includes('FROM vision7_releases WHERE program_id=')) return { ...old };
      return null;
    },
    async all() {
      if (sql.includes('FROM vision7_plans')) return { results: [
        { plan_code: 'monthly', offer_price: 19900, duration_days: 30, product_id: 5289 },
        { plan_code: 'yearly', offer_price: 99900, duration_days: 365, product_id: 5290 },
      ] };
      return { results: [] };
    },
    async run() {
      if (sql.startsWith('UPDATE vision7_programs SET active=1')) {
        assert.match(sql, /EXISTS \(SELECT 1 FROM vision7_releases/);
        assert.deepEqual(this.args, [2, 2, old.object_key, old.file_size, old.sha256]);
        if (release.object_key !== old.object_key || release.sha256 !== old.sha256) return { meta: { changes: 0 } };
        active = 1; activated++; return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    },
  }; } },
};
const request = () => ({ env, request: new Request('https://visiondonline.com/api/admin/vision7/vrecord-publish', { method: 'POST', headers: { cookie: 'vd_session=test', 'content-type': 'application/json' }, body: JSON.stringify({ program_id: 2, confirm: 'publish-v-record' }) }) });
replacementDuringHead = true;
const response = await onRequestPost(request());
assert.equal(response.status, 409);
assert.equal(active, 0, 'program cannot become active against a release other than the one checked');
assert.equal(activated, 0);
console.log('PASS publish/replacement race: unchecked new release cannot be activated');
