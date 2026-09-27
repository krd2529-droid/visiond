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
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.138 Local Test removal gate');

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const viewerId = 138;
const showId = `live_${'e'.repeat(32)}`;
const versionId = `livever_${'f'.repeat(32)}`;
const now = '2026-09-27T14:00:00.000Z';
const product = {
  id: 138,
  meta_id: 'LOCAL-TEST-REMOVAL-138',
  title: 'สินค้าแพ็กเกจหลังถอดระบบจำลอง',
  price_minor: 13800,
  currency: 'THB',
  stock: 8,
  available: true,
  image_url: '/favicon.svg',
};
const show = {
  id: showId,
  title: 'รายการ 1–7 หลังถอดระบบจำลอง',
  description: '',
  avatar_preset: 'visiond-default',
  output_profile: 'landscape-1080p',
  scene_count: 1,
  revision: 1,
  owner_id: viewerId,
  created_by: viewerId,
  updated_by: viewerId,
  created_at: now,
  updated_at: now,
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
    script: 'บททดสอบหลังถอด Local Test',
    cue: { label: '', duration_seconds: 60, transition: 'cut' },
  }],
};
const summary = (({ scenes, ...value }) => value)(show);
const version = {
  id: versionId,
  version_number: 1,
  package_size: 4096,
  package_sha256: 'b'.repeat(64),
  download_url: `/api/admin/live-center/shows/${showId}/versions/${versionId}/package`,
  created_at: now,
};
const pagination = { limit: 24, has_more: false, next_cursor: null };
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
const audienceRequests = [];
const unexpectedApi = [];
const errors = [];
let detailReads = 0;
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
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

