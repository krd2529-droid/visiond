import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import {
  buildLivePackage,
  createLiveShow,
  createLiveVersion,
  downloadLivePackage,
  encodeLiveCursor,
  getLiveShow,
  liveHeadFromGet,
  listLiveProducts,
  listLiveShows,
  listLiveVersions,
  updateLiveShow,
} from '../functions/_live_center.js';
import { onRequestHead as headLiveProducts } from '../functions/api/admin/live-center/products.js';
import { onRequestHead as headLiveShows } from '../functions/api/admin/live-center/shows/index.js';
import { onRequestHead as headLiveShow } from '../functions/api/admin/live-center/shows/[id].js';
import { onRequestHead as headLiveVersions } from '../functions/api/admin/live-center/shows/[id]/versions.js';
import { isLiveCenterHtmlPath, onRequest as middleware } from '../functions/_middleware.js';
import {
  LIVE_PACKAGE_MAGIC_TEXT,
  LIVE_PACKAGE_MAX_BYTES,
  canonicalLiveJson,
  createLocalLivePlayback,
  livePackageSha256,
  parseVisionDLivePackage,
} from '../public/live-center-package.js';
import { createLiveCenterStore } from '../public/live-center.js';

const root = new URL('../', import.meta.url);
const read = relative => readFile(new URL(relative, root), 'utf8');
const [
  migration,
  serverSource,
  middlewareSource,
  clientSource,
  validatorSource,
  liveHtml,
  openerHtml,
  css,
  adminHtml,
  homeHtml,
  featureMap,
  ledger,
  packageJson,
  versionText,
] = await Promise.all([
  'migrations/0112_visiond_live_center.sql',
  'functions/_live_center.js',
  'functions/_middleware.js',
  'public/live-center.js',
  'public/live-center-package.js',
  'public/live-center.html',
  'public/live-package-open.html',
  'public/live-center.css',
  'public/admin.html',
  'public/index.html',
  'FEATURE-MAP.md',
  'patch-ledgers/v0.20.123.json',
  'package.json',
  'VERSION.txt',
].map(read));

assert.ok(['v0.20.123','v0.20.124','v0.20.125','v0.20.126','v0.20.127'].includes(versionText.trim()));
assert.ok(homeHtml.includes(`WEB ${versionText.trim()}`));
assert.ok(adminHtml.includes(`ADMIN ${versionText.trim()}`));
assert.match(adminHtml, /href="\/live-center\.html"[^>]+data-feature="LIVE-CENTER-001"/);
assert.match(liveHtml, /data-feature="LIVE-CENTER-001"/);
assert.match(openerHtml, /live-package-open\.js/);
assert.match(featureMap, /## LIVE-CENTER-001/);
assert.equal(JSON.parse(ledger).version, 'v0.20.123');
assert.equal(JSON.parse(packageJson).scripts['test:v020123'], 'node scripts/test-v020123.mjs && npm run test:v020122');
assert.doesNotMatch(css, /(?:^|})\.vds-btn(?:--[a-z-]+)?\s*\{/);
for (const html of [liveHtml, openerHtml]) {
  for (const button of html.matchAll(/<button\b([^>]*)>/g)) {
    assert.match(button[1], /class="[^"]*vds-btn/);
    assert.match(button[1], /type="button"|type="submit"/);
  }
}
for (const token of [
  'LIVE_MAX_CONTAINER_BYTES=32*1024*1024',
  'LIVE_ASSET_INVALID',
  'visiondlive://assets/',
  'cleanupLiveObjects',
  'verifiedPackage.customMetadata?.packageSha256',
  "['image/jpeg','image/png','image/webp']",
]) assert.ok(serverSource.includes(token), token);
for (const token of ['startedEpochs', 'tagEpoch', 'state.showListTicket', 'state.versionTicket', 'state.productQuery', 'openTicket']) {
  assert.ok(`${clientSource}\n${await read('public/live-package-open.js')}`.includes(token), token);
}
assert.match(validatorSource, /payloadStart \+ descriptor\.offset/);
assert.match(validatorSource, /payloadStart \+ expectedPayloadBytes !== bytes\.byteLength/);
assert.match(migration, /idx_toys_center_live_inventory/);
assert.match(migration, /idx_toys_center_live_title/);
assert.match(migration, /idx_toys_center_product_images_product_key_position/);
assert.match(migration, /asset_count INTEGER NOT NULL CHECK\(asset_count BETWEEN 1 AND 24\)/);
assert.doesNotMatch(migration, /FOREIGN KEY\(product_id\) REFERENCES toys_center_products/);
assert.match(middlewareSource, /live-package-open\.html/);
assert.equal(isLiveCenterHtmlPath('/live-center.html'), true);
assert.equal(isLiveCenterHtmlPath('/live-package-open.html'), true);

class BoundStatement {
  constructor(owner, sql, bindings = []) {
    this.owner = owner;
    this.sql = sql;
    this.bindings = bindings;
  }
  bind(...bindings) { return new BoundStatement(this.owner, this.sql, bindings); }
  async first() {
    if (this.owner.failExistingVersionReads > 0 && /FROM live_show_versions WHERE show_id=\? AND idempotency_key=\?/.test(this.sql)) {
      this.owner.failExistingVersionReads -= 1;
      throw new Error('synthetic reconciliation read failure');
    }
    return this.owner.db.prepare(this.sql).get(...this.bindings) || null;
  }
  async all() { return { success: true, results: this.owner.db.prepare(this.sql).all(...this.bindings) }; }
  async run() { return this.runSync(); }
  runSync() {
    const result = this.owner.db.prepare(this.sql).run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) }, results: [] };
  }
}

class D1Mock {
  constructor(db) {
    this.db = db;
    this.queries = [];
    this.failVersionBatchOnce = false;
    this.failBeforeBatchAndReconcileOnce = false;
    this.commitThenThrowOnce = false;
    this.commitThenThrowReconcileFailures = 0;
    this.corruptBatchResultsOnce = false;
    this.failExistingVersionReads = 0;
  }
  prepare(sql) {
    this.queries.push(sql);
    return new BoundStatement(this, sql);
  }
  async batch(statements) {
    if (this.failVersionBatchOnce && statements.some(statement => statement.sql.includes('INSERT INTO live_show_versions'))) {
      this.failVersionBatchOnce = false;
      throw new Error('synthetic D1 commit failure');
    }
    if (this.failBeforeBatchAndReconcileOnce && statements.some(statement => statement.sql.includes('INSERT INTO live_show_versions'))) {
      this.failBeforeBatchAndReconcileOnce = false;
      this.failExistingVersionReads = 1;
      throw new Error('synthetic D1 pre-commit ambiguity');
    }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(statement => statement.runSync());
      this.db.exec('COMMIT');
      if (this.commitThenThrowOnce && statements.some(statement => statement.sql.includes('INSERT INTO live_show_versions'))) {
        this.commitThenThrowOnce = false;
        this.failExistingVersionReads = this.commitThenThrowReconcileFailures;
        this.commitThenThrowReconcileFailures = 0;
        throw new Error('synthetic D1 commit-then-throw');
      }
      if (this.corruptBatchResultsOnce && statements.some(statement => statement.sql.includes('INSERT INTO live_show_versions'))) {
        this.corruptBatchResultsOnce = false;
        return results.map((result, index) => index === results.length - 1 ? { ...result, meta: { ...result.meta, changes: 0 } } : result);
      }
      return results;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }
}

class R2Mock {
  constructor() {
    this.objects = new Map();
    this.getCalls = 0;
    this.headCalls = 0;
    this.putCalls = 0;
    this.deleteCalls = 0;
    this.failDeleteCount = 0;
    this.failPutAfterWritePrefix = '';
    this.afterPutOnce = null;
  }
  seed(key, bytes, contentType = 'image/png') {
    this.objects.set(key, { bytes: Uint8Array.from(bytes), httpMetadata: { contentType }, customMetadata: {}, etag: `seed-${key.length}-${bytes.length}` });
  }
  object(key, withBody) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      size: stored.bytes.byteLength,
      etag: stored.etag,
      httpEtag: `"${stored.etag}"`,
      httpMetadata: { ...stored.httpMetadata },
      customMetadata: { ...stored.customMetadata },
      ...(withBody ? { body: stored.bytes.slice() } : {}),
    };
  }
  async get(key) { this.getCalls += 1; return this.object(key, true); }
  async head(key) { this.headCalls += 1; return this.object(key, false); }
  async put(key, value, options = {}) {
    this.putCalls += 1;
    const bytes = value instanceof Uint8Array
      ? value.slice()
      : value instanceof ArrayBuffer
        ? new Uint8Array(value.slice(0))
        : ArrayBuffer.isView(value)
          ? new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength))
          : new Uint8Array(await new Response(value).arrayBuffer());
    const record = {
      bytes,
      httpMetadata: { ...(options.httpMetadata || {}) },
      customMetadata: { ...(options.customMetadata || {}) },
      etag: `etag-${bytes.byteLength}-${key.length}-${bytes[0] || 0}`,
    };
    this.objects.set(key, record);
    if (this.afterPutOnce && key.startsWith(this.afterPutOnce.prefix)) {
      const { callback } = this.afterPutOnce;
      this.afterPutOnce = null;
      await callback(key);
    }
    if (this.failPutAfterWritePrefix && key.startsWith(this.failPutAfterWritePrefix)) {
      this.failPutAfterWritePrefix = '';
      throw new Error('synthetic ambiguous R2 put');
    }
    return this.object(key, false);
  }
  async delete(key) {
    this.deleteCalls += 1;
    if (this.failDeleteCount > 0) {
      this.failDeleteCount -= 1;
      throw new Error('synthetic transient delete');
    }
    this.objects.delete(key);
  }
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
  PRAGMA foreign_keys=ON;
  CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
  CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
  CREATE TABLE toys_center_products(
    id INTEGER PRIMARY KEY AUTOINCREMENT,meta_id TEXT NOT NULL UNIQUE,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',availability TEXT NOT NULL DEFAULT 'in stock',condition TEXT NOT NULL DEFAULT 'used',
    price_cents INTEGER NOT NULL DEFAULT 0,currency TEXT NOT NULL DEFAULT 'THB',quantity INTEGER NOT NULL DEFAULT 1,
    image_1_key TEXT NOT NULL,image_2_key TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX idx_toys_center_status_updated ON toys_center_products(status,updated_at DESC,id DESC);
  CREATE INDEX idx_toys_center_title ON toys_center_products(title);
  CREATE INDEX idx_toys_center_title_nocase_id ON toys_center_products(title COLLATE NOCASE,id);
  CREATE TABLE toys_center_product_images(
    id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER NOT NULL REFERENCES toys_center_products(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK(position BETWEEN 0 AND 9),image_key TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id,position)
  );
  INSERT INTO users VALUES(1,'admin@example.com','admin','Admin','','admin','2026-01-01');
  INSERT INTO users VALUES(2,'member@example.com','member','Member','','member','2026-01-01');
  INSERT INTO users VALUES(3,'boss@example.com','boss','Boss','','boss','2026-01-01');
  INSERT INTO sessions VALUES('admin-session',1,'2099-01-01');
  INSERT INTO sessions VALUES('member-session',2,'2099-01-01');
  INSERT INTO sessions VALUES('boss-session',3,'2099-01-01');
`);
sqlite.exec(migration);
const addProduct = sqlite.prepare(`INSERT INTO toys_center_products(meta_id,slug,title,price_cents,currency,quantity,image_1_key,status,availability,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
const addImage = sqlite.prepare('INSERT INTO toys_center_product_images(product_id,position,image_key) VALUES(?,?,?)');
for (let index = 1; index <= 61; index += 1) {
  const primaryKey = index === 1 ? 'toys/1-selected.png' : `toys/${index}-0.png`;
  addProduct.run(`TOY-${index}`, `toy-${index}`, `Alpha Item ${String(index).padStart(3, '0')}`, 1000 + index, 'THB', 5 + index, primaryKey, 'published', 'in stock', `2026-09-${String(1 + Math.floor(index / 3)).padStart(2, '0')}T${String(index % 24).padStart(2, '0')}:00:00Z`);
  addImage.run(index, 0, `toys/${index}-0.png`);
  if (index === 1) addImage.run(index, 1, primaryKey);
}
for (const [id, status, availability, quantity] of [[1001, 'draft', 'in stock', 9], [1002, 'published', 'out of stock', 9], [1003, 'published', 'in stock', 0]]) {
  const inserted = addProduct.run(`TOY-${id}`, `toy-${id}`, `Alpha Hidden ${id}`, 999, 'THB', quantity, `toys/${id}.png`, status, availability, '2026-09-30T00:00:00Z');
  addImage.run(Number(inserted.lastInsertRowid), 0, `toys/${id}.png`);
}

const d1 = new D1Mock(sqlite);
const r2 = new R2Mock();
const pngFixture = marker => {
  const bytes = new Uint8Array(256);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, marker], 0);
  return bytes;
};
const pngA = pngFixture(1);
const pngB = pngFixture(2);
r2.seed('toys/1-selected.png', pngA);
r2.seed('toys/1-0.png', pngB);
r2.seed('toys/2-0.png', pngB);
const waits = [];
const env = { DB: d1, FILES: r2 };
const capturedErrorLogs = [];
const originalConsoleError = console.error;
console.error = (...args) => {
  capturedErrorLogs.push(args.map(value => String(value)).join(' '));
  originalConsoleError(...args);
};

