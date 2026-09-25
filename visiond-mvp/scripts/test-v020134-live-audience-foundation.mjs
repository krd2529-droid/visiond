import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import {
  LIVE_AUDIENCE_CAPACITY_DISCARD_SQL,
  LIVE_AUDIENCE_PRODUCT_SQL,
  LIVE_AUDIENCE_STOP_DELETE_SQL,
  LIVE_AUDIENCE_STOP_REDACT_SQL,
  claimReadyLocalAudienceEvent,
  requeueStaleLiveAudienceClaims,
} from '../functions/_live_audience_foundation.js';

const root = new URL('../', import.meta.url);
const read = relative => fs.readFileSync(new URL(relative, root), 'utf8');
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
db.exec(`
  CREATE TABLE users(id INTEGER PRIMARY KEY);
  CREATE TABLE toys_center_products(
    id INTEGER PRIMARY KEY,
    meta_id TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    brand TEXT NOT NULL DEFAULT '',
    product_line TEXT NOT NULL DEFAULT '',
    series TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'THB',
    quantity INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'published',
    availability TEXT NOT NULL DEFAULT 'in stock',
    updated_at TEXT NOT NULL
  );
  CREATE TABLE toys_center_product_images(
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    image_key TEXT NOT NULL
  );
  INSERT INTO users(id) VALUES(1);
  INSERT INTO toys_center_products(id,title,price_cents,currency,quantity,updated_at) VALUES
    (101,'สินค้าในไลฟ์',9900,'THB',5,'2026-09-25T00:00:00.000Z'),
    (202,'สินค้านอกไลฟ์',19900,'THB',5,'2026-09-25T00:00:00.000Z');
`);
db.exec(read('migrations/0112_visiond_live_center.sql'));
db.exec(read('migrations/0113_live_photo_avatar_audience.sql'));

