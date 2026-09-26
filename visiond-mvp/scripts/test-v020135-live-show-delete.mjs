import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import {
  createLiveVersion,
  deleteLiveShow,
  downloadLivePackage,
  getLiveShow,
  listLiveShows,
  listLiveVersions,
  updateLiveShow,
} from '../functions/_live_center.js';
import { LIVE_PORTRAIT_CONSENT_POLICY, listLivePortraits, uploadLivePortrait } from '../functions/_live_portrait_foundation.js';
import { startLocalAudienceSession } from '../functions/_live_audience_foundation.js';
import { onRequestDelete as deleteRoute } from '../functions/api/admin/live-center/shows/[id].js';

const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const sharp = require('sharp');
const text = relative => readFile(new URL(relative, root), 'utf8');
const [migration112, migration113, migration114, serverSource, routeSource] = await Promise.all([
  text('migrations/0112_visiond_live_center.sql'),
  text('migrations/0113_live_photo_avatar_audience.sql'),
  text('migrations/0114_live_show_tombstones.sql'),
  text('functions/_live_center.js'),
  text('functions/api/admin/live-center/shows/[id].js'),
]);

assert.match(migration114, /WHERE deleted_at IS NULL/);
assert.match(migration114, /idx_live_shows_owner_id/);
assert.match(migration114, /LIVE_SHOW_HARD_DELETE_FORBIDDEN/);
assert.doesNotMatch(serverSource, /live_show_versions[\s\S]{0,120}DELETE FROM live_show_versions/);
assert.match(routeSource, /onRequestDelete=deleteLiveShow/);

class BoundStatement {
  constructor(owner, sql, bindings = []) { this.owner = owner; this.sql = sql; this.bindings = bindings; }
  bind(...bindings) { return new BoundStatement(this.owner, this.sql, bindings); }
  async first() { return this.owner.db.prepare(this.sql).get(...this.bindings) || null; }
  async all() { return { success: true, results: this.owner.db.prepare(this.sql).all(...this.bindings) }; }
  async run() {
    const result = this.owner.db.prepare(this.sql).run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) }, results: [] };
  }
}

class D1Mock {
  constructor(db) { this.db = db; this.queries = []; this.failBatch = ''; this.beforeBatch = null; }
  prepare(sql) { this.queries.push(sql); return new BoundStatement(this, sql); }
  async batch(statements) {
    const beforeBatch = this.beforeBatch;
    if (beforeBatch) {
      const consumed = await beforeBatch(statements);
      if (consumed !== false) this.beforeBatch = null;
    }
    if (this.failBatch === 'before') { this.failBatch = ''; throw new Error('synthetic delete pre-commit failure'); }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      if (this.failBatch === 'after') { this.failBatch = ''; throw new Error('synthetic delete commit-then-throw'); }
      return results;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }
}