const server = http.createServer((request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const pathname = decodeURIComponent(url.pathname);
    if (/\/audience\/(?:local-session|local-events|queue)/.test(pathname)) {
      audienceRequests.push(`${request.method} ${pathname}`);
      return json(response, { error: 'retired audience request' }, 500);
    }
    if (pathname === '/api/auth/me') return json(response, { user: { id: viewerId, role: 'boss', name: 'Removal Browser Boss' } });
    if (pathname === '/api/admin/live-center/products' && request.method === 'GET') return json(response, { viewer_id: viewerId, items: [product], pagination });
    if (pathname === '/api/admin/live-center/shows' && request.method === 'GET') return json(response, { viewer_id: viewerId, items: [summary], pagination });
    if (pathname === `/api/admin/live-center/shows/${showId}` && request.method === 'GET') {
      detailReads += 1;
      return json(response, { viewer_id: viewerId, item: show });
    }
    if (pathname === `/api/admin/live-center/shows/${showId}/versions` && request.method === 'GET') return json(response, { viewer_id: viewerId, items: [version], pagination });
    if (pathname === '/api/admin/live-center/integration-health' && request.method === 'GET') return json(response, health);
    if (pathname === `/api/admin/live-center/shows/${showId}/presenter` && request.method === 'GET') return json(response, { viewer_id: viewerId, items: [], binding: { active_id: null, revision: 0 }, pagination });
    if (pathname === `/api/admin/live-center/shows/${showId}/facebook-connector` && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, status: 'not_connected', capabilities: health.facebook, platform_live_start: false });
    }
    if (pathname.startsWith('/api/')) {
      unexpectedApi.push(`${request.method} ${pathname}${url.search}`);
      return json(response, { error: 'unexpected API request' }, 500);
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

const snapshot = page => page.evaluate(() => {
  const steps = [...document.querySelectorAll('.live-workspace > [data-workflow-step]')];
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  const opener = document.querySelector('a[href="/live-package-open.html"]');
  const download = document.querySelector('#versionList a[download]');
  const retiredIds = [
    'audienceTestPanel', 'audienceTestTitle', 'audienceQueueCount', 'audienceEventKind',
    'audienceViewerLabel', 'audienceProduct', 'audienceQuestion', 'startAudienceTest',
    'sendAudienceTest', 'claimAudienceTest', 'stopAudienceTest', 'audienceTestAnswer', 'audienceStatus',
  ];
  return {
    steps: steps.map(node => Number(node.dataset.workflowStep)),
    labels: steps.map(node => node.querySelector('.section-head small')?.textContent?.trim() || ''),
    tops: steps.map(node => node.getBoundingClientRect().top + scrollY),
    cssOrders: steps.map(node => getComputedStyle(node).order),
    duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index),
    retiredIds: retiredIds.filter(id => document.getElementById(id)),
    retiredText: /LOCAL TEST|Local Test|ทดสอบคำทักทายและ Q&A/i.test(document.body.innerText),
    packageStep: document.querySelector('#createVersion')?.closest('[data-workflow-step]')?.dataset.workflowStep,
    openerStep: opener?.closest('[data-workflow-step]')?.dataset.workflowStep,
    openerCount: document.querySelectorAll('a[href="/live-package-open.html"]').length,
    downloadBeforeOpener: Boolean(download && opener && (download.compareDocumentPosition(opener) & Node.DOCUMENT_POSITION_FOLLOWING)),
    saveAssociation: {
      type: document.querySelector('#saveShow')?.type,
      form: document.querySelector('#saveShow')?.form?.id,
      step: document.querySelector('#saveShow')?.closest('[data-workflow-step]')?.dataset.workflowStep,
    },
    sidebarIsStep: document.querySelector('.live-sidebar')?.hasAttribute('data-workflow-step'),
    noOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1,
  };
});
const assertSnapshot = value => {
  assert.deepEqual(value.steps, [1, 2, 3, 4, 5, 6, 7]);
  value.labels.forEach((label, index) => assert.match(label, new RegExp(`ขั้นตอนที่ ${index + 1}`)));
  assert.equal(value.tops.every((top, index) => index === 0 || top > value.tops[index - 1]), true, `visual steps descend: ${value.tops}`);
  assert.deepEqual(value.cssOrders, Array(7).fill('0'));
  assert.deepEqual(value.duplicateIds, []);
  assert.deepEqual(value.retiredIds, []);
  assert.equal(value.retiredText, false);
  assert.equal(value.packageStep, '6');
  assert.equal(value.openerStep, '7');
  assert.equal(value.openerCount, 1);
  assert.equal(value.downloadBeforeOpener, true);
  assert.deepEqual(value.saveAssociation, { type: 'submit', form: 'showForm', step: '4' });
  assert.equal(value.sidebarIsStep, false);
  assert.equal(value.noOverflow, true);
};
const tabSequence = async page => {
  await page.locator('#presenterPortrait').focus();
  const values = [];
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    values.push(await page.evaluate(() => document.activeElement?.id || document.activeElement?.getAttribute('href') || ''));
  }
  return values;
};

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'th-TH', serviceWorkers: 'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`pageerror ${viewport.width}: ${error.message}`));
    page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()} ${viewport.width}: ${message.text()}`); });
    await page.goto(`${base}/live-center.html`, { waitUntil: 'networkidle' });
    const openShowButton = page.getByRole('button', { name: `เปิดรายการ ${show.title}`, exact: true });
    try {
      await openShowButton.waitFor({ timeout: 5_000 });
    } catch (error) {
      throw new Error(`saved-show button missing at ${viewport.width}px; body=${JSON.stringify((await page.locator('body').innerText()).slice(0, 1200))}; errors=${JSON.stringify(errors)}; unexpected=${JSON.stringify(unexpectedApi)}`, { cause: error });
    }
    await openShowButton.click();
    await page.getByRole('link', { name: 'ดาวน์โหลด', exact: true }).waitFor();
    await page.waitForFunction(() => !document.querySelector('#presenterPortrait')?.disabled);
    assertSnapshot(await snapshot(page));

    const tabs = await tabSequence(page);
    assert.ok(tabs.indexOf('createVersion') >= 0, `${viewport.width}px tabs reach step 6: ${tabs}`);
    assert.ok(tabs.indexOf(version.download_url) > tabs.indexOf('createVersion'), `${viewport.width}px download follows create: ${tabs}`);
    assert.ok(tabs.indexOf('/live-package-open.html') > tabs.indexOf(version.download_url), `${viewport.width}px opener follows download: ${tabs}`);

    const readsBeforeRefresh = detailReads;
    await page.locator('#refreshShow').click();
    const refreshDeadline = Date.now() + 3_000;
    while (detailReads <= readsBeforeRefresh && Date.now() < refreshDeadline) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(detailReads > readsBeforeRefresh, true, 'refresh performs the expected show read');
    await page.locator('#newShow').click();
    assert.equal(await page.locator('#editorTitle').textContent(), 'สร้างรายการไลฟ์');
    await page.getByRole('button', { name: `เปิดรายการ ${show.title}`, exact: true }).click();
    await page.waitForFunction(title => document.querySelector('#editorTitle')?.textContent === title, show.title);
    await page.close();
    await new Promise(resolve => setTimeout(resolve, 50));
    await context.close();
  }
  assert.deepEqual(audienceRequests, [], 'open/refresh/show-switch/unload issue zero retired audience requests');
  assert.deepEqual(unexpectedApi, []);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.138 Live Center Local Test removal desktop/390 DOM, visual, Tab and zero-audience-request checks passed');