const showId = 'live_11111111111111111111111111111111';
const sessionId = 'livert_22222222222222222222222222222222';
const now = '2026-09-25T00:00:00.000Z';
const expires = '2026-09-25T02:00:00.000Z';
db.prepare(`INSERT INTO live_shows(id,title,description,avatar_preset,output_profile,scene_count,revision,create_idempotency_key,create_request_hash,last_mutation_key,created_by,updated_by,created_at,updated_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(showId, 'Show', '', 'visiond-default', 'landscape-1080p', 1, 1, 'show-create', 'a'.repeat(64), 'show-mut', 1, 1, now, now);
db.prepare(`INSERT INTO live_show_scenes(id,show_id,position,product_id,product_meta_id_snapshot,product_title_snapshot,product_price_snapshot,product_currency_snapshot,product_stock_snapshot,product_cover_image_id_snapshot,product_cover_position_snapshot,product_cover_key_snapshot,product_cover_mime_snapshot,product_cover_size_snapshot,product_cover_etag_snapshot,script,cue_label,cue_duration_seconds,cue_transition)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('scene-1', showId, 0, 101, 'meta-101', 'สินค้าในไลฟ์', 9900, 'THB', 5, 1, 0, 'cover.jpg', 'image/jpeg', 100, 'etag', '', '', 60, 'cut');
db.prepare(`INSERT INTO live_runtime_sessions(id,show_id,owner_id,mode,provider_adapter,status,session_epoch,create_idempotency_key,request_hash,created_by,created_at,updated_at,expires_at)
  VALUES(?,?,?,'local_test','local-test','active',1,?,?,?,?,?,?)`).run(sessionId, showId, 1, 'session-create', 'b'.repeat(64), 1, now, now, expires);

const insertEvent = db.prepare(`INSERT INTO live_audience_events(id,session_id,show_id,owner_id,source,external_event_hash,kind,viewer_ref_hash,viewer_label,question_text,product_id,priority,answer_kind,answer_text,status,attempts,created_at,updated_at,expires_at)
  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const eventArgs = index => {
  const at = `2026-09-25T00:00:${String(index).padStart(2, '0')}.000Z`;
  return [
    `livee_${index.toString(16).padStart(32, '0')}`, sessionId, showId, 1, 'local_test',
    index.toString(16).padStart(64, '0'), 'viewer_join', (index + 100).toString(16).padStart(64, '0'),
    `ผู้ชม ${index}`, '', 101, 10, 'greeting', `สวัสดี ${index}`, 'ready', 0, at, at, expires,
  ];
};

for (let index = 1; index <= 23; index += 1) insertEvent.run(...eventArgs(index));
assert.equal(db.prepare("SELECT COUNT(*) count FROM live_audience_events WHERE session_id=? AND status IN ('ready','claimed')").get(sessionId).count, 23);
insertEvent.run(...eventArgs(24));
assert.equal(db.prepare("SELECT COUNT(*) count FROM live_audience_events WHERE session_id=? AND status IN ('ready','claimed')").get(sessionId).count, 24);
assert.throws(() => insertEvent.run(...eventArgs(25)), /LIVE_AUDIENCE_CAPACITY/, '25th equal-priority event must fail closed');

const capacityId = 'livee_ffffffffffffffffffffffffffffffff';
assert.doesNotThrow(() => db.prepare(LIVE_AUDIENCE_CAPACITY_DISCARD_SQL).run(
  capacityId, sessionId, showId, 1, 'f'.repeat(64), 'viewer_join',
  101, 10, 'greeting', now, now, expires,
), 'capacity tombstone SQL must have exactly aligned columns and binds');
assert.deepEqual({ ...db.prepare('SELECT product_id,priority,answer_kind,answer_text,status,viewer_ref_hash,viewer_label,question_text FROM live_audience_events WHERE id=?').get(capacityId) }, {
  product_id: 101,
  priority: 10,
  answer_kind: 'greeting',
  answer_text: '',
  status: 'discarded',
  viewer_ref_hash: '0'.repeat(64),
  viewer_label: '',
  question_text: '',
});

assert.equal(db.prepare(LIVE_AUDIENCE_PRODUCT_SQL).get(101, showId)?.title, 'สินค้าในไลฟ์');
assert.equal(db.prepare(LIVE_AUDIENCE_PRODUCT_SQL).get(202, showId), undefined, 'an arbitrary catalog product outside this show must be rejected');

db.prepare("UPDATE live_audience_events SET status='claimed',claim_token='claim_test',claimed_at=? WHERE session_id=? AND status='ready'").run(now, sessionId);
assert.throws(() => insertEvent.run(...eventArgs(26)), /LIVE_AUDIENCE_CAPACITY/, 'claimed fan-out must still consume the 24-event outstanding cap');
assert.equal(db.prepare("SELECT COUNT(*) count FROM live_audience_events WHERE session_id=? AND status IN ('ready','claimed')").get(sessionId).count, 24);

const stopKey = 'stop-idempotency';
const stopHash = 'c'.repeat(64);
db.prepare("UPDATE live_runtime_sessions SET status='stopped',stop_idempotency_key=?,stop_request_hash=?,updated_at=?,stopped_at=? WHERE id=?").run(stopKey, stopHash, now, now, sessionId);
const stopResult = db.prepare(LIVE_AUDIENCE_STOP_REDACT_SQL).run(now, sessionId, 1, showId, stopKey, stopHash);
assert.equal(stopResult.changes, 24, 'one bounded stop redacts the entire outstanding queue because capacity is 24');
assert.equal(db.prepare("SELECT COUNT(*) count FROM live_audience_events WHERE session_id=? AND status IN ('ready','claimed')").get(sessionId).count, 0);
assert.equal(db.prepare("SELECT COUNT(*) count FROM live_audience_events WHERE session_id=? AND (viewer_label<>'' OR question_text<>'' OR answer_text<>'')").get(sessionId).count, 0, 'stop leaves no queued PII');
assert.equal(db.prepare("SELECT COUNT(*) count FROM live_audience_events WHERE session_id=? AND viewer_ref_hash<>?").get(sessionId, '0'.repeat(64)).count, 0, 'stop replaces every queued viewer hash with one non-identity tombstone');
assert.equal(db.prepare('SELECT COUNT(*) count FROM live_audience_events WHERE session_id=?').get(sessionId).count, 25, 'stop tombstones rather than issuing an unbounded delete');
const firstDelete = db.prepare(LIVE_AUDIENCE_STOP_DELETE_SQL).run(sessionId, 1, showId, stopKey, stopHash);
assert.equal(firstDelete.changes, 24, 'one retention checkpoint deletes no more than 24 tombstones');
assert.equal(db.prepare('SELECT COUNT(*) count FROM live_audience_events WHERE session_id=?').get(sessionId).count, 1);
const secondDelete = db.prepare(LIVE_AUDIENCE_STOP_DELETE_SQL).run(sessionId, 1, showId, stopKey, stopHash);
assert.equal(secondDelete.changes, 1, 'idempotent retry drains the bounded remainder');
assert.equal(db.prepare('SELECT COUNT(*) count FROM live_audience_events WHERE session_id=?').get(sessionId).count, 0);

const productPlan = db.prepare(`EXPLAIN QUERY PLAN ${LIVE_AUDIENCE_PRODUCT_SQL}`).all(101, showId).map(row => row.detail).join(' | ');
assert.match(productPlan, /INTEGER PRIMARY KEY/);
assert.match(productPlan, /idx_live_scenes_show_product/);
assert.doesNotMatch(productPlan, /\bSCAN\b|TEMP B-TREE/);
const claimPlan = db.prepare(`EXPLAIN QUERY PLAN SELECT id FROM live_audience_events INDEXED BY idx_live_audience_claim_expiry
  WHERE session_id=? AND status='claimed' AND claimed_at<=? ORDER BY claimed_at,id LIMIT 1`).all(sessionId, now).map(row => row.detail).join(' | ');
assert.match(claimPlan, /idx_live_audience_claim_expiry/);
assert.doesNotMatch(claimPlan, /\bSCAN\b|TEMP B-TREE/);

let noDueRuns = 0;
let noDuePrepares = 0;
const noDueEnv = { DB: { prepare() {
  noDuePrepares += 1;
  return { bind() { return this; }, async first() { return null; }, async run() { noDueRuns += 1; } };
} } };
await requeueStaleLiveAudienceClaims(noDueEnv, { ownerId: 1, id: showId }, sessionId, now);
assert.equal(noDuePrepares, 1, 'an ordinary empty poll performs only the indexed due read');
assert.equal(noDueRuns, 0, 'an ordinary empty poll performs zero writes');

let emptyClaimPrepares = 0;
const emptyClaimEnv = { DB: { prepare(sql) {
  emptyClaimPrepares += 1;
  assert.match(sql, /^SELECT e\.id/);
  return { bind() { return this; }, async first() { return null; } };
} } };
assert.equal(await claimReadyLocalAudienceEvent(emptyClaimEnv, { ownerId: 1, id: showId }, sessionId, now, 'claim_11111111111111111111111111111111'), null);
assert.equal(emptyClaimPrepares, 1, 'an empty queue poll performs a read preflight and never prepares UPDATE RETURNING');

let duePrepares = 0;
let dueRuns = 0;
const dueEnv = { DB: { prepare(sql) {
  duePrepares += 1;
  if (duePrepares === 2) assert.match(sql, /LIMIT 24/);
  return { bind() { return this; }, async first() { return { id: 'due' }; }, async run() { dueRuns += 1; return { meta: { changes: 1 } }; } };
} } };
await requeueStaleLiveAudienceClaims(dueEnv, { ownerId: 1, id: showId }, sessionId, '2026-09-25T00:02:00.000Z');
assert.equal(duePrepares, 2);
assert.equal(dueRuns, 1, 'only an observed stale claim reaches the bounded repair write');

console.log(JSON.stringify({ outstandingCap: 24, stopRedacted: stopResult.changes, retentionBatches: [firstDelete.changes, secondDelete.changes], productPlan, claimPlan }, null, 2));
console.log('PASS v0.20.134 audience capacity/show-grounding/bounded-privacy/ฐ1 gate');
db.close();