class R2Mock {
  constructor() { this.objects = new Map(); this.deleteCalls = []; this.deleteFailures = new Set(); this.getCalls = 0; this.headCalls = 0; this.deleteGate = null; this.putGate = null; }
  seed(key, value = new Uint8Array([1, 2, 3])) { this.objects.set(key, value); }
  async put(key, value) {
    if (this.putGate) {
      const gate = this.putGate;
      gate.seen.resolve();
      await gate.release.promise;
    }
    this.objects.set(key, new Uint8Array(value));
  }
  async delete(key) {
    if (this.deleteGate) {
      this.deleteGate.seen.resolve();
      await this.deleteGate.release.promise;
    }
    this.deleteCalls.push(key);
    if (this.deleteFailures.has(key)) throw new Error('synthetic R2 delete failure');
    this.objects.delete(key);
  }
  async head(key) { this.headCalls += 1; return this.objects.has(key) ? { size: this.objects.get(key).byteLength, customMetadata: {} } : null; }
  async get(key) { this.getCalls += 1; return this.objects.has(key) ? { size: this.objects.get(key).byteLength, customMetadata: {}, body: this.objects.get(key) } : null; }
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  PRAGMA foreign_keys=ON;
  CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
  CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
  CREATE TABLE security_rate_limits(rate_key TEXT PRIMARY KEY,hits INTEGER NOT NULL,window_start TEXT NOT NULL,blocked_until TEXT);
  CREATE TABLE toys_center_products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,meta_id TEXT NOT NULL UNIQUE,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',brand TEXT NOT NULL DEFAULT '',product_line TEXT NOT NULL DEFAULT '',series TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL DEFAULT 'in stock',condition TEXT NOT NULL DEFAULT 'used',price_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'THB',quantity INTEGER NOT NULL DEFAULT 1,image_1_key TEXT NOT NULL,image_2_key TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE toys_center_product_images(
    id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL REFERENCES toys_center_products(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,image_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(product_id,position)
  );
  INSERT INTO users VALUES(1,'owner@example.com','owner','Owner','','admin','2026-01-01');
  INSERT INTO users VALUES(2,'member@example.com','member','Member','','member','2026-01-01');
  INSERT INTO users VALUES(3,'boss@example.com','boss','Boss','','boss','2026-01-01');
  INSERT INTO sessions VALUES('owner-session',1,'2099-01-01');
  INSERT INTO sessions VALUES('member-session',2,'2099-01-01');
  INSERT INTO sessions VALUES('boss-session',3,'2099-01-01');
  INSERT INTO toys_center_products(meta_id,slug,title,description,brand,product_line,series,price_cents,currency,quantity,image_1_key,status,availability,updated_at)
    VALUES('TOY-1','toy-1','Delete Test Toy','Safe','','','',12900,'THB',5,'toys/1.png','published','in stock','2026-09-26T01:00:00.000Z');
  INSERT INTO toys_center_product_images(product_id,position,image_key) VALUES(1,0,'toys/1.png');
`);
sqlite.exec(migration112);
sqlite.exec(migration113);
sqlite.exec(migration114);

const d1 = new D1Mock(sqlite);
const r2 = new R2Mock();
const env = { DB: d1, FILES: r2, LIVE_CENTER_LOCAL_TEST_ENABLED: '1' };
const waits = [];
const requestContext = (pathname, { method = 'GET', session = 'boss-session', params = {}, headers = {}, body } = {}) => {
  const requestHeaders = new Headers(headers);
  if (session) requestHeaders.set('cookie', `vd_session=${session}`);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload !== undefined) { requestHeaders.set('content-type', 'application/json'); requestHeaders.set('content-length', String(Buffer.byteLength(payload))); }
  return {
    request: new Request(`https://visiondonline.com${pathname}`, { method, headers: requestHeaders, body: payload }),
    env,
    params,
    waitUntil(promise) { waits.push(promise); },
  };
};
const json = response => response.json();
const deferred = () => {
  let resolve;
  const promise = new Promise(next => { resolve = next; });
  return { promise, resolve };
};
const portraitRequest = async (id, key, bytes, expectedRevision = 0) => {
  const form = new FormData();
  form.set('portrait', new Blob([bytes], { type: 'image/jpeg' }), 'delete-race-presenter.jpg');
  form.set('rights_consent', 'accepted');
  form.set('animation_consent', 'accepted');
  form.set('identity_scope', 'authorized_adult');
  form.set('consent_policy', LIVE_PORTRAIT_CONSENT_POLICY);
  form.set('expected_binding_revision', String(expectedRevision));
  const encoded = new Request(`https://visiondonline.com/api/admin/live-center/shows/${id}/presenter`, { method: 'POST', body: form });
  const body = await encoded.arrayBuffer();
  return new Request(encoded.url, {
    method: 'POST',
    headers: {
      cookie: 'vd_session=owner-session',
      'idempotency-key': key,
      'content-type': encoded.headers.get('content-type'),
      'content-length': String(body.byteLength),
    },
    body,
  });
};
const showId = number => `live_${number.toString(16).padStart(32, '0')}`;
const versionId = number => `livev_${number.toString(16).padStart(32, '0')}`;
const assetId = number => `livea_${number.toString(16).padStart(32, '0')}`;
const portraitId = number => `livep_${number.toString(16).padStart(32, '0')}`;
const runtimeId = number => `livert_${number.toString(16).padStart(32, '0')}`;
const nowFor = number => `2026-09-${String(1 + Math.floor(number / 24)).padStart(2, '0')}T${String(number % 24).padStart(2, '0')}:00:00.000Z`;
const addShow = sqlite.prepare(`INSERT INTO live_shows(id,title,description,avatar_preset,output_profile,scene_count,revision,create_idempotency_key,create_request_hash,last_mutation_key,created_by,updated_by,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
function insertShow(number, title = `Saved show ${number}`, owner = 1) {
  const id = showId(number), at = nowFor(number);
  addShow.run(id, title, '', 'visiond-default', 'landscape-1080p', 0, 1, `create.${number}`, 'a'.repeat(64), `mut_${number}`, owner, owner, at, at);
  return id;
}
const deleteRequest = (id, ownerId, title, revision, key, extra = {}) => deleteRoute(requestContext(`/api/admin/live-center/shows/${id}`, {
  method: 'DELETE', params: { id }, headers: { 'idempotency-key': key }, body: { owner_id: ownerId, title, expected_revision: revision, ...extra },
}));

// Authorization and validation always happen before show SQL or R2 access.
for (const [session, status] of [['', 401], ['member-session', 403]]) {
  d1.queries.length = 0;
  const before = [r2.getCalls, r2.headCalls, r2.deleteCalls.length];
  const denied = await deleteRoute(requestContext('/api/admin/live-center/shows/not-a-show', { method: 'DELETE', session, params: { id: 'not-a-show' }, headers: { 'idempotency-key': 'delete.auth.0001' }, body: {} }));
  assert.equal(denied.status, status);
  assert.equal(denied.headers.get('cache-control'), 'private, no-store');
  assert.equal(d1.queries.some(sql => /live_show/i.test(sql)), false);
  assert.deepEqual([r2.getCalls, r2.headCalls, r2.deleteCalls.length], before);
}
let response = await deleteRoute(requestContext('/api/admin/live-center/shows/not-a-show', { method: 'DELETE', params: { id: 'not-a-show' }, headers: { 'idempotency-key': 'delete.invalid.0001' }, body: { owner_id: 1, title: 'No', expected_revision: 1 } }));
assert.equal(response.status, 400);
assert.equal(response.headers.get('cache-control'), 'private, no-store');

const targetId = insertShow(100, 'Exact test show');
sqlite.prepare(`INSERT INTO live_show_scenes(id,show_id,position,product_id,product_meta_id_snapshot,product_title_snapshot,product_price_snapshot,product_currency_snapshot,product_stock_snapshot,product_cover_image_id_snapshot,product_cover_position_snapshot,product_cover_key_snapshot,product_cover_mime_snapshot,product_cover_size_snapshot,product_cover_etag_snapshot,script,cue_label,cue_duration_seconds,cue_transition)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('lives_' + '1'.repeat(32), targetId, 0, 1, 'TOY-1', 'Delete Test Toy', 12900, 'THB', 5, 1, 0, 'toys/1.png', 'image/png', 3, 'toy-etag', 'test script', '', 60, 'cut');
sqlite.prepare('UPDATE live_shows SET scene_count=1 WHERE id=?').run(targetId);
const targetVersion = versionId(100), packageKey = `live-center/packages/${targetId}/${targetVersion}.visiondlive`, copiedKey = `live-center/assets/${targetVersion}/asset.png`;
sqlite.prepare(`INSERT INTO live_show_versions(id,show_id,version_number,show_revision,schema_version,idempotency_key,request_hash,package_object_key,package_sha256,manifest_sha256,package_size,asset_count,created_by,created_at)
  VALUES(?,?,1,1,1,'version.delete.0001',?,?,?,?,3,1,1,?)`).run(targetVersion, targetId, 'b'.repeat(64), packageKey, 'c'.repeat(64), 'd'.repeat(64), nowFor(100));
sqlite.prepare(`INSERT INTO live_show_version_assets(id,show_id,version_id,scene_position,product_id_snapshot,source_image_id,source_position,object_key,mime_type,file_size,sha256,etag,created_at)
  VALUES(?,?,?,0,1,1,0,?,'image/png',3,?,'copy-etag',?)`).run(assetId(100), targetId, targetVersion, copiedKey, 'e'.repeat(64), nowFor(100));
const presenter = portraitId(100), presenterKey = `live-center/presenters/1/${targetId}/${presenter}.jpg`;
sqlite.prepare(`INSERT INTO live_presenter_assets(id,show_id,owner_id,object_key,mime_type,file_size,width,height,sha256,portrait_version,sanitizer_version,status,consent_policy,consent_attested_by,consent_attested_at,create_idempotency_key,request_hash,uploaded_by,created_at,updated_at)
  VALUES(?,?,1,?,'image/jpeg',3,512,512,?,1,'pixel-v1','active','adult-rights-and-animation-v1',1,?,'portrait.create.0001',?,1,?,?)`).run(presenter, targetId, presenterKey, 'f'.repeat(64), nowFor(100), '1'.repeat(64), nowFor(100), nowFor(100));
sqlite.prepare('INSERT INTO live_presenter_bindings(show_id,owner_id,presenter_asset_id,portrait_version,binding_revision,updated_by,updated_at) VALUES(?,1,?,1,1,1,?)').run(targetId, presenter, nowFor(100));
const localSession = runtimeId(100), avatarSession = runtimeId(101);
const addRuntime = sqlite.prepare(`INSERT INTO live_runtime_sessions(id,show_id,owner_id,presenter_asset_id,presenter_sha256,mode,provider_adapter,provider_session_resource_id,status,session_epoch,create_idempotency_key,request_hash,created_by,created_at,updated_at,expires_at)
  VALUES(?,?,1,?,?,?, ?,NULL,'active',1,?,?,1,?,?,?)`);
addRuntime.run(localSession, targetId, null, null, 'local_test', 'local-test', 'local.delete.0001', '2'.repeat(64), nowFor(100), nowFor(100), '2099-01-01');
addRuntime.run(avatarSession, targetId, presenter, 'f'.repeat(64), 'avatar', 'd-id', 'avatar.delete.0001', '3'.repeat(64), nowFor(100), nowFor(100), '2099-01-01');
sqlite.prepare(`INSERT INTO live_provider_resources(id,provider,resource_kind,owner_id,show_id,presenter_asset_id,runtime_session_id,parent_resource_id,provider_ref_ciphertext,provider_ref_hash,status,create_idempotency_key,create_request_hash,created_at,updated_at)
  VALUES('liver_00000000000000000000000000000100','d-id','stream',1,?,?,?,NULL,'ciphertext',?,'active','provider.delete.0001',?,?,?)`).run(targetId, presenter, avatarSession, '4'.repeat(64), '5'.repeat(64), nowFor(100), nowFor(100));
sqlite.prepare(`INSERT INTO live_audience_events(id,session_id,show_id,owner_id,source,external_event_hash,kind,viewer_ref_hash,viewer_label,question_text,product_id,priority,answer_kind,answer_text,status,attempts,created_at,updated_at,expires_at)
  VALUES('livee_00000000000000000000000000000100',?,?,1,'local_test',?,'comment',?,'Tester','price?',1,20,'grounded','129 baht','ready',0,?,?,?)`).run(localSession, targetId, '6'.repeat(64), '7'.repeat(64), nowFor(100), nowFor(100), '2099-01-01');
sqlite.prepare(`INSERT INTO live_portrait_upload_claims(id,show_id,owner_id,uploaded_by,idempotency_key,request_hash,status,lease_token,lease_expires_at,attempts,result_asset_id,last_error_code,created_at,updated_at,expires_at)
  VALUES('liveuc_00000000000000000000000000000100',?,1,1,'upload.delete.0001',?,'processing','lease_delete','2099-01-01',1,NULL,'',?,?, '2099-01-02')`).run(targetId, '8'.repeat(64), nowFor(100), nowFor(100));
r2.seed(packageKey); r2.seed(copiedKey); r2.seed(presenterKey);

const deleteBody = { owner_id: 1, title: 'Exact test show', expected_revision: 1 };
const cleanupGate = { seen: deferred(), release: deferred() };
r2.deleteGate = cleanupGate;
response = await deleteRequest(targetId, 1, deleteBody.title, 1, 'show.delete.0001');
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
const deleted = await json(response);
assert.equal(deleted.deleted_id, targetId);
assert.equal(deleted.cleanup_pending, true);
await cleanupGate.seen.promise;
assert.equal(r2.deleteCalls.length, 0, 'R2 is never part of the tombstone transaction/response success');
const tombstone = sqlite.prepare('SELECT scene_count,revision,deleted_at,deleted_by,delete_idempotency_key FROM live_shows WHERE id=?').get(targetId);
assert.equal(tombstone.scene_count, 0);
assert.equal(tombstone.revision, 2);
assert.ok(tombstone.deleted_at);
assert.equal(tombstone.deleted_by, 3);
assert.equal(tombstone.delete_idempotency_key, 'show.delete.0001');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_show_scenes WHERE show_id=?').get(targetId).count, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_audience_events WHERE show_id=?').get(targetId).count, 0);
assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM live_runtime_sessions WHERE show_id=? AND mode='local_test'").get(targetId).count, 0);
assert.equal(sqlite.prepare("SELECT status FROM live_runtime_sessions WHERE id=?").get(avatarSession).status, 'stopped');
assert.equal(sqlite.prepare('SELECT status FROM live_provider_resources WHERE show_id=?').get(targetId).status, 'delete_pending');
assert.equal(sqlite.prepare('SELECT presenter_asset_id FROM live_presenter_bindings WHERE show_id=?').get(targetId).presenter_asset_id, null);
assert.equal(sqlite.prepare('SELECT status FROM live_presenter_assets WHERE id=?').get(presenter).status, 'deleted');
assert.equal(sqlite.prepare('SELECT status FROM live_portrait_upload_claims WHERE show_id=?').get(targetId).status, 'error');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_show_versions WHERE show_id=?').get(targetId).count, 1, 'immutable version audit row is retained');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_show_version_assets WHERE show_id=?').get(targetId).count, 1, 'immutable copied-asset audit row is retained');
assert.equal(sqlite.prepare('SELECT object_key,status FROM live_portrait_object_cleanup_jobs WHERE show_id=?').get(targetId).object_key, presenterKey);

