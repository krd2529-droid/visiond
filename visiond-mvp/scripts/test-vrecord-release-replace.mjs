import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/admin/vision7/releases.js';

let role = 'boss', active = 0, issued = false, race = false, corruptHead = false, programUpdates = 0, inserts = 0;
const release = { id: 12, object_key: 'vision7/releases/2/0.6.0-original', sha256: 'old' };
const objects = new Map([[release.object_key, { size: 40150169, customMetadata: { sha256: 'old' } }]]);
const deleted = [];
const db = { prepare(sql) { return {
  bind(...args) { this.args = args; return this; },
  async first() {
    if (sql.includes('runtime_schema_state')) return { version: 999999 };
    if (sql.includes('FROM sessions')) return { id: 8, role };
    if (sql.includes('FROM vision7_programs WHERE id=')) return { id: 2, code: 'v-record', active };
    if (sql.includes('FROM vision7_licenses WHERE program_id=')) return issued ? { id: 'issued' } : null;
    if (sql.includes('FROM vision7_releases WHERE program_id=')) return { ...release };
    return null;
  },
  async all() { return { results: [] }; },
  async run() {
    if (sql.startsWith('UPDATE vision7_releases')) {
      if (race || active || issued || this.args.at(-3) !== release.object_key) return { meta: { changes: 0 } };
      release.object_key = this.args[0]; release.sha256 = this.args[4];
      return { meta: { changes: 1 } };
    }
    if (sql.startsWith('UPDATE vision7_programs')) programUpdates++;
    if (sql.startsWith('INSERT INTO vision7_releases')) { inserts++; return { meta: { last_row_id: 14 } }; }
    return { meta: { changes: 0 } };
  },
}; } };
const files = {
  async put(key, bytes, options) { objects.set(key, { size: bytes.byteLength, customMetadata: options.customMetadata }); },
  async head(key) { const item = objects.get(key); return corruptHead && item ? { ...item, size: item.size - 1 } : item; },
  async delete(key) { deleted.push(key); objects.delete(key); },
};
const env = { DB: db, FILES: files };
function request(replace = true) {
  const form = new FormData();
  form.set('program_id', '2'); form.set('version', '0.6.0'); form.set('minimum_version', '0.6.0');
  form.set('file', new File([Buffer.alloc(120001, 7)], 'V-Record-0.6.0-VisionD.zip', { type: 'application/zip' }));
  if (replace) form.set('replace_inactive', '1');
  return { env, request: new Request('https://visiondonline.com/api/admin/vision7/releases', { method: 'POST', headers: { cookie: 'vd_session=test' }, body: form }) };
}
let response = await onRequestPost(request());
assert.equal(response.status, 200);
const success = await response.json();
assert.equal(success.replaced, true);
assert.equal(success.id, 12);
assert.notEqual(release.object_key, 'vision7/releases/2/0.6.0-original');
assert.equal(objects.has('vision7/releases/2/0.6.0-original'), true, 'old object is retained');
assert.equal(programUpdates, 0, 'inactive program stays inactive during swap');
assert.equal(inserts, 0, 'same-version release row is updated, not duplicated');

role = 'admin'; response = await onRequestPost(request()); assert.equal(response.status, 403, 'only boss can replace'); role = 'boss';
active = 1; response = await onRequestPost(request()); assert.equal(response.status, 409, 'active program cannot use replacement'); active = 0;
issued = true; response = await onRequestPost(request()); assert.equal(response.status, 409, 'issued license cannot use replacement'); issued = false;
const verifiedKey = release.object_key;
race = true; response = await onRequestPost(request()); assert.equal(response.status, 409, 'stale row is rejected'); race = false;
assert.equal(release.object_key, verifiedKey);
assert.ok(deleted.length, 'new upload is cleaned up on failed swap');
corruptHead = true; response = await onRequestPost(request()); assert.equal(response.status, 502, 'unverified upload cannot replace'); corruptHead = false;
assert.equal(release.object_key, verifiedKey);
assert.equal(objects.has(verifiedKey), true, 'last verified release remains');
console.log('PASS inactive V-Record release replacement: boss-only, verified object, atomic row swap, old object retained, failure rollback');
