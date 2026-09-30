import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

import { isLikelyContentImageUrl } from '../functions/_vsport.js';
import { onRequestGet, onRequestPost } from '../functions/api/admin/vsport.js';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = new URL('../', import.meta.url);
const text = relative => readFile(new URL(relative, root), 'utf8');
const [migration111, migration115, migration117] = await Promise.all([
  text('migrations/0111_vsport.sql'),
  text('migrations/0115_vsport_project_delete.sql'),
  text('migrations/0117_vsport_headline_lookup.sql'),
]);

const urls = Object.freeze({
  validOne: 'https://img.example.test/news/valid-one.png',
  caret: 'https://img.covers.com/covers/header_v2/covers-header-v2-dropdown-caret.png',
  simpleCaret: 'https://img.covers.com/covers/header_v2/dropdown-caret.png',
  negotiatedUnsupported: 'https://img.example.test/news/unsupported.PNG?auto=compress&auto=format',
  legacyRecovery: 'https://img.covers.com/cms/covers/11111111-2222-4333-8444-555555555555.PNG?auto=compress&auto=format',
  crop: 'https://img.covers.com/cms/covers/hero.JPG?w=64&h=64&auto=compress&auto=format&fit=crop',
  validTwo: 'https://img.example.test/news/valid-two.png',
});

for (const value of [urls.caret, urls.simpleCaret, urls.crop]) assert.equal(isLikelyContentImageUrl(value), false, value);
for (const value of [
  urls.negotiatedUnsupported,
  urls.legacyRecovery,
  'https://img.example.test/news/photo.jpg?w=64',
  'https://img.example.test/news/photo.jpg?h=64',
  'https://img.example.test/news/photo.jpg?w=320&h=180',
  'https://img.example.test/news/photo.jpg?width=1920&height=1080',
  'https://img.example.test/news/dropdown-caret-feature.jpg',
  'https://img.example.test/news/iconic-goal.jpg',
  'https://img.example.test/news/flagship-signing.jpg',
  'https://img.example.test/news/catalogue-photo.jpg',
  'https://img.example.test/news/club-logo-reveal.jpg',
  'https://img.example.test/news/england-flag-celebration.jpg',
]) assert.equal(isLikelyContentImageUrl(value), true, value);
for (const value of [
  'https://img.example.test/news/photo.jpg?w=319&h=180',
  'https://img.example.test/news/photo.jpg?w=320&h=179',
  'https://img.example.test/news/photo.jpg?width=64&height=64',
  'https://img.example.test/news/photo.jpg?W=64&H=64',
]) assert.equal(isLikelyContentImageUrl(value), false, value);

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
  constructor(db) { this.db = db; this.queries = []; }
  prepare(sql) { this.queries.push(sql); return new BoundStatement(this, sql); }
  async batch(statements) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }
}
class R2Mock {
  constructor() { this.objects = new Map(); this.putCalls = []; }
  async put(key, value) { this.putCalls.push(key); this.objects.set(key, new Uint8Array(value)); }
  async head(key) { return this.objects.has(key) ? { size: this.objects.get(key).byteLength } : null; }
  async delete(key) { this.objects.delete(key); }
}

const db = new DatabaseSync(':memory:');
db.exec(`
PRAGMA foreign_keys=ON;
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT);
CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,active INTEGER);
CREATE TABLE courses(id INTEGER PRIMARY KEY,product_id INTEGER,course_type TEXT);
CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER);
INSERT INTO users VALUES(1,'admin@example.test','admin','Admin','','admin','2026-01-01');
INSERT INTO sessions VALUES('admin-session',1,'2099-01-01');
`);
db.exec(migration111);
db.exec(migration115);
db.exec(migration117);
const d1 = new D1Mock(db);
const r2 = new R2Mock();
const env = { DB: d1, FILES: r2 };
const context = (method, { body, url = 'https://visiondonline.com/api/admin/vsport' } = {}) => {
  const headers = new Headers({ cookie: 'vd_session=admin-session' });
  let payload;
  if (body !== undefined) { payload = JSON.stringify(body); headers.set('content-type', 'application/json'); }
  return { request: new Request(url, { method, headers, body: payload }), env, waitUntil() {} };
};
const json = async response => ({ status: response.status, body: await response.json() });
const newProject = title => Number(db.prepare("INSERT INTO vsport_projects(owner_id,title,news_date,scope_mode,team_name,target_minutes) VALUES(1,?,'2026-09-30','specific_team','Liverpool FC',30) RETURNING id").get(title).id);
const newStory = (projectId, fingerprint) => Number(db.prepare("INSERT INTO vsport_stories(project_id,headline,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,'Historical image classes','Liverpool FC','Fixture','https://news.example.test/story','2026-09-30','2026-09-30',?,1,0) RETURNING id").get(projectId, fingerprint).id);
const insertCandidate = (projectId, storyId, sourceUrl, state = 'candidate', error = '') => Number(db.prepare("INSERT INTO vsport_image_candidates(project_id,story_id,source_url,source_page_url,publisher,state,error_message) VALUES(?,?,?,'https://news.example.test/story','Fixture',?,?) RETURNING id").get(projectId, storyId, sourceUrl, state, error).id);