for (const [contextName, invoke] of [
  ['detail', () => getLiveShow(requestContext(`/api/admin/live-center/shows/${targetId}`, { params: { id: targetId } }))],
  ['versions', () => listLiveVersions(requestContext(`/api/admin/live-center/shows/${targetId}/versions`, { params: { id: targetId } }))],
  ['update', () => updateLiveShow(requestContext(`/api/admin/live-center/shows/${targetId}`, { method: 'PUT', params: { id: targetId }, body: { title: 'No revive', description: '', avatar_preset: 'visiond-default', output_profile: 'landscape-1080p', scenes: [], expected_revision: 2 } }))],
  ['create version', () => createLiveVersion(requestContext(`/api/admin/live-center/shows/${targetId}/versions`, { method: 'POST', params: { id: targetId }, headers: { 'idempotency-key': 'version.deleted.0001' }, body: { expected_revision: 2 } }))],
  ['presenter', () => listLivePortraits(requestContext(`/api/admin/live-center/shows/${targetId}/presenter`, { params: { id: targetId } }))],
  ['audience', () => startLocalAudienceSession(requestContext(`/api/admin/live-center/shows/${targetId}/audience/local-session`, { method: 'POST', params: { id: targetId }, headers: { 'idempotency-key': 'local.deleted.0001' }, body: { action: 'start' } }))],
]) {
  const blocked = await invoke();
  assert.equal(blocked.status, 404, `${contextName} must fail closed on a tombstone: ${await blocked.clone().text()}`);
  assert.equal(blocked.headers.get('cache-control'), 'private, no-store');
}
const r2BeforePackage = [r2.getCalls, r2.headCalls];
response = await downloadLivePackage(requestContext(`/api/admin/live-center/shows/${targetId}/versions/${targetVersion}/package`, { params: { id: targetId, versionId: targetVersion } }));
assert.equal(response.status, 404);
assert.deepEqual([r2.getCalls, r2.headCalls], r2BeforePackage, 'tombstoned package context fails before R2');