function ctx(pathname, { method = 'GET', session = 'admin-session', body, headers = {}, params = {}, next } = {}) {
  const requestHeaders = new Headers(headers);
  if (session) requestHeaders.set('cookie', `vd_session=${session}`);
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload !== undefined) {
    requestHeaders.set('content-type', 'application/json');
    requestHeaders.set('content-length', String(Buffer.byteLength(payload)));
  }
  return {
    request: new Request(`https://visiondonline.com${pathname}`, { method, headers: requestHeaders, body: payload }),
    env,
    params,
    next: next || (async () => new Response('<!doctype html><title>Live</title>', { headers: { 'content-type': 'text/html', 'cache-control': 'public,max-age=999' } })),
    waitUntil(promise) { waits.push(promise); },
  };
}
const json = async response => response.json();
const liveObjectKeys = () => [...r2.objects.keys()].filter(key => key.startsWith('live-center/'));

for (const pathname of ['/live-center', '/live-center.html', '/live-center/', '/live-package-open', '/live-package-open.html', '/live-package-open/']) {
  let nextCalls = 0;
  const noSession = await middleware(ctx(pathname, { session: '', next: async () => { nextCalls += 1; return new Response('unsafe'); } }));
  assert.equal(noSession.status, 401);
  assert.equal(noSession.headers.get('cache-control'), 'private, no-store');
  assert.equal(nextCalls, 0, `${pathname} denies before static HTML`);
  const noSessionHead = await middleware(ctx(pathname, { method: 'HEAD', session: '', next: async () => { nextCalls += 1; return new Response('unsafe'); } }));
  assert.equal(noSessionHead.status, 401);
  assert.equal(noSessionHead.headers.get('cache-control'), 'private, no-store');
  assert.equal((await noSessionHead.arrayBuffer()).byteLength, 0);
  assert.equal(nextCalls, 0, `${pathname} HEAD denies before static HTML`);
  const member = await middleware(ctx(pathname, { session: 'member-session' }));
  assert.equal(member.status, 403);
  assert.equal(member.headers.get('cache-control'), 'private, no-store');
  const allowed = await middleware(ctx(pathname));
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('cache-control'), 'private, no-store');
  assert.equal(allowed.headers.get('x-frame-options'), 'DENY');
  assert.equal(allowed.headers.get('referrer-policy'), 'no-referrer');
  assert.match(allowed.headers.get('content-security-policy') || '', /connect-src 'self'/);
  const bossAllowed = await middleware(ctx(pathname, { session: 'boss-session' }));
  assert.equal(bossAllowed.status, 200);
  assert.equal(bossAllowed.headers.get('cache-control'), 'private, no-store');
  const allowedHead = await middleware(ctx(pathname, { method: 'HEAD', next: async () => new Response(null, { headers: { 'content-type': 'text/html' } }) }));
  assert.equal(allowedHead.status, 200);
  assert.equal(allowedHead.headers.get('cache-control'), 'private, no-store');
  assert.equal((await allowedHead.arrayBuffer()).byteLength, 0);
}

d1.queries.length = 0;
const unauthorizedProducts = await listLiveProducts(ctx('/api/admin/live-center/products?limit=24', { session: '' }));
assert.equal(unauthorizedProducts.status, 401);
assert.equal(d1.queries.length, 0, 'missing session is denied before SQL');
assert.equal(r2.getCalls, 0);
d1.queries.length = 0;
const memberProducts = await listLiveProducts(ctx('/api/admin/live-center/products?limit=24', { session: 'member-session' }));
assert.equal(memberProducts.status, 403);
assert.equal(d1.queries.some(sql => /toys_center|live_show/i.test(sql)), false, 'member is denied before product/show SQL');
const bossProducts = await listLiveProducts(ctx('/api/admin/live-center/products?limit=1', { session: 'boss-session' }));
assert.equal(bossProducts.status, 200, 'Boss can use the protected catalog selector');

