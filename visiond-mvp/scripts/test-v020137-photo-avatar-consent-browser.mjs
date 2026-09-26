import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [
  process.env.PLAYWRIGHT_PACKAGE,
  'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright',
  'playwright',
].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.137 Photo Avatar consent gate');

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const fixtureImage = fs.readFileSync(path.join(publicRoot, 'assets/visiond-og-preview.jpg'));
const sourceMaxBytes = 12 * 1024 * 1024;
const viewerId = 137;
const showId = `live_${'d'.repeat(32)}`;
const product = {
  id: 137,
  meta_id: 'CONSENT-UI-137',
  title: 'สินค้า Photo Avatar consent test',
  price_minor: 13700,
  currency: 'THB',
  stock: 7,
  available: true,
  image_url: '/favicon.svg',
};
const show = {
  id: showId,
  title: 'Photo Avatar Consent UI Show',
  description: '',
  avatar_preset: 'visiond-default',
  output_profile: 'landscape-1080p',
  scene_count: 1,
  revision: 1,
  owner_id: viewerId,
  created_by: viewerId,
  updated_by: viewerId,
  created_at: '2026-09-27T03:00:00.000Z',
  updated_at: '2026-09-27T03:00:00.000Z',
  scenes: [{
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
    script: 'บททดสอบ consent action',
    cue: { label: '', duration_seconds: 60, transition: 'cut' },
  }],
};
const summary = (({ scenes, ...value }) => value)(show);
const pagination = { limit: 24, has_more: false, next_cursor: null };
const health = {
  viewer_id: viewerId,
  status: 'not_connected',
  portrait_storage: true,
  server_pixel_reencode: true,
  local_test: true,
  avatar: { connected: false, provisioning_contract_verified: false, session_contract_verified: false },
  thai_voice: { connected: false, locale: 'th-TH' },
  facebook: { connected: false, comments_read_only: false, named_viewer_join: false, live_start: false },
  platform_live_start: false,
};
const exactNotice = 'เมื่อกด “ยืนยันสิทธิ์และอัปโหลด” คุณรับรองว่ามีสิทธิ์ใช้รูป บุคคลในรูปเป็นผู้ใหญ่ที่อนุญาตให้ใช้ภาพ อนุญาตให้นำภาพไปสร้างภาพเคลื่อนไหว และไม่ใช่การเลียนแบบบุคคลสาธารณะ';
const uploads = [];
const mutations = [];
const unexpectedApi = [];
let uploadGate = null;
const deferred = () => {
  let resolve;
  const promise = new Promise(next => { resolve = next; });
  return { promise, resolve };
};
const waitFor = async (predicate, message, timeoutMs = 5_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(predicate(), true, message);
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
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': bytes.byteLength,
    'cache-control': 'private, no-store',
  });
  response.end(bytes);
};
const readBody = async request => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks);
};
const parseMultipart = (bytes, contentType) => {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(String(contentType || ''))?.slice(1).find(Boolean)?.trim();
  assert.ok(boundary, 'upload uses multipart/form-data with a boundary');
  const text = bytes.toString('latin1');
  const names = [...text.matchAll(/content-disposition:\s*form-data;\s*name="([^"]+)"/gi)].map(match => match[1]);
  const scalar = name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`name="${escaped}"\\r\\n\\r\\n([^\\r\\n]*)`, 'i').exec(text)?.[1] ?? null;
  };
  return { names, scalar };
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) mutations.push(`${request.method} ${pathname}`);
    if (pathname === '/api/auth/me') return json(response, { user: { id: viewerId, role: 'boss', name: 'Consent UI Browser Boss' } });
    if (pathname === '/api/admin/live-center/products' && request.method === 'GET') return json(response, { viewer_id: viewerId, items: [product], pagination });
    if (pathname === '/api/admin/live-center/shows' && request.method === 'GET') return json(response, { viewer_id: viewerId, items: [summary], pagination });
    if (pathname === `/api/admin/live-center/shows/${showId}` && request.method === 'GET') return json(response, { viewer_id: viewerId, item: show });
    if (pathname === `/api/admin/live-center/shows/${showId}/versions` && request.method === 'GET') return json(response, { viewer_id: viewerId, items: [], pagination });
    if (pathname === '/api/admin/live-center/integration-health' && request.method === 'GET') return json(response, health);
    if (pathname === `/api/admin/live-center/shows/${showId}/presenter` && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [], binding: { active_id: null, revision: 0 }, pagination });
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/facebook-connector` && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, status: 'not_connected', capabilities: health.facebook, platform_live_start: false });
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/presenter` && request.method === 'POST') {
      const bytes = await readBody(request);
      const parsed = parseMultipart(bytes, request.headers['content-type']);
      uploads.push({
        idempotencyKey: String(request.headers['idempotency-key'] || ''),
        names: parsed.names,
        fields: Object.fromEntries(['rights_consent', 'animation_consent', 'identity_scope', 'consent_policy', 'expected_binding_revision'].map(name => [name, parsed.scalar(name)])),
      });
      await uploadGate?.promise;
      return json(response, {
        viewer_id: viewerId,
        ok: true,
        replayed: false,
        item: { id: `portrait_${'e'.repeat(32)}`, status: 'active', width: 1024, height: 683, file_size: 2048, portrait_version: 1 },
        binding_revision: 1,
        cleanup_pending: false,
      }, 201);
    }
    if (pathname.startsWith('/api/')) {
      unexpectedApi.push(`${request.method} ${pathname}${url.search}`);
      return json(response, { error: 'unexpected test API request' }, 500);
    }
    const relative = pathname === '/' ? 'live-center.html' : pathname.replace(/^\/+/, '');
    if (!relative || relative.split('/').includes('..')) return response.writeHead(400).end();
    const file = path.join(publicRoot, ...relative.split('/'));
    if (!file.startsWith(publicRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return response.writeHead(404).end('not found');
    const bytes = fs.readFileSync(file);
    response.writeHead(200, {
      'content-type': mime.get(path.extname(file).toLowerCase()) || 'application/octet-stream',
      'content-length': bytes.byteLength,
      'cache-control': 'no-store',
    });
    response.end(bytes);
  } catch (error) {
    json(response, { error: String(error?.message || error) }, 500);
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const errors = [];
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'th-TH', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`pageerror ${viewport.width}: ${error.message}`));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()} ${viewport.width}: ${message.text()}`);
    });
    try {
      await page.goto(`${base}/live-center.html`, { waitUntil: 'networkidle' });
      const panel = page.locator('#photoPresenterPanel');
      const input = page.locator('#presenterPortrait');
      const upload = page.getByRole('button', { name: 'ยืนยันสิทธิ์และอัปโหลด', exact: true });
      assert.equal(await panel.locator('input[type="checkbox"]').count(), 0);
      for (const removedId of ['presenterRightsConsent', 'presenterAnimationConsent', 'presenterAuthorizedAdult']) assert.equal(await page.locator(`#${removedId}`).count(), 0);
      assert.equal(await page.locator('#presenterConsentNotice').innerText(), exactNotice);
      assert.equal(await upload.getAttribute('aria-describedby'), 'presenterConsentNotice');
      assert.equal(await upload.getAttribute('type'), 'button');
      assert.equal(await input.isDisabled(), true, 'an unsaved editor cannot select a portrait');
      assert.equal(await upload.isDisabled(), true, 'an unsaved editor cannot upload');

      await page.getByRole('button', { name: `เปิดรายการ ${show.title}`, exact: true }).click();
      await input.waitFor({ state: 'visible' });
      await page.waitForFunction(() => !document.querySelector('#presenterPortrait')?.disabled);
      assert.equal(await upload.isDisabled(), true, 'saved show still requires a selected file');

      await input.setInputFiles({ name: 'not-an-image.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
      assert.equal(await upload.isDisabled(), true, 'unsupported MIME stays disabled');
      await input.setInputFiles({ name: 'too-large.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(sourceMaxBytes + 1, 1) });
      assert.equal(await upload.isDisabled(), true, 'oversized source stays disabled');

      const mutationsBeforeMagicFailure = mutations.length;
      await input.setInputFiles({ name: 'bad-magic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not really jpeg') });
      assert.equal(await upload.isEnabled(), true, 'supported MIME/size reaches the existing deep client validator');
      await upload.click();
      await page.getByText('ไฟล์ต้องเป็น JPG หรือ PNG ที่เปิดได้จริง', { exact: true }).waitFor();
      assert.equal(mutations.length, mutationsBeforeMagicFailure, 'magic/decode rejection sends zero mutation requests');

      const uploadsBeforeSelection = uploads.length;
      const mutationsBeforeSelection = mutations.length;
      await input.setInputFiles({ name: 'authorized-adult.jpg', mimeType: 'image/jpeg', buffer: fixtureImage });
      assert.equal(await upload.isEnabled(), true, 'saved show plus valid selected file enables the explicit action');
      assert.equal(uploads.length, uploadsBeforeSelection, 'file selection sends no upload');
      assert.equal(mutations.length, mutationsBeforeSelection, 'file selection sends no mutation');
      await input.focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'uploadPresenterPortrait', 'keyboard moves directly from file input to explicit action with no checkbox stops');

      uploadGate = deferred();
      await upload.click();
      await waitFor(() => uploads.length > uploadsBeforeSelection, 'explicit upload reaches the intercepted server once');
      assert.equal(await upload.isDisabled(), true, 'upload action is disabled while busy');
      uploadGate.resolve();
      await page.getByText('อัปโหลด ทำความสะอาด และเลือกใช้รูปส่วนตัวแล้ว', { exact: true }).waitFor();
      uploadGate = null;

      const submitted = uploads.at(-1);
      assert.ok(submitted.idempotencyKey);
      assert.deepEqual(submitted.fields, {
        rights_consent: 'accepted',
        animation_consent: 'accepted',
        identity_scope: 'authorized_adult',
        consent_policy: 'visiond-live-portrait-consent-v1',
        expected_binding_revision: '0',
      });
      assert.deepEqual([...submitted.names].sort(), ['animation_consent', 'consent_policy', 'expected_binding_revision', 'identity_scope', 'portrait', 'rights_consent']);
      assert.equal(mutations.slice(mutationsBeforeSelection).filter(value => value === `POST /api/admin/live-center/shows/${showId}/presenter`).length, 1, 'one explicit click sends exactly one upload');
      assert.equal(mutations.slice(mutationsBeforeSelection).some(value => value === 'POST /api/admin/live-center/shows'), false, 'upload action never submits the show form');
      assert.equal(await input.inputValue(), '', 'success clears the selected file');
      assert.equal(await upload.isDisabled(), true, 'success disables the action until another valid file is selected');
      assert.equal(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, `${viewport.width}px has no horizontal overflow`);
    } finally {
      uploadGate?.resolve();
      uploadGate = null;
      await context.close();
    }
  }
  assert.deepEqual(unexpectedApi, []);
  assert.deepEqual(errors, []);
  assert.equal(uploads.length, 2, 'desktop and 390px each issue exactly one explicit upload');
} finally {
  uploadGate?.resolve();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.137 Photo Avatar zero-checkbox explicit consent action desktop/390 payload and state checks passed');