cleanupGate.release.resolve();
await Promise.all(waits.splice(0));
r2.deleteGate = null;
assert.deepEqual(r2.deleteCalls, [presenterKey]);
assert.equal(r2.objects.has(presenterKey), false);
assert.equal(r2.objects.has(packageKey), true, 'immutable package binary is retained');
assert.equal(r2.objects.has(copiedKey), true, 'immutable copied-asset binary is retained');
assert.equal(sqlite.prepare('SELECT status FROM live_portrait_object_cleanup_jobs WHERE show_id=?').get(targetId).status, 'done');

response = await deleteRequest(targetId, 1, deleteBody.title, 1, 'show.delete.0001');
assert.equal(response.status, 200);
assert.equal((await json(response)).replayed, true);
response = await deleteRequest(targetId, 1, 'Different title', 1, 'show.delete.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_IDEMPOTENCY_CONFLICT');
response = await deleteRequest(targetId, 1, deleteBody.title, 1, 'show.delete.concurrent');
assert.equal(response.status, 200, 'different-key same-payload concurrent replay is deterministic');

const failureId = insertShow(110, 'Failure stays visible');
d1.failBatch = 'before';
response = await deleteRequest(failureId, 1, 'Failure stays visible', 1, 'show.delete.failure');
assert.equal(response.status, 500);
assert.equal(sqlite.prepare('SELECT deleted_at FROM live_shows WHERE id=?').get(failureId).deleted_at, null);
const ambiguousId = insertShow(111, 'Ambiguous commit');
d1.failBatch = 'after';
response = await deleteRequest(ambiguousId, 1, 'Ambiguous commit', 1, 'show.delete.ambiguous');
assert.equal(response.status, 200, 'commit-then-throw reconciles to the persisted tombstone');
assert.equal((await json(response)).replayed, true);

