import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { representativePackage } from './test-v020129-live-player.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [
  process.env.PLAYWRIGHT_PACKAGE,
  'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  'playwright',
].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.134 browser gate');

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const fixtureImage = fs.readFileSync(path.join(publicRoot, 'assets/visiond-og-preview.jpg'));
const packageBytes = await representativePackage('Photo Avatar disconnected package', { avatarPreset: 'visiond-default' });
const viewerId = 134;
const showId = `live_${'a'.repeat(32)}`;
const product = {
  id: 7,
  meta_id: 'fixture-product-7',
  title: 'ตุ๊กตา Photo Avatar Test',
  price_minor: 5000,
  currency: 'THB',
  stock: 3,
  available: true,
  image_url: '/fixture-avatar.jpg',
  updated_at: '2026-09-25T01:00:00.000Z',
};
const scene = {
  position: 0,
  product_id: product.id,
  product: {
    id: product.id,
    meta_id: product.meta_id,
    title: product.title,
    price_minor: product.price_minor,
    currency: product.currency,
    stock_saved: product.stock,
    available: true,
  },
  script: 'บทออฟไลน์เดิมยังอยู่',
  cue: { duration_seconds: 20, transition: 'cut', note: '' },
};
const show = {
  id: showId,
  title: 'Photo Avatar Browser Show',
  description: '',
  avatar_preset: 'visiond-default',
  output_profile: 'landscape-1080p',
  scene_count: 1,
  revision: 3,
  created_by: viewerId,
  updated_by: viewerId,
  created_at: '2026-09-25T00:00:00.000Z',
  updated_at: '2026-09-25T01:00:00.000Z',
  scenes: [scene],
};
const portraitItem = {
  id: `portrait_${'b'.repeat(32)}`,
  status: 'active',
  width: 768,
  height: 1024,
  file_size: 45678,
  portrait_version: 1,
  image_url: `/api/admin/live-center/shows/${showId}/presenter/image`,
};
const metrics = {
  api: [],
  uploadKeys: [],
  deleteKeys: [],
  eventBodies: [],
  uploadCommits: 0,
  deleteCommits: 0,
  eventCommits: 0,
};
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.jpg', 'image/jpeg'],
]);
const json = (response, value, status = 200) => {
  const bytes = Buffer.from(JSON.stringify(value));
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': bytes.byteLength, 'cache-control': 'private, no-store' });
  response.end(bytes);
};
const body = async request => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
};
const parsedJson = async request => JSON.parse((await body(request)).toString('utf8') || '{}');
const health = {
  viewer_id: viewerId,
  status: 'not_connected',
  portrait_storage: true,
  server_pixel_reencode: true,
  sanitizer: { connected: true },
  avatar: { connected: false, provisioning_contract_verified: false, session_contract_verified: false },
  thai_voice: { connected: false, locale: 'th-TH' },
  facebook: { connected: false, comments_read_only: false, named_viewer_join: false, live_start: false },
  local_test: true,
  platform_live_start: false,
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith('/api/')) metrics.api.push(`${request.method} ${pathname}`);
    if (pathname === '/api/auth/me') return json(response, { user: { id: viewerId, role: 'boss', name: 'Browser Boss' } });
    if (pathname === '/api/admin/live-center/products' && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [product], pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === '/api/admin/live-center/shows' && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [{ ...show, scenes: undefined }], pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === `/api/admin/live-center/shows/${showId}` && request.method === 'GET') return json(response, { viewer_id: viewerId, item: show });
    if (pathname === `/api/admin/live-center/shows/${showId}/versions` && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [], pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === '/api/admin/live-center/integration-health' && request.method === 'GET') return json(response, health);
    if (/\/api\/admin\/live-center\/shows\/live_[a-f0-9]{32}\/presenter$/.test(pathname) && request.method === 'GET') {
      const openerRequest = url.searchParams.get('limit') === '1';
      return json(response, {
        viewer_id: viewerId,
        items: openerRequest ? [portraitItem] : [],
        binding: { active_id: openerRequest ? portraitItem.id : null, revision: openerRequest ? 1 : 0 },
        pagination: { limit: Number(url.searchParams.get('limit') || 24), has_more: false, next_cursor: null },
      });
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/facebook-connector` && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, status: 'not_connected', label: 'ยังไม่ได้เชื่อมต่อ', capabilities: health.facebook, platform_live_start: false });
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/presenter` && request.method === 'POST') {
      metrics.uploadKeys.push(String(request.headers['idempotency-key'] || ''));
      await body(request);
      if (metrics.uploadCommits++ === 0) return;
      return json(response, { viewer_id: viewerId, ok: true, replayed: true, item: portraitItem, binding_revision: 1, cleanup_pending: false }, 200);
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/presenter` && request.method === 'DELETE') {
      metrics.deleteKeys.push(String(request.headers['idempotency-key'] || ''));
      await parsedJson(request);
      if (metrics.deleteCommits++ === 0) return json(response, { error: 'บันทึกลบแล้วแต่ response สูญหาย', code: 'TEST_AMBIGUOUS_DELETE' }, 503);
      return json(response, { viewer_id: viewerId, ok: true, replayed: true, binding_revision: 2, cleanup_pending: false });
    }
    if (pathname === portraitItem.image_url && request.method === 'GET') {
      response.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': fixtureImage.byteLength, 'cache-control': 'private, no-store' });
      return response.end(fixtureImage);
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/audience/local-session` && request.method === 'POST') {
      await parsedJson(request);
      return json(response, { viewer_id: viewerId, ok: true, session: { id: `session_${'c'.repeat(32)}`, source: 'local_test', source_label: 'LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม', status: 'active', expires_at: '2026-09-25T03:00:00.000Z' } }, 201);
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/audience/local-session` && request.method === 'DELETE') {
      await parsedJson(request);
      return json(response, { viewer_id: viewerId, ok: true, cleanup_pending: false });
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/audience/local-events` && request.method === 'POST') {
      const value = await parsedJson(request);
      metrics.eventBodies.push(value);
      if (metrics.eventCommits++ === 0) return json(response, { error: 'บันทึก event แล้วแต่ response สูญหาย', code: 'TEST_AMBIGUOUS_EVENT' }, 503);
      return json(response, { viewer_id: viewerId, accepted: true, replayed: true, item: { source_label: 'LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม' } });
    }
    if (pathname === '/fixture-avatar.jpg') {
      response.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': fixtureImage.byteLength, 'cache-control': 'no-store' });
      return response.end(fixtureImage);
    }
    const relative = pathname === '/' ? 'live-center.html' : pathname.replace(/^\/+/, '');
    if (!relative || relative.split('/').includes('..')) return response.writeHead(400).end();
    const file = path.join(publicRoot, ...relative.split('/'));
    if (!file.startsWith(publicRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end('not found');
    let bytes = fs.readFileSync(file);
    if (relative === 'live-center.js') bytes = Buffer.from(bytes.toString('utf8').replace('LIVE_FOUNDATION_REQUEST_TIMEOUT_MS = 15_000', 'LIVE_FOUNDATION_REQUEST_TIMEOUT_MS = 120'));
    response.writeHead(200, { 'content-type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream', 'content-length': bytes.byteLength, 'cache-control': 'no-store' });
    response.end(bytes);
  } catch (error) {
    json(response, { error: String(error?.message || error) }, 500);
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const unexpected = [];
try {
  const context = await browser.newContext({ locale: 'th-TH' });
  const editor = await context.newPage();
  editor.on('pageerror', error => unexpected.push(error.message));
  editor.on('console', message => {
    if (message.type() === 'error' && !/ERR_EMPTY_RESPONSE|Failed to load resource/.test(message.text())) unexpected.push(message.text());
  });
  editor.on('dialog', dialog => dialog.accept());
  await editor.setViewportSize({ width: 1440, height: 1000 });
  await editor.goto(`${base}/live-center.html`);
  await editor.locator('.show-row').filter({ hasText: show.title }).click();
  await editor.waitForFunction(() => document.querySelector('#integrationHealthBadge')?.textContent === 'ยังไม่ได้เชื่อมต่อ');
  assert.match(await editor.locator('#photoPresenterPanel').innerText(), /PRIVATE · CONSENT REQUIRED/);
  assert.match(await editor.locator('#audienceTestPanel').innerText(), /LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม/);
  assert.equal(await editor.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, 'desktop editor has no horizontal overflow');

  await editor.locator('#presenterPortrait').setInputFiles({ name: 'consented-person.jpg', mimeType: 'image/jpeg', buffer: fixtureImage });
  for (const id of ['presenterRightsConsent', 'presenterAnimationConsent', 'presenterAuthorizedAdult']) await editor.locator(`#${id}`).check();
  await editor.locator('#uploadPresenterPortrait').click();
  await editor.waitForFunction(() => document.querySelector('#portraitStatus')?.textContent.includes('ใช้เวลานานเกินไป'));
  await editor.locator('#uploadPresenterPortrait').click();
  await editor.waitForFunction(() => document.querySelector('#portraitStatus')?.textContent.includes('เลือกใช้รูปส่วนตัวแล้ว'));
  assert.equal(metrics.uploadKeys.length, 2);
  assert.ok(metrics.uploadKeys[0]);
  assert.equal(metrics.uploadKeys[1], metrics.uploadKeys[0], 'ambiguous upload retry reuses the same Idempotency-Key');

  await editor.locator('#deletePresenterPortrait').click();
  await editor.waitForFunction(() => document.querySelector('#portraitStatus')?.textContent.includes('response สูญหาย'));
  await editor.locator('#deletePresenterPortrait').click();
  await editor.waitForFunction(() => document.querySelector('#portraitStatus')?.textContent.includes('ลบรูปส่วนตัวแล้ว'));
  assert.equal(metrics.deleteKeys.length, 2);
  assert.ok(metrics.deleteKeys[0]);
  assert.equal(metrics.deleteKeys[1], metrics.deleteKeys[0], 'ambiguous delete retry reuses the same Idempotency-Key');

  await editor.locator('#startAudienceTest').click();
  await editor.waitForFunction(() => document.querySelector('#audienceStatus')?.textContent.includes('session พร้อม'));
  await editor.locator('#audienceEventKind').selectOption('comment');
  await editor.locator('#audienceQuestion').fill('ราคาเท่าไหร่');
  await editor.locator('#sendAudienceTest').click();
  await editor.waitForFunction(() => document.querySelector('#audienceStatus')?.textContent.includes('response สูญหาย'));
  await editor.locator('#sendAudienceTest').click();
  await editor.waitForFunction(() => document.querySelector('#audienceStatus')?.textContent.includes('เพิ่มเหตุการณ์เข้าคิวแล้ว'));
  assert.equal(metrics.eventBodies.length, 2);
  assert.equal(metrics.eventBodies[1].event_id, metrics.eventBodies[0].event_id, 'ambiguous local-event retry reuses the same event_id');

  await editor.setViewportSize({ width: 390, height: 844 });
  assert.equal(await editor.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, '390px editor has no horizontal overflow');

  const opener = await context.newPage();
  opener.on('pageerror', error => unexpected.push(error.message));
  opener.on('console', message => { if (message.type() === 'error') unexpected.push(message.text()); });
  await opener.goto(`${base}/live-package-open.html`);
  const apiBeforePackage = metrics.api.length;
  await opener.locator('#packageFile').setInputFiles({ name: 'photo-avatar.visiondlive', mimeType: 'application/vnd.visiond.live', buffer: Buffer.from(packageBytes) });
  await opener.waitForFunction(() => !document.querySelector('#packageWorkspace')?.hidden);
  assert.equal(metrics.api.length, apiBeforePackage, 'offline package open performs zero API requests');
  assert.equal(await opener.locator('#photoAvatarPreviewVideo').isHidden(), true);
  assert.equal(await opener.locator('#photoAvatarPreviewFallback').getByText('ยังไม่ได้เชื่อมต่อ').count(), 1);
  await opener.locator('#activatePhotoAvatar').click();
  await opener.waitForFunction(() => document.querySelector('#photoAvatarPanel')?.dataset.photoState === 'error');
  assert.equal(await opener.locator('#startAiHost').isDisabled(), true, 'Photo Avatar mode visibly excludes browser-speech AI mode');
  assert.equal(await opener.locator('#aiPresenterPreview').isHidden(), true, 'photo mode never substitutes the legacy SVG presenter');
  assert.equal(await opener.locator('#obsPresenter').isHidden(), true, 'clean OBS never substitutes the legacy SVG presenter');
  assert.equal(await opener.locator('#obsPhotoAvatarSlot').evaluate(node => node.hidden), false);
  assert.match(await opener.locator('#obsPhotoAvatarFallback').innerText(), /ยังไม่ได้เชื่อมต่อ/);
  await opener.locator('#useLegacyPresenter').click();
  assert.equal(await opener.locator('#startAiHost').isDisabled(), false, 'returning to legacy mode restores AI controls');
  await opener.setViewportSize({ width: 390, height: 844 });
  assert.equal(await opener.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, '390px opener has no horizontal overflow');

  const external = metrics.api.filter(entry => /facebook\.com|tiktok\.com|graph\./i.test(entry));
  assert.deepEqual(external, [], 'browser fixture makes no platform request');
  assert.deepEqual(unexpected, [], 'desktop/390 editor and opener have no unexpected console/page errors');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.134 real-Chrome consent UI, stable retry identity, offline opener, disconnected video OBS and 390px checks passed');