let cursor = null;
const catalogIds = [];
do {
  const query = new URLSearchParams({ limit: '24' });
  if (cursor) query.set('cursor', cursor);
  const response = await listLiveProducts(ctx(`/api/admin/live-center/products?${query}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = await json(response);
  assert.ok(data.items.length <= 24);
  catalogIds.push(...data.items.map(item => item.id));
  cursor = data.pagination.next_cursor;
} while (cursor);
assert.equal(catalogIds.length, 61);
assert.equal(new Set(catalogIds).size, 61);
assert.equal(catalogIds.some(id => id >= 1001), false);
const prefixResponse = await listLiveProducts(ctx('/api/admin/live-center/products?limit=24&q=alpha%20item%20001'));
const prefixData = await json(prefixResponse);
assert.equal(prefixData.items[0].id, 1);
assert.match(prefixData.items[0].image_url, /\/api\/toys-center\/gallery\/1\/1\?v=2$/, 'selector resolves image_1_key row instead of hard-coded position 0');
cursor = null;
const prefixIds = [];
do {
  const query = new URLSearchParams({ limit: '24', q: 'alpha item' });
  if (cursor) query.set('cursor', cursor);
  const page = await json(await listLiveProducts(ctx(`/api/admin/live-center/products?${query}`)));
  assert.ok(page.items.length <= 24);
  prefixIds.push(...page.items.map(item => item.id));
  cursor = page.pagination.next_cursor;
} while (cursor);
assert.equal(prefixIds.length, 61);
assert.equal(new Set(prefixIds).size, 61, 'prefix keyset has no duplicates or omissions');
const forgedBelowPrefix = encodeLiveCursor(['alpha item', 'aardvark', 1]);
const forgedResponse = await listLiveProducts(ctx(`/api/admin/live-center/products?limit=24&q=alpha%20item&cursor=${encodeURIComponent(forgedBelowPrefix)}`));
assert.equal(forgedResponse.status, 400, 'a forged cursor cannot escape the indexed prefix range');

const shippedProductDefaultSql = d1.queries.find(sql => sql.startsWith('SELECT p.id,p.meta_id') && sql.includes('(p.updated_at,p.id)<(?,?)'));
const shippedProductPrefixFirstSql = d1.queries.find(sql => sql.startsWith('SELECT p.id,p.meta_id') && sql.includes('p.title COLLATE NOCASE>=?') && !sql.includes('(p.title COLLATE NOCASE,p.id)>'));
const shippedProductPrefixNextSql = d1.queries.find(sql => sql.startsWith('SELECT p.id,p.meta_id') && sql.includes('(p.title COLLATE NOCASE,p.id)>(?,?)'));
for (const [sql, args, index] of [
  [shippedProductDefaultSql, ['9999-12-31T23:59:59.999Z', Number.MAX_SAFE_INTEGER, 25], 'idx_toys_center_live_inventory'],
  [shippedProductDefaultSql, ['2026-09-20T00:00:00Z', 48, 25], 'idx_toys_center_live_inventory'],
  [shippedProductPrefixFirstSql, ['alpha item', 'alpha iten', 25], 'idx_toys_center_live_title'],
  [shippedProductPrefixNextSql, ['alpha item', 'alpha iten', 'Alpha Item 024', 24, 25], 'idx_toys_center_live_title'],
]) {
  assert.ok(sql, 'exact shipped product query was captured');
  assert.match(sql, new RegExp(`FROM toys_center_products AS p INDEXED BY ${index}\\b`), `exact shipped query must force ${index}: ${sql}`);
  const detail = sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail).join(' | ');
  assert.match(detail, new RegExp(`SEARCH p USING INDEX ${index}`), detail);
  assert.doesNotMatch(detail, /\bSCAN\b|TEMP B-TREE/, detail);
}

const plans = [
  ["SELECT id FROM toys_center_products INDEXED BY idx_toys_center_live_inventory WHERE status='published' AND availability='in stock' AND quantity>0 AND (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT 25", ['9999-12-31T23:59:59.999Z', Number.MAX_SAFE_INTEGER], 'idx_toys_center_live_inventory'],
  ["SELECT id FROM toys_center_products INDEXED BY idx_toys_center_live_title WHERE status='published' AND availability='in stock' AND quantity>0 AND title COLLATE NOCASE>=? AND title COLLATE NOCASE<? ORDER BY title COLLATE NOCASE,id ASC LIMIT 25", ['alpha', 'alphb'], 'idx_toys_center_live_title'],
  ['SELECT id FROM toys_center_product_images WHERE product_id=? AND image_key=? ORDER BY position LIMIT 1', [1, 'toys/1-selected.png'], 'idx_toys_center_product_images_product_key_position'],
  ['SELECT id FROM live_shows WHERE (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT 25', ['9999-12-31T23:59:59.999Z', '~'], 'idx_live_shows_updated'],
  ['SELECT id FROM live_show_scenes WHERE show_id=? ORDER BY position', ['live_00000000000000000000000000000000'], 'idx_live_scenes_show_position'],
  ['SELECT id FROM live_show_versions WHERE show_id=? ORDER BY version_number DESC LIMIT 25', ['live_00000000000000000000000000000000'], 'idx_live_versions_show_number'],
  ['SELECT id FROM live_show_versions WHERE show_id=? AND idempotency_key=?', ['live_00000000000000000000000000000000', 'key'], 'idx_live_versions_show_idempotency'],
  ['SELECT object_key FROM live_show_version_assets WHERE version_id=? ORDER BY scene_position', ['livev_00000000000000000000000000000000'], 'idx_live_version_assets_scene'],
];
for (const [sql, args, index] of plans) {
  const detail = sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail).join(' | ');
  assert.match(detail, new RegExp(index), detail);
  assert.doesNotMatch(detail, /TEMP B-TREE/, detail);
}
const pageTwoPlans = [
  ["SELECT id FROM toys_center_products INDEXED BY idx_toys_center_live_inventory WHERE status='published' AND availability='in stock' AND quantity>0 AND (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT 25", ['2026-09-20T00:00:00Z', 48], 'idx_toys_center_live_inventory'],
  ["SELECT id FROM toys_center_products INDEXED BY idx_toys_center_live_title WHERE status='published' AND availability='in stock' AND quantity>0 AND title COLLATE NOCASE>=? AND title COLLATE NOCASE<? AND (title COLLATE NOCASE,id)>(?,?) ORDER BY title COLLATE NOCASE ASC,id ASC LIMIT 25", ['alpha item', 'alpha iten', 'Alpha Item 024', 24], 'idx_toys_center_live_title'],
  ['SELECT id FROM live_shows WHERE (updated_at,id)<(?,?) ORDER BY updated_at DESC,id DESC LIMIT 25', ['2026-09-20T00:00:00Z', 'live_00000000000000000000000000000000'], 'idx_live_shows_updated'],
];
for (const [sql, args, index] of pageTwoPlans) {
  const detail = sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail).join(' | ');
  assert.match(detail, new RegExp(`SEARCH .*${index}`), detail);
  assert.doesNotMatch(detail, /\bSCAN\b|TEMP B-TREE/, detail);
}
for (const table of ['live_shows', 'live_show_scenes', 'live_show_versions', 'live_show_version_assets']) {
  const signatures = new Map();
  for (const index of sqlite.prepare(`PRAGMA index_list('${table}')`).all()) {
    const columns = sqlite.prepare(`PRAGMA index_info('${index.name}')`).all().map(column => column.name).join(',');
    if (!columns) continue;
    assert.equal(signatures.has(columns), false, `${table} has duplicate logical index columns ${columns}: ${signatures.get(columns)} and ${index.name}`);
    signatures.set(columns, index.name);
  }
}

const showBody = {
  title: 'Weekend Toys Live',
  description: 'Reviewed rundown',
  avatar_preset: 'visiond-default',
  output_profile: 'landscape-1080p',
  scenes: [
    { product_id: 1, script: 'Introduce the first toy', cue: { label: 'Opening', duration_seconds: 45, transition: 'cut' } },
    { product_id: 2, script: 'Introduce the second toy', cue: { label: 'Second', duration_seconds: 50, transition: 'fade' } },
  ],
};
const createHeaders = { 'idempotency-key': 'show.create.0001' };
let response = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: showBody, headers: createHeaders }));
assert.equal(response.status, 201);
let created = await json(response);
const showId = created.item.id;
assert.match(showId, /^live_[a-f0-9]{32}$/);
response = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: showBody, headers: createHeaders }));
assert.equal(response.status, 200);
assert.equal((await json(response)).item.id, showId);
response = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: { ...showBody, title: 'Different' }, headers: createHeaders }));
assert.equal(response.status, 409);
response = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: { ...showBody, surprise: true }, headers: { 'idempotency-key': 'show.unknown.0001' } }));
assert.equal(response.status, 400);
const sentinels = {
  password: 'VD_PASSWORD_SENTINEL_9df772',
  cookie: 'VD_COOKIE_SENTINEL_9df772',
  access_token: 'VD_ACCESS_SENTINEL_9df772',
  refresh_token: 'VD_REFRESH_SENTINEL_9df772',
  stream_key: 'VD_STREAM_SENTINEL_9df772',
};
const securityResponseTexts = [];
let secretIndex = 0;
for (const [name, sentinelValue] of Object.entries(sentinels)) {
  for (const secretText of [`${name}=${sentinelValue}`, `{"${name}":"${sentinelValue}"}`]) {
    response = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: { ...showBody, scenes: [{ ...showBody.scenes[0], script: secretText }] }, headers: { 'idempotency-key': `show.secret.${String(++secretIndex).padStart(4, '0')}` } }));
    assert.equal(response.status, 400);
    const payload = await json(response);
    securityResponseTexts.push(JSON.stringify(payload));
    assert.equal(payload.code, 'LIVE_SECRET_REJECTED');
  }
}

const updateBody = { ...showBody, title: 'Weekend Toys Live Reviewed', expected_revision: 1 };
response = await updateLiveShow(ctx(`/api/admin/live-center/shows/${showId}`, { method: 'PUT', session: 'boss-session', body: updateBody, params: { id: showId } }));
assert.equal(response.status, 200);
created = await json(response);
assert.equal(created.item.revision, 2);
response = await updateLiveShow(ctx(`/api/admin/live-center/shows/${showId}`, { method: 'PUT', body: { ...updateBody, title: 'Stale overwrite' }, params: { id: showId } }));
assert.equal(response.status, 409);
response = await getLiveShow(ctx(`/api/admin/live-center/shows/${showId}`, { params: { id: showId } }));
assert.equal((await json(response)).item.title, 'Weekend Toys Live Reviewed');

const secondCreate = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: { ...showBody, title: 'Other show', scenes: [] }, headers: { 'idempotency-key': 'show.create.0002' } }));
const otherShowId = (await json(secondCreate)).item.id;

response = await createLiveVersion(ctx(`/api/admin/live-center/shows/${otherShowId}/versions`, { method: 'POST', body: { expected_revision: 1 }, headers: { 'idempotency-key': 'version.empty.0001' }, params: { id: otherShowId } }));
assert.equal(response.status, 422);
assert.equal((await json(response)).code, 'LIVE_EMPTY_SHOW');

const syntheticHead = await liveHeadFromGet(ctx('/api/admin/live-center/products', { method: 'HEAD' }), async () => new Response('must be stripped', {
  status: 418,
  statusText: 'Live Head Test',
  headers: { 'content-type': 'application/json; charset=utf-8', 'x-live-head-test': 'preserved' },
}));
assert.equal(syntheticHead.status, 418);
assert.equal(syntheticHead.statusText, 'Live Head Test');
assert.equal(syntheticHead.headers.get('x-live-head-test'), 'preserved');
assert.equal((await syntheticHead.arrayBuffer()).byteLength, 0, 'shared HEAD helper strips the GET body');

const liveReadHeadCases = [
  ['products HEAD', headLiveProducts, '/api/admin/live-center/products?limit=1', {}],
  ['shows HEAD', headLiveShows, '/api/admin/live-center/shows?limit=1', {}],
  ['show detail HEAD', headLiveShow, `/api/admin/live-center/shows/${showId}`, { id: showId }],
  ['versions HEAD', headLiveVersions, `/api/admin/live-center/shows/${showId}/versions?limit=1`, { id: showId }],
];
for (const [session, expected] of [['', 401], ['member-session', 403]]) {
  for (const [label, handler, pathname, params] of liveReadHeadCases) {
    d1.queries.length = 0;
    const r2Before = [r2.getCalls, r2.headCalls, r2.putCalls, r2.deleteCalls];
    const denied = await handler(ctx(pathname, { method: 'HEAD', session, params }));
    assert.equal(denied.status, expected, `${label} auth status`);
    assert.equal(denied.headers.get('cache-control'), 'private, no-store', `${label} denial is private`);
    assert.match(denied.headers.get('content-type') || '', /^application\/json\b/, `${label} denial keeps JSON content type`);
    assert.equal((await denied.arrayBuffer()).byteLength, 0, `${label} denial has no body`);
    assert.equal(d1.queries.some(sql => /toys_center|live_show/i.test(sql)), false, `${label} denies before sensitive SQL`);
    assert.deepEqual([r2.getCalls, r2.headCalls, r2.putCalls, r2.deleteCalls], r2Before, `${label} denies before R2`);
  }
}
for (const [label, handler, pathname, params] of liveReadHeadCases) {
  const allowed = await handler(ctx(pathname, { method: 'HEAD', session: 'boss-session', params }));
  assert.equal(allowed.status, 200, `Boss ${label} succeeds`);
  assert.equal(allowed.headers.get('cache-control'), 'private, no-store', `${label} success is private`);
  assert.match(allowed.headers.get('content-type') || '', /^application\/json\b/, `${label} success keeps JSON content type`);
  assert.equal((await allowed.arrayBuffer()).byteLength, 0, `${label} success has no body`);
}
const missingHeadShowId = 'live_00000000000000000000000000000000';
for (const [label, handler, pathname] of [
  ['show detail HEAD', headLiveShow, `/api/admin/live-center/shows/${missingHeadShowId}`],
  ['versions HEAD', headLiveVersions, `/api/admin/live-center/shows/${missingHeadShowId}/versions?limit=1`],
]) {
  const missing = await handler(ctx(pathname, { method: 'HEAD', session: 'boss-session', params: { id: missingHeadShowId } }));
  assert.equal(missing.status, 404, `${label} preserves authorized not-found status`);
  assert.equal(missing.headers.get('cache-control'), 'private, no-store');
  assert.match(missing.headers.get('content-type') || '', /^application\/json\b/);
  assert.equal((await missing.arrayBuffer()).byteLength, 0, `${label} not-found has no body`);
}

const authFirstCases = [
  ['products', session => listLiveProducts(ctx('/api/admin/live-center/products?limit=24', { session }))],
  ['shows', session => listLiveShows(ctx('/api/admin/live-center/shows?limit=24', { session }))],
  ['show detail', session => getLiveShow(ctx(`/api/admin/live-center/shows/${showId}`, { session, params: { id: showId } }))],
  ['create show', session => createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', session, body: showBody, headers: { 'idempotency-key': 'denied.create.0001' } }))],
  ['update show', session => updateLiveShow(ctx(`/api/admin/live-center/shows/${showId}`, { method: 'PUT', session, body: updateBody, params: { id: showId } }))],
  ['versions', session => listLiveVersions(ctx(`/api/admin/live-center/shows/${showId}/versions?limit=24`, { session, params: { id: showId } }))],
  ['create version', session => createLiveVersion(ctx(`/api/admin/live-center/shows/${showId}/versions`, { method: 'POST', session, body: { expected_revision: 2 }, headers: { 'idempotency-key': 'denied.version.0001' }, params: { id: showId } }))],
  ['package GET', session => downloadLivePackage(ctx(`/api/admin/live-center/shows/${showId}/versions/livev_00000000000000000000000000000000/package`, { session, params: { id: showId, versionId: 'livev_00000000000000000000000000000000' } }))],
  ['package HEAD', session => downloadLivePackage(ctx(`/api/admin/live-center/shows/${showId}/versions/livev_00000000000000000000000000000000/package`, { method: 'HEAD', session, params: { id: showId, versionId: 'livev_00000000000000000000000000000000' } }), { head: true })],
];
for (const [session, expected] of [['', 401], ['member-session', 403]]) {
  for (const [label, invoke] of authFirstCases) {
    d1.queries.length = 0;
    const r2Before = [r2.getCalls, r2.headCalls, r2.putCalls, r2.deleteCalls];
    const denied = await invoke(session);
    assert.equal(denied.status, expected, `${label} auth status`);
    assert.equal(d1.queries.some(sql => /toys_center|live_show/i.test(sql)), false, `${label} denies before sensitive SQL`);
    assert.deepEqual([r2.getCalls, r2.headCalls, r2.putCalls, r2.deleteCalls], r2Before, `${label} denies before R2`);
  }
}

r2.seed('toys/3-0.png', pngA);
sqlite.prepare('UPDATE toys_center_products SET title=? WHERE id=3').run(`access_token=${sentinels.access_token}`);
const showsBeforeCatalogSecret = Number(sqlite.prepare('SELECT COUNT(*) count FROM live_shows').get().count);
response = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: { ...showBody, title: 'Catalog secret gate', scenes: [{ ...showBody.scenes[0], product_id: 3 }] }, headers: { 'idempotency-key': 'show.catalogsecret.0001' } }));
assert.equal(response.status, 400);
const catalogSecretPayload = await json(response);
securityResponseTexts.push(JSON.stringify(catalogSecretPayload));
assert.equal(catalogSecretPayload.code, 'LIVE_SECRET_REJECTED');
assert.equal(Number(sqlite.prepare('SELECT COUNT(*) count FROM live_shows').get().count), showsBeforeCatalogSecret, 'DB-derived secret is rejected before show/scene persistence');
sqlite.prepare('UPDATE toys_center_products SET title=? WHERE id=3').run('Alpha Item 003');

const addShow = sqlite.prepare('INSERT INTO live_shows(id,title,description,avatar_preset,output_profile,scene_count,revision,create_idempotency_key,create_request_hash,last_mutation_key,created_by,updated_by,created_at,updated_at) VALUES(?,?,?,?,?,0,1,?,?,?,?,?,?,?)');
for (let index = 1; index <= 50; index += 1) {
  const id = `live_${(0xf0000 + index).toString(16).padStart(32, '0')}`;
  addShow.run(id, `Filler show ${index}`, '', 'visiond-default', 'landscape-1080p', `filler.${index}`, '0'.repeat(64), `mut_filler_${index}`, 1, 1, `2026-08-${String(1 + (index % 28)).padStart(2, '0')}T00:00:00Z`, `2026-08-${String(1 + (index % 28)).padStart(2, '0')}T00:00:00Z`);
}
cursor = null;
const showIds = [];
do {
  const params = new URLSearchParams({ limit: '24' });
  if (cursor) params.set('cursor', cursor);
  const pageResponse = await listLiveShows(ctx(`/api/admin/live-center/shows?${params}`));
  assert.equal(pageResponse.status, 200);
  const page = await json(pageResponse);
  assert.ok(page.items.length <= 24);
  showIds.push(...page.items.map(item => item.id));
  cursor = page.pagination.next_cursor;
} while (cursor);
assert.equal(showIds.length, 52);
assert.equal(new Set(showIds).size, 52, 'show keyset has no duplicates or omissions');
const shippedShowListSql = d1.queries.find(sql => sql.startsWith('SELECT id,title,description,avatar_preset,output_profile,scene_count,revision,created_at,updated_at FROM live_shows WHERE (updated_at,id)<'));
for (const args of [
  ['9999-12-31T23:59:59.999Z', '~', 25],
  ['2026-09-20T00:00:00Z', 'live_ffffffffffffffffffffffffffffffff', 25],
]) {
  assert.ok(shippedShowListSql, 'exact shipped show-list query was captured');
  const detail = sqlite.prepare(`EXPLAIN QUERY PLAN ${shippedShowListSql}`).all(...args).map(row => row.detail).join(' | ');
  assert.match(detail, /SEARCH live_shows USING INDEX idx_live_shows_updated/, detail);
  assert.doesNotMatch(detail, /\bSCAN\b|TEMP B-TREE/, detail);
}

const versionRequest = (key, expectedRevision = 2, session = 'admin-session') => createLiveVersion(ctx(`/api/admin/live-center/shows/${showId}/versions`, {
  method: 'POST',
  session,
  body: { expected_revision: expectedRevision },
  headers: { 'idempotency-key': key },
  params: { id: showId },
}));
const cloneStored = record => ({
  bytes: record.bytes.slice(),
  httpMetadata: { ...record.httpMetadata },
  customMetadata: { ...record.customMetadata },
  etag: record.etag,
});
const savedPrimary = cloneStored(r2.objects.get('toys/1-selected.png'));
const baselineVersionRows = () => Number(sqlite.prepare('SELECT COUNT(*) count FROM live_show_versions WHERE show_id=?').get(showId).count);

let putsBefore = r2.putCalls;
r2.objects.delete('toys/1-selected.png');
response = await versionRequest('version.missing.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.equal(r2.putCalls, putsBefore, 'missing saved cover fails before R2 writes');
assert.equal(baselineVersionRows(), 0);
r2.objects.set('toys/1-selected.png', cloneStored(savedPrimary));

r2.objects.get('toys/1-selected.png').httpMetadata.contentType = 'image/gif';
putsBefore = r2.putCalls;
response = await versionRequest('version.mime.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.equal(r2.putCalls, putsBefore, 'saved cover MIME drift fails before R2 writes');
r2.objects.set('toys/1-selected.png', cloneStored(savedPrimary));

r2.objects.get('toys/1-selected.png').bytes.fill(1);
putsBefore = r2.putCalls;
response = await versionRequest('version.magic.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_ASSET_INVALID');
assert.equal(r2.putCalls, putsBefore, 'invalid same-size image is rejected before version-owned writes');
r2.objects.set('toys/1-selected.png', cloneStored(savedPrimary));

for (const [name, sentinelValue] of Object.entries(sentinels)) {
  for (const [format, secretText] of [['assignment', `${name}=${sentinelValue}`], ['quoted', `{"${name}":"${sentinelValue}"}`]]) {
    const candidate = savedPrimary.bytes.slice();
    const secretBytes = new TextEncoder().encode(secretText);
    candidate.set(secretBytes, candidate.byteLength - secretBytes.byteLength);
    r2.objects.get('toys/1-selected.png').bytes = candidate;
    putsBefore = r2.putCalls;
    response = await versionRequest(`version.assetsecret.${name}.${format}`);
    assert.equal(response.status, 400);
    const payload = await json(response);
    securityResponseTexts.push(JSON.stringify(payload));
    assert.equal(payload.code, 'LIVE_SECRET_REJECTED');
    assert.equal(r2.putCalls, putsBefore, `${name} ${format} image sentinel is rejected before any version-owned R2 write`);
    r2.objects.set('toys/1-selected.png', cloneStored(savedPrimary));
  }
}

for (const [column, unavailable, restored] of [
  ['quantity', 0, 7],
  ['status', 'draft', 'published'],
  ['availability', 'out of stock', 'in stock'],
]) {
  sqlite.prepare(`UPDATE toys_center_products SET ${column}=? WHERE id=2`).run(unavailable);
  putsBefore = r2.putCalls;
  response = await versionRequest(`version.unavailable.${column}.0001`);
  assert.equal(response.status, 409);
  assert.equal((await json(response)).code, 'LIVE_PRODUCT_UNAVAILABLE');
  assert.equal(r2.putCalls, putsBefore, `${column} unavailability fails before R2 writes`);
  sqlite.prepare(`UPDATE toys_center_products SET ${column}=? WHERE id=2`).run(restored);
}
sqlite.exec('SAVEPOINT live_deleted_product');
sqlite.prepare('DELETE FROM toys_center_products WHERE id=2').run();
putsBefore = r2.putCalls;
response = await versionRequest('version.unavailable.deleted.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_UNAVAILABLE');
assert.equal(r2.putCalls, putsBefore, 'deleted product fails before R2 writes');
sqlite.exec('ROLLBACK TO live_deleted_product');
sqlite.exec('RELEASE live_deleted_product');

sqlite.prepare('UPDATE toys_center_products SET title=?,price_cents=?,quantity=? WHERE id=1').run('Catalog scalar drift', 7777, 3);
putsBefore = r2.putCalls;
response = await versionRequest('version.scalar-drift.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.equal(r2.putCalls, putsBefore, 'scalar drift performs zero R2 writes');
sqlite.prepare('UPDATE toys_center_products SET title=?,price_cents=?,quantity=? WHERE id=1').run('Alpha Item 001', 1001, 6);

r2.failPutAfterWritePrefix = 'live-center/assets/';
r2.failDeleteCount = 1;
response = await versionRequest('version.ambiguous.0001');
assert.equal(response.status, 500);
await Promise.allSettled(waits.splice(0));
assert.deepEqual(liveObjectKeys(), [], 'ambiguous R2 put is registered before await and cleaned with retry');

d1.failVersionBatchOnce = true;
r2.failDeleteCount = 1;
response = await versionRequest('version.dbfail.0001');
assert.equal(response.status, 500);
await Promise.allSettled(waits.splice(0));
assert.deepEqual(liveObjectKeys(), [], 'D1 failure cleans package and every version-owned asset');
assert.equal(baselineVersionRows(), 0);

d1.failBeforeBatchAndReconcileOnce = true;
response = await versionRequest('version.uncertain-no-row.0001');
assert.equal(response.status, 503);
assert.equal((await json(response)).code, 'LIVE_VERSION_RECONCILE_UNCERTAIN');
await Promise.allSettled(waits.splice(0));
assert.deepEqual(liveObjectKeys(), [], 'deferred reconciliation cleans objects when the batch did not commit');
assert.equal(baselineVersionRows(), 0);

r2.afterPutOnce = {
  prefix: 'live-center/packages/',
  callback: async () => sqlite.prepare('UPDATE toys_center_products SET title=? WHERE id=1').run('TOCTOU changed after copy'),
};
response = await versionRequest('version.toctou.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.deepEqual(liveObjectKeys(), [], 'final D1 snapshot gate cleans every copied object on catalog race');
assert.equal(baselineVersionRows(), 0);
sqlite.prepare('UPDATE toys_center_products SET title=? WHERE id=1').run('Alpha Item 001');

response = await versionRequest('version.reused-after-stale.0001', 999);
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_STALE_REVISION');
d1.commitThenThrowOnce = true;
response = await versionRequest('version.reused-after-stale.0001');
assert.equal(response.status, 200, 'commit-then-throw reconciles to the committed immutable version');
const versionOne = (await json(response)).item;
assert.equal(versionOne.version_number, 1);
assert.equal(versionOne.asset_count, 2);
assert.equal(sqlite.prepare('SELECT asset_count FROM live_show_versions WHERE id=?').get(versionOne.id).asset_count, 2);

const firstVersionAsset = sqlite.prepare('SELECT object_key FROM live_show_version_assets WHERE version_id=? ORDER BY scene_position LIMIT 1').get(versionOne.id);
const savedVersionAsset = cloneStored(r2.objects.get(firstVersionAsset.object_key));
r2.objects.delete(firstVersionAsset.object_key);
response = await versionRequest('version.reused-after-stale.0001');
assert.equal(response.status, 503, 'replay refuses a committed version missing one of its exact asset_count objects');
assert.equal((await json(response)).code, 'LIVE_VERSION_RECONCILE_FAILED');
r2.objects.set(firstVersionAsset.object_key, savedVersionAsset);
response = await versionRequest('version.reused-after-stale.0001');
assert.equal(response.status, 200);
assert.equal((await json(response)).item.id, versionOne.id);
response = await createLiveVersion(ctx(`/api/admin/live-center/shows/${showId}/versions`, {
  method: 'POST', body: { expected_revision: 999 }, headers: { 'idempotency-key': 'version.reused-after-stale.0001' }, params: { id: showId },
}));
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_IDEMPOTENCY_CONFLICT');

d1.corruptBatchResultsOnce = true;
response = await versionRequest('version.committed-corrupt-results.0001');
assert.equal(response.status, 200, 'a corrupt success result is reconciled against exact committed metadata');
assert.equal((await json(response)).replayed, true);

d1.commitThenThrowOnce = true;
d1.commitThenThrowReconcileFailures = 1;
response = await versionRequest('version.deferred-commit.0001');
assert.equal(response.status, 503);
assert.equal((await json(response)).code, 'LIVE_VERSION_RECONCILE_UNCERTAIN');
await Promise.allSettled(waits.splice(0));
response = await versionRequest('version.deferred-commit.0001');
assert.equal(response.status, 200, 'deferred reconciliation preserves a committed version after an initially failed lookup');

const concurrent = await Promise.all([versionRequest('version.concurrent.0002'), versionRequest('version.concurrent.0003')]);
assert.deepEqual(concurrent.map(item => item.status).sort(), [201, 201]);
const versionNumbers = sqlite.prepare('SELECT version_number FROM live_show_versions WHERE show_id=? ORDER BY version_number').all(showId).map(row => Number(row.version_number));
assert.deepEqual(versionNumbers, [1, 2, 3, 4, 5]);

const downloadCtx = (extraHeaders = {}, head = false, selectedShow = showId, session = 'admin-session', selectedVersion = versionOne.id) => ctx(`/api/admin/live-center/shows/${selectedShow}/versions/${selectedVersion}/package`, {
  method: head ? 'HEAD' : 'GET', session, headers: extraHeaders, params: { id: selectedShow, versionId: selectedVersion },
});
const versionOneRow = sqlite.prepare('SELECT * FROM live_show_versions WHERE id=?').get(versionOne.id);
const savedPackageObject = cloneStored(r2.objects.get(versionOneRow.package_object_key));
r2.objects.delete(versionOneRow.package_object_key);
for (const head of [false, true]) {
  response = await downloadLivePackage(downloadCtx({}, head), { head });
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await json(response)).code, 'LIVE_PACKAGE_MISSING');
}
r2.objects.set(versionOneRow.package_object_key, cloneStored(savedPackageObject));
r2.objects.get(versionOneRow.package_object_key).bytes = new Uint8Array(savedPackageObject.bytes.byteLength + 1);
response = await downloadLivePackage(downloadCtx());
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PACKAGE_INTEGRITY');
r2.objects.set(versionOneRow.package_object_key, cloneStored(savedPackageObject));
r2.objects.get(versionOneRow.package_object_key).customMetadata.packageSha256 = '0'.repeat(64);
response = await downloadLivePackage(downloadCtx({}, true), { head: true });
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PACKAGE_INTEGRITY');
r2.objects.set(versionOneRow.package_object_key, cloneStored(savedPackageObject));

response = await downloadLivePackage(downloadCtx());
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal(response.headers.get('content-type'), 'application/vnd.visiond.live');
const etag = response.headers.get('etag');
const packageBytes = new Uint8Array(await response.arrayBuffer());
assert.equal(packageBytes.byteLength, versionOne.package_size);
response = await downloadLivePackage(downloadCtx({}, false, showId, 'boss-session'));
assert.equal(response.status, 200, 'Boss can download an authorized immutable package');
response = await downloadLivePackage(downloadCtx());
assert.deepEqual(new Uint8Array(await response.arrayBuffer()), packageBytes);
const getsBefore304 = r2.getCalls;
response = await downloadLivePackage(downloadCtx({ 'if-none-match': etag }));
assert.equal(response.status, 304);
assert.equal((await response.arrayBuffer()).byteLength, 0);
assert.equal(r2.getCalls, getsBefore304, '304 is answered before R2');
response = await downloadLivePackage(downloadCtx({}, true), { head: true });
assert.equal(response.status, 200);
assert.equal((await response.arrayBuffer()).byteLength, 0);
response = await downloadLivePackage(downloadCtx({}, false, otherShowId));
assert.equal(response.status, 404);

const parsed = await parseVisionDLivePackage(packageBytes);
assert.equal(parsed.manifest.scenes.length, 2);
assert.equal(parsed.manifest.scenes[0].product.title, 'Alpha Item 001');
assert.equal(parsed.manifest.scenes[0].product.price_minor, 1001);
assert.equal(parsed.assets.size, 2);
assert.deepEqual(Object.keys(parsed.manifest.created), ['at'], 'portable manifest omits internal creator account identifiers');
const rawPackageText = new TextDecoder('latin1').decode(packageBytes);
for (const sentinelValue of Object.values(sentinels)) assert.equal(rawPackageText.includes(sentinelValue), false);
const playback = createLocalLivePlayback(parsed);
const originalFetch = globalThis.fetch;
let playbackFetches = 0;
globalThis.fetch = async () => { playbackFetches += 1; throw new Error('network forbidden'); };
try {
  assert.equal(playback.currentScene().position, 0);
  assert.equal(playback.currentAsset().mime_type, 'image/png');
  assert.equal(playback.next().position, 1);
  assert.equal(playback.previous().position, 0);
  assert.equal(playback.getAsset(parsed.manifest.scenes[1].assets[0].reference).id, parsed.manifest.scenes[1].assets[0].id);
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(playbackFetches, 0, 'local playback performs no network calls');

const versionAssetRows = sqlite.prepare('SELECT * FROM live_show_version_assets WHERE version_id=? ORDER BY scene_position').all(versionOne.id);
assert.equal(versionAssetRows.length, 2);
const retainedKeys = versionAssetRows.map(row => row.object_key);
assert.ok(retainedKeys.every(key => r2.objects.has(key)));

putsBefore = r2.putCalls;
const liveObjectsBeforeDrift = liveObjectKeys().length;
sqlite.prepare('UPDATE toys_center_products SET title=?,price_cents=?,quantity=? WHERE id=1').run('Catalog title refreshed', 7777, 3);
response = await versionRequest('version.after-scalar-drift.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.equal(r2.putCalls, putsBefore);
assert.equal(liveObjectKeys().length, liveObjectsBeforeDrift);
sqlite.prepare('UPDATE toys_center_products SET title=?,price_cents=?,quantity=? WHERE id=1').run('Alpha Item 001', 1001, 6);

sqlite.prepare('UPDATE toys_center_products SET image_1_key=? WHERE id=1').run('toys/1-0.png');
putsBefore = r2.putCalls;
response = await versionRequest('version.after-cover-switch.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.equal(r2.putCalls, putsBefore);
sqlite.prepare('UPDATE toys_center_products SET image_1_key=? WHERE id=1').run('toys/1-selected.png');

const savedCoverRow = sqlite.prepare('SELECT id,position,image_key FROM toys_center_product_images WHERE product_id=1 AND image_key=?').get('toys/1-selected.png');
sqlite.prepare('UPDATE toys_center_product_images SET position=2 WHERE id=?').run(savedCoverRow.id);
response = await versionRequest('version.after-cover-reorder.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
sqlite.prepare('UPDATE toys_center_product_images SET position=1 WHERE id=?').run(savedCoverRow.id);

r2.objects.get('toys/1-selected.png').etag = 'changed-content-etag';
putsBefore = r2.putCalls;
response = await versionRequest('version.after-content-drift.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.equal(r2.putCalls, putsBefore);
r2.objects.set('toys/1-selected.png', cloneStored(savedPrimary));

sqlite.prepare('DELETE FROM toys_center_product_images WHERE id=?').run(savedCoverRow.id);
putsBefore = r2.putCalls;
response = await versionRequest('version.after-gallery-delete.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');
assert.equal(r2.putCalls, putsBefore);
const replacementCoverId = Number(addImage.run(1, 1, 'toys/1-selected.png').lastInsertRowid);
assert.notEqual(replacementCoverId, Number(savedCoverRow.id));
response = await versionRequest('version.after-gallery-replace.0001');
assert.equal(response.status, 409);
assert.equal((await json(response)).code, 'LIVE_PRODUCT_CHANGED');

sqlite.prepare('UPDATE toys_center_products SET title=?,price_cents=?,quantity=? WHERE id=1').run('Catalog title refreshed', 7777, 3);
response = await updateLiveShow(ctx(`/api/admin/live-center/shows/${showId}`, {
  method: 'PUT',
  body: { ...updateBody, expected_revision: 2 },
  params: { id: showId },
}));
assert.equal(response.status, 200, 're-saving refreshes scalar and selected-cover baselines');
assert.equal((await json(response)).item.revision, 3);
response = await versionRequest('version.after-resave.0001', 3);
assert.equal(response.status, 201);
const refreshedVersion = (await json(response)).item;
response = await downloadLivePackage(downloadCtx({}, false, showId, 'admin-session', refreshedVersion.id));
const refreshedParsed = await parseVisionDLivePackage(new Uint8Array(await response.arrayBuffer()));
assert.equal(refreshedParsed.manifest.scenes[0].product.title, 'Catalog title refreshed');
assert.equal(refreshedParsed.manifest.scenes[0].product.price_minor, 7777);

response = await downloadLivePackage(downloadCtx());
assert.deepEqual(new Uint8Array(await response.arrayBuffer()), packageBytes, 'older package bytes remain immutable after catalog drift and re-save');
sqlite.prepare('DELETE FROM toys_center_products WHERE id=1').run();
r2.objects.delete('toys/1-selected.png');
r2.objects.delete('toys/1-0.png');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_show_scenes WHERE show_id=?').get(showId).count, 2, 'draft snapshot does not block or cascade Toys hard delete');
assert.ok(retainedKeys.every(key => r2.objects.has(key)), 'version-owned R2 copies survive catalog delete');
response = await downloadLivePackage(downloadCtx());
const bytesAfterCatalogDelete = new Uint8Array(await response.arrayBuffer());
assert.deepEqual(bytesAfterCatalogDelete, packageBytes);
assert.equal((await parseVisionDLivePackage(bytesAfterCatalogDelete)).manifest.scenes[0].product.title, 'Alpha Item 001');
assert.throws(() => sqlite.prepare('UPDATE live_show_versions SET package_size=package_size+1 WHERE id=?').run(versionOne.id), /LIVE_VERSION_IMMUTABLE/);
assert.throws(() => sqlite.prepare('DELETE FROM live_show_version_assets WHERE id=?').run(versionAssetRows[0].id), /LIVE_VERSION_ASSET_IMMUTABLE/);

const oversizedSource = new Uint8Array(5 * 1024 * 1024);
oversizedSource.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
for (let productId = 4; productId <= 10; productId += 1) r2.seed(`toys/${productId}-0.png`, oversizedSource);
const oversizedShowBody = {
  ...showBody,
  title: 'Oversized embedded covers',
  scenes: Array.from({ length: 7 }, (_, index) => ({
    product_id: 4 + index,
    script: `Oversized scene ${index + 1}`,
    cue: { label: `Big ${index + 1}`, duration_seconds: 60, transition: 'cut' },
  })),
};
response = await createLiveShow(ctx('/api/admin/live-center/shows', { method: 'POST', body: oversizedShowBody, headers: { 'idempotency-key': 'show.oversized.0001' } }));
assert.equal(response.status, 201);
const oversizedShowId = (await json(response)).item.id;
putsBefore = r2.putCalls;
const objectsBeforeOversizedVersion = liveObjectKeys().length;
response = await createLiveVersion(ctx(`/api/admin/live-center/shows/${oversizedShowId}/versions`, {
  method: 'POST',
  body: { expected_revision: 1 },
  headers: { 'idempotency-key': 'version.oversized.0001' },
  params: { id: oversizedShowId },
}));
assert.equal(response.status, 413);
const oversizedPayload = await json(response);
assert.equal(oversizedPayload.code, 'LIVE_PACKAGE_TOO_LARGE');
assert.match(oversizedPayload.error, /32 MiB/);
assert.equal(r2.putCalls, putsBefore, 'aggregate cover budget fails before any version-owned R2 put');
assert.equal(liveObjectKeys().length, objectsBeforeOversizedVersion);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_show_versions WHERE show_id=?').get(oversizedShowId).count, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM live_show_version_assets WHERE show_id=?').get(oversizedShowId).count, 0);
for (let productId = 4; productId <= 10; productId += 1) r2.objects.delete(`toys/${productId}-0.png`);

const magicBytes = new TextEncoder().encode(LIVE_PACKAGE_MAGIC_TEXT);
function packageParts(bytes) {
  const envelopeLength = new DataView(bytes.buffer, bytes.byteOffset + magicBytes.byteLength, 4).getUint32(0, false);
  const start = magicBytes.byteLength + 4;
  return {
    envelope: JSON.parse(new TextDecoder().decode(bytes.subarray(start, start + envelopeLength))),
    payload: bytes.slice(start + envelopeLength),
  };
}
async function repack(original, mutate, { canonical = true } = {}) {
  const { envelope, payload } = packageParts(original);
  const replacementPayload = await mutate(envelope, payload);
  const outputPayload = replacementPayload instanceof Uint8Array ? replacementPayload : payload;
  envelope.integrity.manifest_sha256 = await livePackageSha256(canonicalLiveJson(envelope.manifest));
  const text = canonical ? canonicalLiveJson(envelope) : JSON.stringify(envelope, null, 1);
  const envelopeBytes = new TextEncoder().encode(text);
  const output = new Uint8Array(magicBytes.byteLength + 4 + envelopeBytes.byteLength + outputPayload.byteLength);
  output.set(magicBytes);
  new DataView(output.buffer).setUint32(magicBytes.byteLength, envelopeBytes.byteLength, false);
  output.set(envelopeBytes, magicBytes.byteLength + 4);
  output.set(outputPayload, magicBytes.byteLength + 4 + envelopeBytes.byteLength);
  return output;
}

async function packageWithEmbeddedSecret(name, value, { splitBoundary = false } = {}) {
  return repack(packageBytes, async (envelope, payload) => {
    const [firstDescriptor, secondDescriptor] = envelope.manifest.embedded_assets;
    const firstSceneAsset = envelope.manifest.scenes[0].assets[0];
    const originalSecond = payload.slice(secondDescriptor.offset, secondDescriptor.offset + secondDescriptor.length);
    const first = new Uint8Array(splitBoundary ? 16640 : firstDescriptor.length);
    first.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const secretBytes = new TextEncoder().encode(`{"${name}":"${value}"}`);
    const secretOffset = splitBoundary ? 16378 : first.byteLength - secretBytes.byteLength;
    first.set(secretBytes, secretOffset);
    const digest = await livePackageSha256(first);
    firstDescriptor.length = first.byteLength;
    firstDescriptor.sha256 = digest;
    firstSceneAsset.size = first.byteLength;
    firstSceneAsset.integrity.sha256 = digest;
    secondDescriptor.offset = first.byteLength;
    const nextPayload = new Uint8Array(first.byteLength + originalSecond.byteLength);
    nextPayload.set(first, 0);
    nextPayload.set(originalSecond, first.byteLength);
    return nextPayload;
  });
}

await assert.rejects(() => parseVisionDLivePackage(packageBytes.slice(0, -1)), /truncated|digest/i);
const trailing = new Uint8Array(packageBytes.byteLength + 1); trailing.set(packageBytes);
await assert.rejects(() => parseVisionDLivePackage(trailing), /trailing/i);
const tamperedPayload = packageBytes.slice(); tamperedPayload[tamperedPayload.length - 1] ^= 0xff;
await assert.rejects(() => parseVisionDLivePackage(tamperedPayload), /digest/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => { envelope.schema_version = 2; })), /schema/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => { envelope.manifest.scenes[1].product.id = envelope.manifest.scenes[0].product.id; })), /unique/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => { envelope.manifest.embedded_assets[1].id = envelope.manifest.embedded_assets[0].id; })), /unique|match/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => { envelope.manifest.embedded_assets[0].offset = 1; })), /offset/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => { envelope.manifest.embedded_assets[0].length += 1; })), /match|payload|offset/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => {
  envelope.manifest.scenes[0].assets[0].reference = 'https://visiondonline.com/not-portable.png';
})), /reference/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => {
  envelope.manifest.scenes[0].assets[0].mime_type = 'image/jpeg';
  envelope.manifest.embedded_assets[0].mime_type = 'image/jpeg';
})), /signature/i);
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => { envelope.manifest.password = sentinels.password; })), error => error.code === 'LIVE_PACKAGE_SECRET');
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, envelope => {
  envelope.manifest.scenes[0].script = `{"access_token":"${sentinels.access_token}"}`;
})), error => error.code === 'LIVE_PACKAGE_SECRET');
let embeddedSecretIndex = 0;
for (const [name, sentinelValue] of Object.entries(sentinels)) {
  const secretPackage = await packageWithEmbeddedSecret(name, sentinelValue, { splitBoundary: embeddedSecretIndex++ === 0 });
  await assert.rejects(() => parseVisionDLivePackage(secretPackage), error => error.code === 'LIVE_PACKAGE_SECRET');
}
await assert.rejects(async () => parseVisionDLivePackage(await repack(packageBytes, async () => {}, { canonical: false })), /canonical/i);
await assert.rejects(() => parseVisionDLivePackage(new Uint8Array(LIVE_PACKAGE_MAX_BYTES + 1)), error => error.code === 'LIVE_PACKAGE_TOO_LARGE');

await assert.rejects(() => buildLivePackage({
  show: { id: showId, title: 'x', description: '', revision: 2, avatar_preset: 'none', output_profile: 'landscape-1080p' },
  versionId: 'livev_00000000000000000000000000000000', versionNumber: 9, createdAt: '2026-09-22T00:00:00.000Z', createdBy: 1, scenes: [],
  assets: [{ id: 'livea_00000000000000000000000000000000', bytes: new Uint8Array(LIVE_PACKAGE_MAX_BYTES), mime_type: 'image/png', sha256: '0'.repeat(64) }],
}), error => error.code === 'LIVE_PACKAGE_TOO_LARGE');

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

let clock = 0;
let ttlCalls = 0;
let ttlViewer = 1;
const ttlStore = createLiveCenterStore({
  now: () => clock,
  ttlMs: 100,
  fetchImpl: async () => jsonResponse({ viewer_id: ttlViewer, call: ++ttlCalls }),
});
ttlStore.setViewer('1:admin');
assert.equal((await ttlStore.request('/ttl', {}, { tags: ['show:a'] })).call, 1);
assert.equal((await ttlStore.request('/ttl', {}, { tags: ['show:a'] })).call, 1);
clock = 101;
assert.equal((await ttlStore.request('/ttl', {}, { tags: ['show:a'] })).call, 2);
ttlStore.setViewer('3:boss');
ttlViewer = 3;
assert.equal((await ttlStore.request('/ttl', {}, { tags: ['show:a'] })).call, 3, 'viewer scopes do not share cache');

const pending = [];
let raceCalls = 0;
const raceStore = createLiveCenterStore({
  fetchImpl: () => {
    raceCalls += 1;
    const item = deferred();
    pending.push(item);
    return item.promise;
  },
});
raceStore.setViewer('1:admin');
const oldRequest = raceStore.request('/same', {}, { tags: ['show:one'] });
const oldJoined = raceStore.request('/same', {}, { tags: ['show:one'] });
assert.equal(raceCalls, 1, 'identical in-flight GET is deduplicated');
raceStore.invalidate(['show:one']);
const newRequest = raceStore.request('/same', {}, { tags: ['show:one'] });
assert.equal(raceCalls, 2, 'invalidated in-flight GET is not reused');
pending[1].resolve(jsonResponse({ viewer_id: 1, value: 2 }));
assert.equal((await newRequest).value, 2);
pending[0].resolve(jsonResponse({ viewer_id: 1, value: 1 }));
assert.equal((await oldRequest).value, 1);
assert.equal((await oldJoined).value, 1);
assert.equal((await raceStore.request('/same', {}, { tags: ['show:one'] })).value, 2, 'late stale completion cannot overwrite newer cache');
const unrelatedBefore = raceCalls;
const unrelatedDeferred = deferred();
pending.push(unrelatedDeferred);
const unrelatedPromise = raceStore.request('/other', {}, { tags: ['show:two'] });
pending.at(-1).resolve(jsonResponse({ viewer_id: 1, value: 9 }));
await unrelatedPromise;
raceStore.invalidate(['show:one']);
assert.equal((await raceStore.request('/other', {}, { tags: ['show:two'] })).value, 9);
assert.equal(raceCalls, unrelatedBefore + 1, 'scoped invalidation preserves unrelated cache');

const mutationPending = [];
let mutationCalls = 0;
const mutationStore = createLiveCenterStore({
  fetchImpl: () => {
    mutationCalls += 1;
    const item = deferred();
    mutationPending.push(item);
    return item.promise;
  },
});
mutationStore.setViewer('1:admin');
const sameMutationOptions = { method: 'POST', body: '{"expected_revision":2}', headers: { 'Idempotency-Key': 'version.same.0001' } };
const sameMutationA = mutationStore.request('/versions', sameMutationOptions, { cacheable: false });
const sameMutationB = mutationStore.request('/versions', sameMutationOptions, { cacheable: false });
assert.equal(mutationCalls, 1, 'same idempotency key and body share one in-flight mutation');
mutationPending[0].resolve(jsonResponse({ viewer_id: 1, ok: true }));
await Promise.all([sameMutationA, sameMutationB]);
const differentMutationA = mutationStore.request('/versions', { ...sameMutationOptions, headers: { 'idempotency-key': 'version.different.0001' } }, { cacheable: false });
const differentMutationB = mutationStore.request('/versions', { ...sameMutationOptions, headers: { 'idempotency-key': 'version.different.0002' } }, { cacheable: false });
assert.equal(mutationCalls, 3, 'different idempotency keys never collapse into one mutation');
mutationPending[1].resolve(jsonResponse({ viewer_id: 1, ok: true, id: 1 }));
mutationPending[2].resolve(jsonResponse({ viewer_id: 1, ok: true, id: 2 }));
await Promise.all([differentMutationA, differentMutationB]);

const viewerPending = new Map();
let viewerCalls = 0;
const viewerStore = createLiveCenterStore({
  fetchImpl: url => {
    viewerCalls += 1;
    const item = deferred();
    viewerPending.set(url, item);
    return item.promise;
  },
});
viewerStore.setViewer('7:admin');
const delayedViewerSeven = viewerStore.request('/shows', {}, { tags: ['shows'] });
const switchedViewerEight = viewerStore.request('/products', {}, { tags: ['products'] });
viewerPending.get('/products').resolve(jsonResponse({ viewer_id: 8, items: ['viewer-8'] }));
assert.deepEqual((await switchedViewerEight).items, ['viewer-8']);
assert.equal(viewerStore.inspect().viewer, '8:server');
assert.ok(viewerStore.inspect().cacheKeys.every(key => key.startsWith('8:server:')));
viewerPending.get('/shows').resolve(jsonResponse({ viewer_id: 7, items: ['viewer-7-stale'] }));
await assert.rejects(delayedViewerSeven, error => error.code === 'LIVE_VIEWER_CHANGED');
assert.ok(viewerStore.inspect().cacheKeys.every(key => !key.startsWith('7:')));
assert.deepEqual((await viewerStore.request('/products', {}, { tags: ['products'] })).items, ['viewer-8']);
assert.equal(viewerCalls, 2, 'viewer-8 response is re-keyed into only the authoritative viewer scope');

const mutationViewerPending = new Map();
const mutationViewerStore = createLiveCenterStore({
  fetchImpl: url => {
    const item = deferred();
    mutationViewerPending.set(url, item);
    return item.promise;
  },
});
mutationViewerStore.setViewer('7:admin');
const delayedViewerSevenSave = mutationViewerStore.request('/save', {
  method: 'PUT',
  body: '{"expected_revision":2}',
  headers: { 'idempotency-key': 'save.viewer7.0001' },
}, { cacheable: false });
const viewerEightRead = mutationViewerStore.request('/viewer-eight-products', {}, { tags: ['products'] });
mutationViewerPending.get('/viewer-eight-products').resolve(jsonResponse({ viewer_id: 8, items: [] }));
await viewerEightRead;
mutationViewerPending.get('/save').resolve(jsonResponse({ viewer_id: 7, ok: true, item: { title: 'stale viewer-7 editor' } }));
await assert.rejects(delayedViewerSevenSave, error => error.code === 'LIVE_VIEWER_CHANGED');
assert.equal(mutationViewerStore.inspect().viewer, '8:server', 'late mutation cannot revert or render across a viewer switch');

const versionsResponse = await listLiveVersions(ctx(`/api/admin/live-center/shows/${showId}/versions?limit=24`, { params: { id: showId } }));
assert.equal(versionsResponse.status, 200);
assert.equal((await json(versionsResponse)).items.length, 6);

const insertPagedVersion = sqlite.prepare('INSERT INTO live_show_versions(id,show_id,version_number,show_revision,schema_version,idempotency_key,request_hash,package_object_key,package_sha256,manifest_sha256,package_size,asset_count,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
for (let index = 1; index <= 49; index += 1) {
  const suffix = index.toString(16);
  insertPagedVersion.run(
    `livev_${suffix.padStart(32, '0')}`,
    otherShowId,
    index,
    1,
    1,
    `paged.version.${index}`,
    suffix.padStart(64, '0'),
    `live-center/paged/${index}.visiondlive`,
    suffix.padStart(64, '0'),
    suffix.padStart(64, 'f').slice(-64),
    1,
    1,
    1,
    `2026-09-22T00:${String(index).padStart(2, '0')}:00.000Z`,
  );
}
cursor = null;
const pagedVersionIds = [];
do {
  const params = new URLSearchParams({ limit: '24' });
  if (cursor) params.set('cursor', cursor);
  const page = await json(await listLiveVersions(ctx(`/api/admin/live-center/shows/${otherShowId}/versions?${params}`, { params: { id: otherShowId } })));
  assert.ok(page.items.length <= 24);
  pagedVersionIds.push(...page.items.map(item => item.id));
  cursor = page.pagination.next_cursor;
} while (cursor);
assert.equal(pagedVersionIds.length, 49);
assert.equal(new Set(pagedVersionIds).size, 49, 'version keyset pagination has no duplicates or omissions');
const shippedVersionFirstSql = d1.queries.find(sql => sql.startsWith('SELECT id,show_id,version_number') && sql.includes('ORDER BY version_number DESC LIMIT') && !sql.includes('version_number<?'));
const shippedVersionNextSql = d1.queries.find(sql => sql.startsWith('SELECT id,show_id,version_number') && sql.includes('ORDER BY version_number DESC LIMIT') && sql.includes('version_number<?'));
for (const [sql, args] of [
  [shippedVersionFirstSql, [otherShowId, 25]],
  [shippedVersionNextSql, [otherShowId, 25, 25]],
]) {
  assert.ok(sql, 'exact shipped version-list query was captured');
  const detail = sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row => row.detail).join(' | ');
  assert.match(detail, /SEARCH live_show_versions USING INDEX idx_live_versions_show_number/, detail);
  assert.doesNotMatch(detail, /\bSCAN\b|TEMP B-TREE/, detail);
}

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [
  process.env.PLAYWRIGHT_PACKAGE,
  'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  'playwright',
].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'Playwright Chromium is required for the Live Center browser gate');

const browserShowA = 'live_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const browserShowB = 'live_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const browserVersionId = 'livev_cccccccccccccccccccccccccccccccc';
const browserProducts = Array.from({ length: 26 }, (_, index) => ({
  id: 7001 + index,
  meta_id: `BROWSER-${index + 1}`,
  title: `Browser Toy ${String(index + 1).padStart(2, '0')}`,
  price_minor: 1200 + index,
  currency: 'THB',
  stock: 10 + index,
  image_url: '/favicon.svg?v=browser',
}));
const browserScene = product => ({
  position: 0,
  product_id: product.id,
  product: {
    meta_id: product.meta_id,
    title: product.title,
    price_minor: product.price_minor,
    currency: product.currency,
    stock_saved: product.stock,
    stock_current: product.stock,
    available: true,
  },
  script: 'Browser scene script',
  cue: { label: 'Browser cue', duration_seconds: 60, transition: 'cut' },
});
const browserDetail = (id, title, revision, product = browserProducts[0]) => ({
  id,
  title,
  description: '',
  avatar_preset: 'visiond-default',
  output_profile: 'landscape-1080p',
  scene_count: 1,
  revision,
  created_by: 8,
  updated_by: 8,
  created_at: '2026-09-22T08:00:00.000Z',
  updated_at: `2026-09-22T08:0${Math.min(revision, 9)}:00.000Z`,
  scenes: [browserScene(product)],
});
const browserShows = new Map([[browserShowB, browserDetail(browserShowB, 'Browser Show B', 1, browserProducts[1])]]);
const browserVersions = new Map([[browserShowA, []], [browserShowB, []]]);
const browserMetrics = { productQueries: [], versionPosts: 0, requests: [] };
const browserControl = { holdRefreshA: null, holdSaveA: null, holdVersionA: null, staleNext: false, driftNext: false };
const jsonReply = (res, value, status = 200) => {
  const body = Buffer.from(JSON.stringify(value));
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, no-store', 'content-length': body.byteLength });
  res.end(body);
};
const requestJson = async req => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
};
const summaryFor = item => ({
  id: item.id,
  title: item.title,
  description: item.description,
  avatar_preset: item.avatar_preset,
  output_profile: item.output_profile,
  scene_count: item.scene_count,
  revision: item.revision,
  created_at: item.created_at,
  updated_at: item.updated_at,
});
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const staticMime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const browserServer = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { pathname } = url;
    browserMetrics.requests.push(`${req.method} ${pathname}`);
    if (pathname === '/api/auth/me') return jsonReply(res, { user: { id: 8, role: 'boss', name: 'Browser Boss' } });
    if (pathname === '/api/admin/live-center/products' && req.method === 'GET') {
      const query = (url.searchParams.get('q') || '').trim().toLowerCase();
      browserMetrics.productQueries.push({ q: query, cursor: url.searchParams.get('cursor') || '' });
      if (query === 'trigger error') return jsonReply(res, { error: 'mocked product search error' }, 503);
      const matches = query ? browserProducts.filter(product => product.title.toLowerCase().startsWith(query)) : browserProducts;
      const secondPage = url.searchParams.get('cursor') === 'browser-products-next';
      const items = secondPage ? matches.slice(24) : matches.slice(0, 24);
      const hasMore = !secondPage && matches.length > 24;
      return jsonReply(res, { viewer_id: 8, items, pagination: { limit: 24, has_more: hasMore, next_cursor: hasMore ? 'browser-products-next' : null } });
    }
    if (pathname === '/api/admin/live-center/shows' && req.method === 'GET') {
      return jsonReply(res, { viewer_id: 8, items: [...browserShows.values()].map(summaryFor), pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === '/api/admin/live-center/shows' && req.method === 'POST') {
      const payload = await requestJson(req);
      const chosen = browserProducts.find(product => product.id === payload.scenes[0]?.product_id) || browserProducts[0];
      const item = { ...browserDetail(browserShowA, payload.title, 1, chosen), description: payload.description || '', scenes: [{ ...browserScene(chosen), script: payload.scenes[0]?.script || '', cue: payload.scenes[0]?.cue || browserScene(chosen).cue }] };
      browserShows.set(browserShowA, item);
      browserVersions.set(browserShowA, []);
      return jsonReply(res, { viewer_id: 8, ok: true, item }, 201);
    }
    const showMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})$/);
    if (showMatch && req.method === 'GET') {
      const snapshot = structuredClone(browserShows.get(showMatch[1]));
      if (!snapshot) return jsonReply(res, { error: 'not found' }, 404);
      if (showMatch[1] === browserShowA && browserControl.holdRefreshA) {
        browserControl.holdRefreshA.seen.resolve();
        await browserControl.holdRefreshA.release.promise;
      }
      return jsonReply(res, { viewer_id: 8, item: snapshot });
    }
    if (showMatch && req.method === 'PUT') {
      const payload = await requestJson(req);
      if (browserControl.staleNext) {
        browserControl.staleNext = false;
        return jsonReply(res, { error: 'รายการนี้ถูกแก้จากอีกหน้าต่าง กรุณาโหลดใหม่', code: 'LIVE_STALE_REVISION', current_revision: browserShows.get(showMatch[1])?.revision || 1 }, 409);
      }
      if (showMatch[1] === browserShowA && browserControl.holdSaveA) {
        browserControl.holdSaveA.seen.resolve();
        await browserControl.holdSaveA.release.promise;
      }
      const current = browserShows.get(showMatch[1]);
      const chosen = browserProducts.find(product => product.id === payload.scenes[0]?.product_id) || browserProducts[0];
      const next = {
        ...current,
        title: payload.title,
        description: payload.description || '',
        revision: current.revision + 1,
        updated_at: new Date(Date.parse(current.updated_at) + 60_000).toISOString(),
        scenes: [{ ...browserScene(chosen), script: payload.scenes[0]?.script || '', cue: payload.scenes[0]?.cue || browserScene(chosen).cue }],
      };
      browserShows.set(showMatch[1], next);
      return jsonReply(res, { viewer_id: 8, ok: true, item: next });
    }
    const versionsMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})\/versions$/);
    if (versionsMatch && req.method === 'GET') {
      const items = browserVersions.get(versionsMatch[1]) || [];
      return jsonReply(res, { viewer_id: 8, items, pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (versionsMatch && req.method === 'POST') {
      browserMetrics.versionPosts += 1;
      if (browserControl.driftNext) {
        browserControl.driftNext = false;
        return jsonReply(res, { error: 'ข้อมูลหรือรูปหลักสินค้าเปลี่ยน กรุณาบันทึกร่างใหม่', code: 'LIVE_PRODUCT_CHANGED' }, 409);
      }
      if (versionsMatch[1] === browserShowA && browserControl.holdVersionA) {
        browserControl.holdVersionA.seen.resolve();
        await browserControl.holdVersionA.release.promise;
      }
      const item = {
        id: browserVersionId,
        show_id: versionsMatch[1],
        version_number: 1,
        show_revision: browserShows.get(versionsMatch[1]).revision,
        schema_version: 1,
        package_sha256: versionOne.package_sha256,
        manifest_sha256: versionOne.manifest_sha256,
        package_size: packageBytes.byteLength,
        asset_count: 2,
        created_by: 8,
        created_at: '2026-09-22T09:00:00.000Z',
        download_url: `/api/admin/live-center/shows/${versionsMatch[1]}/versions/${browserVersionId}/package`,
      };
      browserVersions.set(versionsMatch[1], [item]);
      return jsonReply(res, { viewer_id: 8, ok: true, item }, 201);
    }
    if (/^\/api\/admin\/live-center\/shows\/live_[a-f0-9]{32}\/versions\/livev_[a-f0-9]{32}\/package$/.test(pathname)) {
      res.writeHead(200, { 'content-type': 'application/vnd.visiond.live', 'cache-control': 'private, no-store', 'content-length': packageBytes.byteLength });
      return req.method === 'HEAD' ? res.end() : res.end(Buffer.from(packageBytes));
    }
    const relative = pathname === '/' ? 'live-center.html' : pathname.replace(/^\/+/, '');
    const file = path.resolve(publicRoot, relative);
    if (!file.startsWith(publicRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': staticMime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    return res.end(fs.readFileSync(file));
  } catch (error) {
    return jsonReply(res, { error: String(error?.message || error) }, 500);
  }
});
await new Promise(resolve => browserServer.listen(0, '127.0.0.1', resolve));
const browserBase = `http://127.0.0.1:${browserServer.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const browserErrors = [];
const handledBrowserHttpErrors = [];
const platformRequests = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'th-TH' });
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource:.*(?:409 \(Conflict\)|503 \(Service Unavailable\))/.test(message.text())) handledBrowserHttpErrors.push(message.text());
    else browserErrors.push(message.text());
  });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('request', request => { if (/facebook|tiktok|shopee/i.test(request.url())) platformRequests.push(request.url()); });
  await page.goto(`${browserBase}/live-center.html`);
  await page.locator('.product-item').nth(23).waitFor();
  await page.locator('.product-item button').first().evaluate(button => { button.click(); button.click(); });
  await page.waitForFunction(() => document.querySelectorAll('.scene-item').length === 1);
  assert.equal(await page.locator('.scene-item').count(), 1, 'duplicate product clicks create only one scene');
  await page.fill('#productSearch', 'unsent changed query');
  await page.click('#loadMoreProducts');
  await page.waitForFunction(() => document.querySelectorAll('.product-item').length === 26);
  assert.equal(browserMetrics.productQueries.at(-1).q, '', 'load-more keeps the frozen product query/cursor scope');
  assert.equal(new Set(await page.locator('.product-item h3').allTextContents()).size, 26);
  await page.fill('#productSearch', 'browser toy 02');
  await page.click('#searchProducts');
  await page.waitForFunction(() => document.querySelectorAll('.product-item').length === 1);
  assert.equal(browserMetrics.productQueries.at(-1).q, 'browser toy 02');
  assert.deepEqual(await page.locator('.product-item h3').allTextContents(), ['Browser Toy 02']);
  await page.fill('#productSearch', 'no matching browser toy');
  await page.click('#searchProducts');
  await page.waitForFunction(() => document.querySelector('#productList .empty')?.textContent.includes('ไม่พบสินค้า'));
  await page.fill('#productSearch', 'trigger error');
  await page.click('#searchProducts');
  await page.waitForFunction(() => document.querySelector('#productStatus')?.textContent.includes('mocked product search error'));

  await page.fill('#showTitle', 'Browser Show A');
  await page.click('#saveShow');
  await page.waitForFunction(() => document.querySelector('#showRevision')?.textContent.includes('revision 1'));
  assert.equal(await page.locator('#editorTitle').textContent(), 'Browser Show A');

  browserControl.holdRefreshA = { seen: deferred(), release: deferred() };
  await page.click('#refreshShow');
  await browserControl.holdRefreshA.seen.promise;
  await page.fill('#showTitle', 'A saved after refresh');
  await page.click('#saveShow');
  await page.waitForFunction(() => document.querySelector('#showRevision')?.textContent.includes('revision 2'));
  browserControl.holdRefreshA.release.resolve();
  await page.waitForTimeout(75);
  assert.equal(await page.locator('#showTitle').inputValue(), 'A saved after refresh', 'late refresh cannot overwrite a newer save');
  browserControl.holdRefreshA = null;

  browserControl.staleNext = true;
  await page.fill('#showTitle', 'stale attempt');
  await page.click('#saveShow');
  await page.waitForFunction(() => document.querySelector('#showStatus')?.textContent.includes('revision ล่าสุด'));
  assert.match(await page.locator('#showStatus').textContent(), /แก้จากอีกหน้าต่าง/);

  await page.locator('.show-row').filter({ hasText: 'A saved after refresh' }).click();
  await page.waitForFunction(() => document.querySelector('#showTitle')?.value === 'A saved after refresh');
  browserControl.holdSaveA = { seen: deferred(), release: deferred() };
  await page.fill('#showTitle', 'Late A save response');
  await page.click('#saveShow');
  await browserControl.holdSaveA.seen.promise;
  await page.locator('.show-row').filter({ hasText: 'Browser Show B' }).click();
  await page.waitForFunction(() => document.querySelector('#showTitle')?.value === 'Browser Show B');
  browserControl.holdSaveA.release.resolve();
  await page.waitForFunction(() => !document.querySelector('#saveShow')?.disabled);
  assert.equal(await page.locator('#showTitle').inputValue(), 'Browser Show B', 'late A save cannot hydrate over editor B');
  browserControl.holdSaveA = null;

  await page.locator('.show-row').filter({ hasText: 'Late A save response' }).click();
  await page.waitForFunction(() => document.querySelector('#showTitle')?.value === 'Late A save response');
  await page.waitForFunction(() => !document.querySelector('#createVersion')?.disabled);
  browserControl.holdVersionA = { seen: deferred(), release: deferred() };
  await page.click('#createVersion');
  await browserControl.holdVersionA.seen.promise;
  await page.locator('.show-row').filter({ hasText: 'Browser Show B' }).click();
  await page.waitForFunction(() => document.querySelector('#showTitle')?.value === 'Browser Show B');
  assert.equal(await page.locator('#createVersion').isDisabled(), true, 'global version busy state survives switching to show B');
  await page.locator('#createVersion').evaluate(button => button.click());
  assert.equal(browserMetrics.versionPosts, 1, 'B cannot start a second version while A is pending');
  browserControl.holdVersionA.release.resolve();
  await page.waitForFunction(() => !document.querySelector('#createVersion')?.disabled);
  assert.equal(await page.locator('#showTitle').inputValue(), 'Browser Show B', 'late A version response cannot switch editor B');
  browserControl.holdVersionA = null;

  browserControl.driftNext = true;
  await page.click('#createVersion');
  await page.waitForFunction(() => document.querySelector('#versionStatus')?.textContent.includes('บันทึกร่างใหม่'));
  assert.match(await page.locator('#versionStatus').textContent(), /ข้อมูลหรือรูปหลักสินค้าเปลี่ยน/);

  await page.click('#createVersion');
  await page.waitForFunction(() => document.querySelectorAll('.version-row').length === 1);
  assert.match(await page.locator('.version-row').innerText(), /เวอร์ชัน 1/);
  const renderedDownloadHref = await page.locator('.version-row a[download]').getAttribute('href');
  assert.equal(renderedDownloadHref, `/api/admin/live-center/shows/${browserShowB}/versions/${browserVersionId}/package`);

  const browserParse = await page.evaluate(async url => {
    const response = await fetch(url, { credentials: 'same-origin' });
    const { parseVisionDLivePackage } = await import('/live-center-package.js');
    const parsed = await parseVisionDLivePackage(await response.arrayBuffer());
    return { title: parsed.manifest.show.title, scenes: parsed.manifest.scenes.length, assets: parsed.assets.size };
  }, renderedDownloadHref);
  assert.deepEqual(browserParse, { title: 'Weekend Toys Live Reviewed', scenes: 2, assets: 2 });

  const opener = await browser.newPage({ viewport: { width: 1200, height: 900 }, locale: 'th-TH' });
  opener.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource:.*(?:409 \(Conflict\)|503 \(Service Unavailable\))/.test(message.text())) handledBrowserHttpErrors.push(message.text());
    else browserErrors.push(message.text());
  });
  opener.on('pageerror', error => browserErrors.push(error.message));
  opener.on('request', request => { if (/facebook|tiktok|shopee/i.test(request.url())) platformRequests.push(request.url()); });
  await opener.addInitScript(() => {
    const original = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function patchedArrayBuffer() {
      if (this instanceof File && this.name === 'slow.visiondlive') {
        const file = this;
        return new Promise((resolve, reject) => {
          window.__releaseSlowLiveFile = () => original.call(file).then(resolve, reject);
        });
      }
      return original.call(this);
    };
  });
  await opener.goto(`${browserBase}/live-package-open.html`);
  await opener.waitForLoadState('networkidle');
  const openerRequestsBeforeFiles = browserMetrics.requests.length;
  const packageB = await repack(packageBytes, envelope => { envelope.manifest.show.title = 'Package B wins'; });
  await opener.locator('#packageFile').setInputFiles({ name: 'slow.visiondlive', mimeType: 'application/vnd.visiond.live', buffer: Buffer.from(packageBytes) });
  await opener.locator('#packageFile').setInputFiles({ name: 'fast.visiondlive', mimeType: 'application/vnd.visiond.live', buffer: Buffer.from(packageB) });
  await opener.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Package B wins');
  await opener.evaluate(() => window.__releaseSlowLiveFile());
  await opener.waitForTimeout(75);
  assert.equal(await opener.locator('#packageTitle').textContent(), 'Package B wins', 'late file A parse cannot overwrite newer file B');
  assert.deepEqual(browserMetrics.requests.slice(openerRequestsBeforeFiles), [], 'local opener performs zero HTTP/API requests after file selection');
  await opener.click('#nextScene');
  assert.equal(await opener.locator('#openPosition').textContent(), '2');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'th-TH' });
  mobile.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource:.*(?:409 \(Conflict\)|503 \(Service Unavailable\))/.test(message.text())) handledBrowserHttpErrors.push(message.text());
    else browserErrors.push(message.text());
  });
  mobile.on('pageerror', error => browserErrors.push(error.message));
  await mobile.goto(`${browserBase}/live-center.html`);
  await mobile.locator('#showForm').waitFor();
  assert.equal(await mobile.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, '390px Live Center has no horizontal overflow');
  assert.equal(await mobile.locator('#saveShow').isVisible(), true);
  assert.deepEqual(platformRequests, [], 'Live Center and local opener make no platform API requests');
  assert.equal(handledBrowserHttpErrors.length, 3, 'only the intentionally exercised search/stale/drift error responses reach the browser console');
  assert.deepEqual(browserErrors, [], 'desktop, opener and 390px browser runs have no console/page errors');
} finally {
  await browser.close();
  await new Promise(resolve => browserServer.close(resolve));
}

const securityEvidence = `${securityResponseTexts.join('\n')}\n${capturedErrorLogs.join('\n')}`;
for (const sentinelValue of Object.values(sentinels)) assert.equal(securityEvidence.includes(sentinelValue), false, 'responses and logs never expose planted secret values');
console.error = originalConsoleError;
console.log('PASS test-v020123-live-center');