const concurrentId = insertShow(112, 'Concurrent exact show');
const concurrent = await Promise.all([
  deleteRequest(concurrentId, 1, 'Concurrent exact show', 1, 'show.delete.concurrent.a'),
  deleteRequest(concurrentId, 1, 'Concurrent exact show', 1, 'show.delete.concurrent.b'),
]);
assert.deepEqual(concurrent.map(item => item.status), [200, 200]);
assert.equal((await Promise.all(concurrent.map(json))).filter(item => item.replayed).length, 1);

const ownerMismatchId = insertShow(113, 'Owner guard');
response = await deleteRequest(ownerMismatchId, 3, 'Owner guard', 1, 'show.delete.owner');
assert.equal(response.status, 404);
assert.equal(sqlite.prepare('SELECT deleted_at FROM live_shows WHERE id=?').get(ownerMismatchId).deleted_at, null);

// Deletion winning after the presenter object put but before the upload final
// batch must prevent every new asset/binding child from attaching to a tombstone.
const uploadRaceId = insertShow(114, 'Upload race show');
const raceJpeg = new Uint8Array(await sharp({
  create: { width: 320, height: 256, channels: 3, background: '#0b6e4f' },
}).jpeg({ quality: 86, progressive: false }).toBuffer());
let finalUploadBatchObserved = false;
d1.beforeBatch = async statements => {
  if (!statements.some(statement => statement.sql.includes('INSERT INTO live_presenter_assets'))) return false;
  finalUploadBatchObserved = true;
  const winner = await deleteRequest(uploadRaceId, 1, 'Upload race show', 1, 'show.delete.upload-race');
  assert.equal(winner.status, 200);
  return true;
};
const uploadRaceResponse = await uploadLivePortrait({
  request: await portraitRequest(uploadRaceId, 'portrait.upload.delete-race', raceJpeg),
  params: { id: uploadRaceId },
  env: {
    ...env,
    PORTRAIT_SANITIZER: {
      fetch: async () => new Response(raceJpeg, { headers: {
        'content-type': 'image/jpeg',
        'content-length': String(raceJpeg.byteLength),
        'x-visiond-sanitizer': 'cloudflare-images-v1',
      } }),
    },
  },
  waitUntil(promise) { waits.push(promise); },
});
assert.equal(finalUploadBatchObserved, true);
assert.equal(uploadRaceResponse.status, 409);
assert.equal((await json(uploadRaceResponse)).code, 'LIVE_PORTRAIT_UPLOAD_LEASE_STALE');
assert.ok(sqlite.prepare('SELECT deleted_at FROM live_shows WHERE id=?').get(uploadRaceId).deleted_at);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_presenter_assets WHERE show_id=?').get(uploadRaceId).count, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_presenter_bindings WHERE show_id=?').get(uploadRaceId).count, 0);
await Promise.all(waits.splice(0));