const projectId = newProject('Historical sequence');
const storyId = newStory(projectId, 'historical-sequence');
const candidateIds = {
  validOne: insertCandidate(projectId, storyId, urls.validOne),
  caret: insertCandidate(projectId, storyId, urls.caret),
  unsupported: insertCandidate(projectId, storyId, urls.negotiatedUnsupported),
  crop: insertCandidate(projectId, storyId, urls.crop),
  validTwo: insertCandidate(projectId, storyId, urls.validTwo),
};
const recoveryProject = newProject('Legacy MIME recovery');
const recoveryStory = newStory(recoveryProject, 'legacy-recovery');
const recoveryId = insertCandidate(recoveryProject, recoveryStory, urls.legacyRecovery, 'failed', 'IMAGE_MIME_UNSUPPORTED');

const historyProject = newProject('Bounded historical visibility');
const historyStory = newStory(historyProject, 'bounded-history');
const historical = [
  [urls.caret, 'failed', 'IMAGE_DECODE_OR_SIZE_INVALID', false],
  [urls.crop, 'failed', 'IMAGE_DECODE_OR_SIZE_INVALID', false],
  [urls.legacyRecovery, 'failed', 'IMAGE_MIME_UNSUPPORTED', true],
  ['https://img.example.test/news/final-unsupported.png', 'failed', 'IMAGE_SUPPORTED_FORMAT_NEGOTIATION_FAILED', false],
  ['https://img.example.test/news/too-large.png', 'failed', 'IMAGE_TOO_LARGE', false],
  ['https://img.example.test/news/not-found.png', 'failed', 'IMAGE_HTTP_404', false],
  ['https://img.example.test/news/bad-request.png', 'failed', 'IMAGE_HTTP_400', false],
  ['https://img.example.test/news/retry-timeout.png', 'failed', 'IMAGE_HTTP_408', true],
  ['https://img.example.test/news/retry-rate.png', 'failed', 'IMAGE_HTTP_429', true],
  ['https://img.example.test/news/candidate.png', 'candidate', '', true],
];
for (const [url, state, error] of historical) insertCandidate(historyProject, historyStory, url, state, error);

const mixedProject = newProject('Persisted non-soccer regression');
const soccerStory = Number(db.prepare("INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,'Arsenal signs a new striker','Premier League soccer transfer','Arsenal','Fixture','https://news.example.test/soccer','2026-09-30','2026-09-30','soccer-positive',1,0) RETURNING id").get(mixedProject).id);
const apStory = Number(db.prepare("INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,'College football picks: Coaches know all too well seasons can turn','Ohio State Buckeyes','Other','AP','https://apnews.com/article/ap-college-football-picks-test','2026-09-30','2026-09-30','college-negative',1,10) RETURNING id").get(mixedProject).id);
db.prepare("INSERT INTO vsport_stories(project_id,headline,summary,team_name,publisher,source_url,published_at,retrieved_at,fingerprint,selected,sort_order) VALUES(?,'Fitzmaurice confirmed as Galway football manager','Won three All-Irelands as a player with Kerry','Other','BBC','https://www.bbc.com/sport/articles/c6r7d7587vpeo','2026-09-30','2026-09-30','gaelic-negative',1,20)").run(mixedProject);
db.prepare("UPDATE vsport_projects SET thumbnail_headline='Fitzmaurice confirmed as Galway football manager' WHERE id=?").run(mixedProject);
const apCandidate = insertCandidate(mixedProject, apStory, 'https://img.example.test/news/college-photo.png', 'ready');
const validCandidate = insertCandidate(mixedProject, soccerStory, 'https://img.example.test/news/soccer-photo.png');
db.prepare("INSERT INTO vsport_assets(project_id,story_id,candidate_id,owner_id,object_key,source_url,source_page_url,publisher,mime_type,file_size,width,height) VALUES(?,?,?,1,'legacy-gridiron-key','https://img.example.test/news/college-photo.png','https://apnews.com/article/ap-college-football-picks-test','AP','image/png',100,800,533)").run(mixedProject,apStory,apCandidate);

