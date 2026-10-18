import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost } from '../functions/api/admin/vision7/releases.js';

const apk = await readFile(new URL('../../sms-mix-app/app/build/outputs/apk/release/VSMS-v0.5.5-release.apk', import.meta.url));
const expectedHash = '6aae4a221b58b28146eea5e68e5a35147ef2f97211d2692122625436d9013713';
let role = 'boss', currentVersion = '0.5.4', minimumVersion = '0.5.4', forceUpdate = 0;
let oldRelease = true, badHead = false, staleBatch = false, partialAdvance = false, newRelease = null;
const objects = new Map([['vision7/releases/9/0.5.4-old', { size: 40000, customMetadata: { sha256: 'old', version: '0.5.4' } }]]);
const deleted = [];
const db = {
  prepare(sql) { return { sql,
    bind(...args) { this.args = args; return this; },
    async first() {
      if (sql.includes('runtime_schema_state')) return { version: 999999 };
      if (sql.includes('FROM sessions')) return { id: 8, role };
      if (sql.includes('FROM vision7_programs WHERE id=')) return { id: 9, code: 'sms-mix', active: 1, current_version: currentVersion, minimum_version: minimumVersion, force_update: forceUpdate };
      if (sql.includes("version='0.5.4'")) return oldRelease ? { id: 4 } : null;
      return null;
    },
    async all() { return { results: [] }; },
    async run() { return { meta: { changes: 0 } }; },
  }; },
  async batch(statements) {
    assert.equal(statements.length, 3, 'release insert, program advance and rollback assertion share one transaction');
    const [insert, advance, assertAdvanced] = statements;
    assert.match(insert.args[4], /^vision7\/releases\/9\/0\.5\.5-/);
    assert.deepEqual(insert.args.slice(0, 4), [9, '0.5.5', '0.5.4', 0]);
    assert.equal(insert.args[6], 'application/vnd.android.package-archive');
    assert.equal(insert.args[8], expectedHash);
    assert.deepEqual(advance.args.slice(0, 2), [9, 9]);
    assert.match(assertAdvanced.sql, /NOT EXISTS \(SELECT 1 FROM vision7_programs/);
    if (partialAdvance) {
      const sqlite = new DatabaseSync(':memory:');
      try {
        sqlite.exec("CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT,active INTEGER,current_version TEXT,minimum_version TEXT,force_update INTEGER,updated_at TEXT); CREATE TABLE vision7_releases(id INTEGER PRIMARY KEY,program_id INTEGER,version TEXT,minimum_version TEXT,mandatory INTEGER,object_key TEXT UNIQUE,file_name TEXT,mime_type TEXT,file_size INTEGER,sha256 TEXT,release_notes TEXT,created_by INTEGER,status TEXT DEFAULT 'published',UNIQUE(program_id,version)); INSERT INTO vision7_programs VALUES(9,'sms-mix',1,'0.5.4','0.5.4',0,NULL); INSERT INTO vision7_releases(program_id,version,minimum_version,mandatory,object_key,file_name,mime_type,file_size,sha256,release_notes) VALUES(9,'0.5.4','0.5.4',0,'vision7/releases/9/0.5.4-old','old.apk','application/vnd.android.package-archive',40000,'old',''); CREATE TRIGGER ignore_advance BEFORE UPDATE ON vision7_programs BEGIN SELECT RAISE(IGNORE); END;");
        sqlite.exec('BEGIN');
        assert.throws(() => {
          for (const statement of statements) sqlite.prepare(statement.sql).run(...statement.args);
        }, /UNIQUE/, 'a 1/0 insert/advance result must fail the same transaction');
        sqlite.exec('ROLLBACK');
        assert.deepEqual(sqlite.prepare('SELECT version FROM vision7_releases WHERE program_id=9 ORDER BY version').all().map(x => x.version), ['0.5.4']);
      } finally { sqlite.close(); }
      throw new Error('UNIQUE constraint failed: vision7_releases.program_id, vision7_releases.version');
    }
    if (staleBatch || currentVersion !== '0.5.4' || newRelease) return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }];
    newRelease = { id: 12, object_key: insert.args[4], sha256: insert.args[8] };
    currentVersion = '0.5.5';
    return [{ meta: { changes: 1, last_row_id: 12 } }, { meta: { changes: 1 } }];
  },
};
const files = {
  async put(key, bytes, options) { objects.set(key, { size: bytes.byteLength, customMetadata: options.customMetadata }); },
  async head(key) { const object = objects.get(key); return badHead && object ? { ...object, size: object.size - 1 } : object; },
  async delete(key) { deleted.push(key); objects.delete(key); },
};
const env = { DB: db, FILES: files };
function request({ version = '0.5.5', minimum = '0.5.4', mandatory = false, bytes = apk, name = 'VSMS-v0.5.5-release.apk' } = {}) {
  const form = new FormData();
  form.set('program_id', '9'); form.set('version', version); form.set('minimum_version', minimum);
  if (mandatory) form.set('mandatory', '1');
  form.set('file', new File([bytes], name, { type: 'application/vnd.android.package-archive' }));
  return { env, request: new Request('https://visiondonline.com/api/admin/vision7/releases', { method: 'POST', headers: { cookie: 'vd_session=test' }, body: form }) };
}
const status = async input => (await onRequestPost(request(input))).status;
role = 'admin'; assert.equal(await status(), 403, 'only Boss may publish the inspected APK'); role = 'boss';
assert.equal(await status({ version: '0.5.6' }), 409, 'no unapproved future version');
assert.equal(await status({ minimum: '0.5.5' }), 409, 'older 0.5.4 installs stay supported');
assert.equal(await status({ mandatory: true }), 409, 'no forced update');
assert.equal(await status({ name: 'wrong.zip' }), 409, 'APK filename required');
const altered = Buffer.from(apk); altered[100] ^= 1;
assert.equal(await status({ bytes: altered }), 409, 'direct API rejects any unsigned or altered bytes');
minimumVersion = '0.5.5'; assert.equal(await status(), 409); minimumVersion = '0.5.4';
forceUpdate = 1; assert.equal(await status(), 409); forceUpdate = 0;
oldRelease = false; assert.equal(await status(), 409); oldRelease = true;
assert.equal(objects.size, 1, 'all pre-upload failures preserve original release');
badHead = true; assert.equal(await status(), 502, 'incomplete R2 upload rejected'); badHead = false;
assert.equal(objects.size, 1, 'failed upload cleaned without deleting 0.5.4');
staleBatch = true; assert.equal(await status(), 409, 'stale program state cannot advance'); staleBatch = false;
assert.equal(objects.size, 1, 'stale upload cleaned without deleting 0.5.4');
partialAdvance = true; assert.equal(await status(), 409, 'failed program advance rolls release insert back'); partialAdvance = false;
assert.equal(newRelease, null, 'transaction rollback leaves no dangling published release');
assert.equal(objects.size, 1, 'partial advance cleanup retains only 0.5.4 object');
const response = await onRequestPost(request());
assert.equal(response.status, 201);
assert.deepEqual(await response.json(), { ok: true, id: 12, sha256: expectedHash });
assert.equal(currentVersion, '0.5.5');
assert.equal(minimumVersion, '0.5.4');
assert.equal(forceUpdate, 0);
assert.equal(objects.has('vision7/releases/9/0.5.4-old'), true, 'old download object remains');
assert.equal(objects.has(newRelease.object_key), true, 'new APK object remains');
assert.equal(await status(), 409, 'duplicate release cannot overwrite the published artifact');
assert.ok(deleted.length >= 2);
console.log('PASS VSMS 0.5.5 exact signed APK release, optional update, atomic state and failure preservation');