// Deletion winning after the orphan guard is persisted but before R2 put must
// not let an early "missing" cleanup become terminal and orphan the later put.
const prePutRaceId = insertShow(115, 'Pre-put upload race show');
const prePutGate = { seen: deferred(), release: deferred() };
r2.putGate = prePutGate;
const RealDate = globalThis.Date;
let fakeNow = RealDate.now();
let originalUploadLease = '';
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [fakeNow])); }
  static now() { return fakeNow; }
  static parse(value) { return RealDate.parse(value); }
  static UTC(...args) { return RealDate.UTC(...args); }
};
const prePutUpload = uploadLivePortrait({
  request: await portraitRequest(prePutRaceId, 'portrait.upload.pre-put-delete-race', raceJpeg),
  params: { id: prePutRaceId },
  env: {
    ...env,
    PORTRAIT_SANITIZER: {
      fetch: async () => {
        originalUploadLease = sqlite.prepare('SELECT lease_expires_at FROM live_portrait_upload_claims WHERE show_id=? AND idempotency_key=?').get(prePutRaceId, 'portrait.upload.pre-put-delete-race').lease_expires_at;
        fakeNow += 3 * 60 * 1000;
        return new Response(raceJpeg, { headers: {
          'content-type': 'image/jpeg',
          'content-length': String(raceJpeg.byteLength),
          'x-visiond-sanitizer': 'cloudflare-images-v1',
        } });
      },
    },
  },
  waitUntil(promise) { waits.push(promise); },
});
await prePutGate.seen.promise;
const prePutGuard = sqlite.prepare('SELECT id,object_key,status,next_attempt_at FROM live_portrait_object_cleanup_jobs WHERE show_id=?').get(prePutRaceId);
assert.equal(prePutGuard.status, 'reserved');
assert.ok(Date.parse(originalUploadLease) < Date.now(), 'sanitizer delay expires the original claim lease');
assert.ok(Date.parse(prePutGuard.next_attempt_at) > Date.now(), 'orphan guard is fenced until its upload lease expires');
assert.equal(sqlite.prepare('SELECT lease_expires_at FROM live_portrait_upload_claims WHERE show_id=?').get(prePutRaceId).lease_expires_at, prePutGuard.next_attempt_at, 'guard and renewed writer claim share one fence');
const prePutDelete = await deleteRequest(prePutRaceId, 1, 'Pre-put upload race show', 1, 'show.delete.pre-put-upload-race');
assert.equal(prePutDelete.status, 200);
await Promise.all(waits.splice(0));
const fencedPrePutGuard = sqlite.prepare('SELECT reason,status,next_attempt_at FROM live_portrait_object_cleanup_jobs WHERE id=?').get(prePutGuard.id);
assert.equal(fencedPrePutGuard.reason, 'orphan_guard');
assert.equal(fencedPrePutGuard.status, 'pending', 'delete worker cannot terminalize an absent object while its writer lease is fresh');
assert.equal(fencedPrePutGuard.next_attempt_at, prePutGuard.next_attempt_at);
assert.equal(r2.objects.has(prePutGuard.object_key), false);
assert.equal(r2.deleteCalls.filter(key => key === prePutGuard.object_key).length, 0);
r2.putGate = null;
prePutGate.release.resolve();
const prePutUploadResponse = await prePutUpload;
globalThis.Date = RealDate;
assert.equal(prePutUploadResponse.status, 409);
assert.equal((await json(prePutUploadResponse)).code, 'LIVE_PORTRAIT_UPLOAD_LEASE_STALE');
assert.equal(r2.objects.has(prePutGuard.object_key), false, 'post-put failure force-cleans the exact key even after the guard was done');
assert.equal(r2.deleteCalls.filter(key => key === prePutGuard.object_key).length, 1);
assert.equal(sqlite.prepare('SELECT status FROM live_portrait_object_cleanup_jobs WHERE id=?').get(prePutGuard.id).status, 'done');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_presenter_assets WHERE show_id=?').get(prePutRaceId).count, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_presenter_bindings WHERE show_id=?').get(prePutRaceId).count, 0);

// A successful upload whose sanitizer outlives the original claim lease proves
// final asset/claim CAS is bound to the fresh, still-live pre-put lease.
const slowSanitizerId = insertShow(118, 'Slow sanitizer renewal show');
let slowNow = RealDate.now();
let slowOriginalLease = '';
globalThis.Date = class extends RealDate {
  constructor(...args) { super(...(args.length ? args : [slowNow])); }
  static now() { return slowNow; }
  static parse(value) { return RealDate.parse(value); }
  static UTC(...args) { return RealDate.UTC(...args); }
};
const slowPutGate = { seen: deferred(), release: deferred() };
r2.putGate = slowPutGate;
const slowUpload = uploadLivePortrait({
  request: await portraitRequest(slowSanitizerId, 'portrait.upload.slow-renewal', raceJpeg),
  params: { id: slowSanitizerId },
  env: {
    ...env,
    PORTRAIT_SANITIZER: {
      fetch: async () => {
        slowOriginalLease = sqlite.prepare('SELECT lease_expires_at FROM live_portrait_upload_claims WHERE show_id=? AND idempotency_key=?').get(slowSanitizerId, 'portrait.upload.slow-renewal').lease_expires_at;
        slowNow += 3 * 60 * 1000;
        return new Response(raceJpeg, { headers: {
          'content-type': 'image/jpeg',
          'content-length': String(raceJpeg.byteLength),
          'x-visiond-sanitizer': 'cloudflare-images-v1',
        } });
      },
    },
  },
  waitUntil(promise) { waits.push(promise); },
});
await slowPutGate.seen.promise;
const slowRenewedLease = sqlite.prepare('SELECT lease_expires_at FROM live_portrait_upload_claims WHERE show_id=? AND idempotency_key=?').get(slowSanitizerId, 'portrait.upload.slow-renewal').lease_expires_at;
assert.ok(RealDate.parse(slowOriginalLease) < slowNow, 'original pre-sanitizer lease expired before R2 put');
assert.ok(RealDate.parse(slowRenewedLease) > slowNow, 'claim lease is renewed immediately before R2 put');
assert.notEqual(slowRenewedLease, slowOriginalLease);
r2.putGate = null;
slowPutGate.release.resolve();
const slowUploadResponse = await slowUpload;
globalThis.Date = RealDate;
assert.equal(slowUploadResponse.status, 201);
const slowUploadBody = await json(slowUploadResponse);
const slowClaim = sqlite.prepare('SELECT status,result_asset_id FROM live_portrait_upload_claims WHERE show_id=? AND idempotency_key=?').get(slowSanitizerId, 'portrait.upload.slow-renewal');
assert.equal(slowClaim.status, 'completed');
assert.equal(slowClaim.result_asset_id, slowUploadBody.item.id);
assert.ok(d1.queries.some(sql => sql.includes("status='processing' AND lease_token=? AND lease_expires_at=? AND lease_expires_at>?")), 'final asset/claim CAS requires the exact renewed unexpired lease');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_portrait_object_cleanup_jobs WHERE show_id=?').get(slowSanitizerId).count, 0, 'successful final CAS consumes its orphan guard');