let bodyFetches = 0;
const originalFetch = globalThis.fetch;
const largePng = new Uint8Array(await sharp({ create: { width: 800, height: 533, channels: 4, background: { r: 20, g: 90, b: 180, alpha: 1 } } }).png().toBuffer());
const smallPng = new Uint8Array(await sharp({ create: { width: 64, height: 64, channels: 4, background: { r: 180, g: 90, b: 20, alpha: 1 } } }).png().toBuffer());
const avifMarker = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 97, 118, 105, 102]);
const accepts = [];
globalThis.fetch = async (input, options = {}) => {
  bodyFetches++;
  const url = String(input), accept = String(options.headers?.accept || '');
  accepts.push({ url, accept });
  if (url === urls.legacyRecovery) {
    if (accept.includes('image/avif')) return new Response(avifMarker, { status: 200, headers: { 'content-type': 'image/avif' } });
    return new Response(largePng, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(largePng.byteLength) } });
  }
  if (url === urls.negotiatedUnsupported) return new Response(avifMarker, { status: 200, headers: { 'content-type': 'image/avif' } });
  if (url === urls.caret || url === urls.crop) return new Response(smallPng, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(smallPng.byteLength) } });
  return new Response(largePng, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(largePng.byteLength) } });
};

try {
  const beforeListFetches = bodyFetches;
  const detail = await json(await onRequestGet(context('GET', { url: `https://visiondonline.com/api/admin/vsport?id=${historyProject}&include=media` })));
  assert.equal(detail.status, 200);
  assert.equal(bodyFetches, beforeListFetches, 'bounded candidate rendering never prefetches image bodies');
  assert.equal(detail.body.candidates.length, historical.length);
  for (const [url, , , expected] of historical) assert.equal(detail.body.candidates.find(item => item.source_url === url)?.display_eligible, expected, url);
  assert.deepEqual(detail.body.media_pagination.candidates, { limit: 24, has_more: false, next_cursor: null });

  const outcomes = [];
  for (const key of ['validOne', 'caret', 'unsupported', 'crop', 'validTwo']) outcomes.push(await json(await onRequestPost(context('POST', { body: { action: 'ingest_image', project_id: projectId, candidate_id: candidateIds[key] } }))));
  assert.deepEqual(outcomes.map(item => item.status), [201, 422, 422, 422, 201]);
  assert.match(outcomes[1].body.error, /IMAGE_DECODE_OR_SIZE_INVALID/);
  assert.match(outcomes[2].body.error, /IMAGE_SUPPORTED_FORMAT_NEGOTIATION_FAILED/);
  assert.match(outcomes[3].body.error, /IMAGE_DECODE_OR_SIZE_INVALID/);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_assets WHERE project_id=?').get(projectId).count, 2, 'valid-invalid-invalid-invalid-valid stores both genuine images');
  assert.equal(r2.putCalls.length, 2);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_object_cleanup_jobs WHERE project_id=?').get(projectId).count, 0);

  const recovered = await json(await onRequestPost(context('POST', { body: { action: 'ingest_image', project_id: recoveryProject, candidate_id: recoveryId } })));
  assert.equal(recovered.status, 201, 'legacy IMAGE_MIME_UNSUPPORTED gets one evidence-backed retry with supported-only Accept');
  assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_assets WHERE project_id=?').get(recoveryProject).count, 1);
  assert.equal(r2.putCalls.length, 3);
  assert.equal(db.prepare('SELECT COUNT(*) count FROM vsport_object_cleanup_jobs WHERE project_id=?').get(recoveryProject).count, 0);
  assert.ok(accepts.length >= 6);
  for (const item of accepts) {
    assert.equal(item.accept, 'image/webp,image/png,image/jpeg', `${item.url} advertises only supported formats`);
    assert.doesNotMatch(item.accept, /avif/i);
  }

  const after = await json(await onRequestGet(context('GET', { url: `https://visiondonline.com/api/admin/vsport?id=${projectId}&include=media` })));
  for (const key of ['caret', 'unsupported', 'crop']) assert.equal(after.body.candidates.find(item => Number(item.id) === candidateIds[key])?.display_eligible, false, `${key} is terminal after a truthful attempt`);
  const mixed = await json(await onRequestGet(context('GET', { url: `https://visiondonline.com/api/admin/vsport?id=${mixedProject}&include=stories,media` })));
  assert.equal(mixed.status,200);
  assert.deepEqual(mixed.body.stories.map(item=>item.id),[soccerStory],'persisted AP and Gaelic stories are excluded');
  assert.equal(mixed.body.project.thumbnail_headline_eligible,false,'saved Gaelic headline is not reused as thumbnail copy');
  assert.equal(mixed.body.candidates.find(item=>item.id===apCandidate).display_eligible,false,'legacy gridiron candidate is unavailable');
  assert.equal(mixed.body.assets[0].story_eligible,false,'legacy gridiron asset remains in library but is barred from rendering');
  const badHeadline = await json(await onRequestPost(context('POST', { body: { action:'save',project_id:mixedProject,thumbnail_headline:'Fitzmaurice confirmed as Galway football manager' } })));
  assert.equal(badHeadline.body.code,'THUMBNAIL_NOT_SOCCER');
  const badFocus = await json(await onRequestPost(context('POST', { body: { action:'save',project_id:mixedProject,thumbnail_focus_asset_id:mixed.body.assets[0].id } })));
  assert.equal(badFocus.body.code,'THUMBNAIL_ASSET_NOT_SOCCER');
  const blocked = await json(await onRequestPost(context('POST', { body: { action:'ingest_image',project_id:mixedProject,candidate_id:apCandidate } })));
  assert.equal(blocked.status,422,'old gridiron candidate cannot be ingested again');
  const valid = await json(await onRequestPost(context('POST', { body: { action:'ingest_image',project_id:mixedProject,candidate_id:validCandidate } })));
  assert.equal(valid.status,201,'genuine soccer sibling remains ingestible');
  const mixedAfter = await json(await onRequestGet(context('GET', { url: `https://visiondonline.com/api/admin/vsport?id=${mixedProject}&include=media` })));
  assert.equal(mixedAfter.body.assets.length,2);
  assert.equal(mixedAfter.body.assets.find(item=>item.story_id===soccerStory).story_eligible,true);
} finally {
  globalThis.fetch = originalFetch;
  largePng.fill(0);
  smallPng.fill(0);
  avifMarker.fill(0);
}