// An exhausted pre-existing exact-key cleanup gets a fresh tombstone budget.
// Persistent failure remains truthfully pending, and a due same-key DELETE
// replay retries the capped job without claiming an autonomous scheduler.
const cleanupRetryId = insertShow(116, 'Cleanup retry show');
const exhaustedCleanupId = 'liveoc_00000000000000000000000000000116';
const exhaustedCleanupKey = `live-center/presenters/1/${cleanupRetryId}/exhausted.jpg`;
sqlite.prepare(`INSERT INTO live_portrait_object_cleanup_jobs(id,owner_id,show_id,presenter_asset_id,object_key,reason,status,idempotency_key,attempts,next_attempt_at,last_error_code,created_at,updated_at)
  VALUES(?,1,?,NULL,?,'orphan_guard','error','guard_exhausted',8,'2020-01-01T00:00:00.000Z','R2_DELETE_FAILED',?,?)`).run(exhaustedCleanupId, cleanupRetryId, exhaustedCleanupKey, nowFor(116), nowFor(116));
r2.seed(exhaustedCleanupKey);
r2.deleteFailures.add(exhaustedCleanupKey);
const cleanupRetryDelete = await deleteRequest(cleanupRetryId, 1, 'Cleanup retry show', 1, 'show.delete.cleanup-retry');
assert.equal(cleanupRetryDelete.status, 200);
assert.equal((await json(cleanupRetryDelete)).cleanup_pending, true);
await Promise.all(waits.splice(0));
let exhaustedCleanup = sqlite.prepare('SELECT status,attempts,next_attempt_at FROM live_portrait_object_cleanup_jobs WHERE id=?').get(exhaustedCleanupId);
assert.equal(exhaustedCleanup.status, 'error');
assert.equal(exhaustedCleanup.attempts, 1, 'tombstone gives an unresolved exhausted job a fresh bounded retry budget');
assert.equal(r2.objects.has(exhaustedCleanupKey), true);
sqlite.prepare("UPDATE live_portrait_object_cleanup_jobs SET attempts=8,next_attempt_at='2020-01-01T00:00:00.000Z' WHERE id=?").run(exhaustedCleanupId);
r2.deleteFailures.delete(exhaustedCleanupKey);
const cleanupRetryReplay = await deleteRequest(cleanupRetryId, 1, 'Cleanup retry show', 1, 'show.delete.cleanup-retry');
assert.equal(cleanupRetryReplay.status, 200);
const cleanupRetryReplayBody = await json(cleanupRetryReplay);
assert.equal(cleanupRetryReplayBody.replayed, true);
assert.equal(cleanupRetryReplayBody.cleanup_pending, true, 'an attempts=8 unresolved job is never reported complete');
await Promise.all(waits.splice(0));
exhaustedCleanup = sqlite.prepare('SELECT status,attempts,next_attempt_at FROM live_portrait_object_cleanup_jobs WHERE id=?').get(exhaustedCleanupId);
assert.equal(exhaustedCleanup.status, 'done');
assert.equal(r2.objects.has(exhaustedCleanupKey), false);
assert.equal(r2.deleteCalls.filter(key => key === exhaustedCleanupKey).length, 2);
const cleanupRetryComplete = await deleteRequest(cleanupRetryId, 1, 'Cleanup retry show', 1, 'show.delete.cleanup-retry');
assert.equal((await json(cleanupRetryComplete)).cleanup_pending, false);

// If an upload execution terminates after its delayed put, the persisted guard
// remains pending until the lease and a later exact DELETE replay can clean it.
const writerCrashId = insertShow(117, 'Writer crash cleanup show');
const writerCrashGuardId = 'liveoc_00000000000000000000000000000117';
const writerCrashKey = `live-center/presenters/1/${writerCrashId}/writer-crash.jpg`;
const writerLeaseExpiry = '2099-01-01T00:00:00.000Z';
sqlite.prepare(`INSERT INTO live_portrait_object_cleanup_jobs(id,owner_id,show_id,presenter_asset_id,object_key,reason,status,idempotency_key,attempts,next_attempt_at,last_error_code,created_at,updated_at)
  VALUES(?,1,?,NULL,?,'orphan_guard','reserved','guard_writer_crash',0,?,'',?,?)`).run(writerCrashGuardId, writerCrashId, writerCrashKey, writerLeaseExpiry, nowFor(117), nowFor(117));
const writerCrashDelete = await deleteRequest(writerCrashId, 1, 'Writer crash cleanup show', 1, 'show.delete.writer-crash');
assert.equal((await json(writerCrashDelete)).cleanup_pending, true);
await Promise.all(waits.splice(0));
let writerCrashGuard = sqlite.prepare('SELECT reason,status,next_attempt_at,last_error_code FROM live_portrait_object_cleanup_jobs WHERE id=?').get(writerCrashGuardId);
assert.equal(writerCrashGuard.reason, 'orphan_guard');
assert.equal(writerCrashGuard.status, 'pending');
assert.equal(writerCrashGuard.next_attempt_at, writerLeaseExpiry);
assert.equal(r2.deleteCalls.filter(key => key === writerCrashKey).length, 0);
sqlite.prepare("UPDATE live_portrait_object_cleanup_jobs SET next_attempt_at='2020-01-01T00:00:00.000Z' WHERE id=?").run(writerCrashGuardId);
const writerCrashAbsentReplay = await deleteRequest(writerCrashId, 1, 'Writer crash cleanup show', 1, 'show.delete.writer-crash');
assert.equal((await json(writerCrashAbsentReplay)).cleanup_pending, true);
await Promise.all(waits.splice(0));
writerCrashGuard = sqlite.prepare('SELECT reason,status,next_attempt_at,last_error_code FROM live_portrait_object_cleanup_jobs WHERE id=?').get(writerCrashGuardId);
assert.equal(writerCrashGuard.status, 'pending', 'non-writer cleanup cannot terminalize an absent orphan guard');
assert.equal(writerCrashGuard.last_error_code, 'R2_OBJECT_NOT_READY');
assert.ok(Date.parse(writerCrashGuard.next_attempt_at) > Date.now());
assert.equal(r2.deleteCalls.filter(key => key === writerCrashKey).length, 0);
r2.seed(writerCrashKey, new Uint8Array([9, 9, 9]));
sqlite.prepare("UPDATE live_portrait_object_cleanup_jobs SET next_attempt_at='2020-01-01T00:00:00.000Z' WHERE id=?").run(writerCrashGuardId);
const writerCrashLatePutReplay = await deleteRequest(writerCrashId, 1, 'Writer crash cleanup show', 1, 'show.delete.writer-crash');
assert.equal((await json(writerCrashLatePutReplay)).cleanup_pending, true);
await Promise.all(waits.splice(0));
writerCrashGuard = sqlite.prepare('SELECT reason,status,next_attempt_at,last_error_code FROM live_portrait_object_cleanup_jobs WHERE id=?').get(writerCrashGuardId);
assert.equal(writerCrashGuard.status, 'done');
assert.equal(writerCrashGuard.next_attempt_at, null);
assert.equal(r2.objects.has(writerCrashKey), false);
assert.equal(r2.deleteCalls.filter(key => key === writerCrashKey).length, 1);

// Keyset remains gap/duplicate-free when a future-page row is deleted.
for (let index = 200; index < 250; index++) insertShow(index);
d1.queries.length = 0;
const firstPageResponse = await listLiveShows(requestContext('/api/admin/live-center/shows?limit=24'));
const firstPage = await json(firstPageResponse);
const activeBefore = sqlite.prepare('SELECT id,title,revision,created_by owner_id FROM live_shows WHERE deleted_at IS NULL ORDER BY updated_at DESC,id DESC').all();
const futureVictim = activeBefore[30];
response = await deleteRequest(futureVictim.id, futureVictim.owner_id, futureVictim.title, futureVictim.revision, 'show.delete.pagination');
assert.equal(response.status, 200);
const collected = [...firstPage.items.map(item => item.id)];
let cursor = firstPage.pagination.next_cursor;
while (cursor) {
  const page = await json(await listLiveShows(requestContext(`/api/admin/live-center/shows?limit=24&cursor=${encodeURIComponent(cursor)}`)));
  collected.push(...page.items.map(item => item.id));
  cursor = page.pagination.next_cursor;
}
const expected = activeBefore.map(item => item.id).filter(id => id !== futureVictim.id);
assert.deepEqual(collected, expected);
assert.equal(new Set(collected).size, collected.length);
assert.equal(collected.includes(targetId), false);
const listSql = d1.queries.find(sql => sql.startsWith('SELECT id,title,description') && sql.includes('INDEXED BY idx_live_shows_updated'));
assert.ok(listSql);
let plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${listSql}`).all('9999-12-31T23:59:59.999Z', '~', 25).map(row => row.detail).join(' | ');
assert.match(plan, /idx_live_shows_updated/);
assert.doesNotMatch(plan, /TEMP B-TREE|\bSCAN\b/);
const ownerSql = d1.queries.find(sql => sql.includes('INDEXED BY idx_live_shows_owner_id WHERE created_by=? AND id=?'));
assert.ok(ownerSql);
plan = sqlite.prepare(`EXPLAIN QUERY PLAN ${ownerSql}`).all(1, futureVictim.id).map(row => row.detail).join(' | ');
assert.match(plan, /idx_live_shows_owner_id/);
assert.doesNotMatch(plan, /\bSCAN\b/);

assert.throws(() => sqlite.prepare('DELETE FROM live_shows WHERE id=?').run(failureId), /LIVE_SHOW_HARD_DELETE_FORBIDDEN/);
assert.throws(() => sqlite.prepare('UPDATE live_shows SET deleted_at=NULL WHERE id=?').run(targetId), /LIVE_SHOW_RESTORE_FORBIDDEN/);

console.log('v0.20.135 Live Center tombstone/delete auth, idempotency, audit retention, cleanup, active contexts, keyset and EXPLAIN checks passed');