for (const [sql, args, index] of [
  ['SELECT id FROM vsport_image_candidates WHERE project_id=? AND id>? ORDER BY id LIMIT 25', [historyProject, 0], 'idx_vsport_candidates_project_id'],
  ['SELECT id FROM vsport_assets WHERE project_id=? AND id>? ORDER BY id LIMIT 25', [projectId, 0], 'idx_vsport_assets_project_id'],
  ['SELECT c.id FROM vsport_image_candidates c JOIN vsport_stories s ON s.id=c.story_id AND s.project_id=c.project_id WHERE c.project_id=? AND c.id>? ORDER BY c.id LIMIT 25', [mixedProject, 0], 'idx_vsport_candidates_project_id'],
  ['SELECT a.id FROM vsport_assets a JOIN vsport_stories s ON s.id=a.story_id AND s.project_id=a.project_id WHERE a.project_id=? AND a.id>? ORDER BY a.id LIMIT 25', [mixedProject, 0], 'idx_vsport_assets_project_id'],
  ['SELECT headline,summary,source_url FROM vsport_stories WHERE project_id=? AND headline=? LIMIT 1', [mixedProject, 'Fitzmaurice confirmed as Galway football manager'], 'idx_vsport_stories_project_headline'],
]) {
  const plan = db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail).join(' | ');
  assert.match(plan, new RegExp(index), plan);
  assert.doesNotMatch(plan, /TEMP B-TREE/);
}
db.close();
console.log('PASS v0.20.143 V Sport historical caret/transform filtering, supported MIME negotiation, terminal visibility, bounded indexes and two-image ingest');
