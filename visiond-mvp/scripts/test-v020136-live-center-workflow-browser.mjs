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
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.136 workflow-order gate');

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const viewerId = 136;
const showId = 'live_dddddddddddddddddddddddddddddddd';
const now = '2026-09-27T02:00:00.000Z';
const product = {
  id: 301,
  meta_id: 'WORKFLOW-TOY-301',
  title: 'Workflow Browser Toy',
  price_minor: 9900,
  currency: 'THB',
  stock: 5,
  image_url: '/favicon.svg',
};
const version = {
  id: 'livever_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  version_number: 1,
  package_size: 4096,
  package_sha256: 'a'.repeat(64),
  download_url: `/api/admin/live-center/shows/${showId}/versions/livever_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee/package`,
  created_at: now,
};
const deferred = () => {
  let resolve;
  const promise = new Promise(next => { resolve = next; });
  return { promise, resolve };
};
const sceneFrom = input => ({
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
  script: input.script || '',
  cue: input.cue || { label: '', duration_seconds: 60, transition: 'cut' },
});

let savedShow = null;
let saveMode = 'fail';
let saveWrites = 0;
let refreshGate = null;
const requestBodies = [];
const audienceRequests = [];
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
const readJson = async request => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};
const summary = show => ({
  id: show.id,
  title: show.title,
  description: show.description,
  avatar_preset: show.avatar_preset,
  output_profile: show.output_profile,
  scene_count: show.scene_count,
  revision: show.revision,
  owner_id: show.owner_id,
  created_by: show.owner_id,
  updated_by: show.owner_id,
  created_at: show.created_at,
  updated_at: show.updated_at,
});
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
    if (/\/audience\/(?:local-session|local-events|queue)/.test(pathname)) {
      audienceRequests.push(`${request.method} ${pathname}`);
      return json(response, { error: 'retired audience request' }, 500);
    }
    if (pathname === '/api/auth/me') return json(response, { user: { id: viewerId, role: 'boss', name: 'Workflow Browser Boss' } });
    if (pathname === '/api/admin/live-center/products' && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [product], pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === '/api/admin/live-center/shows' && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: savedShow ? [summary(savedShow)] : [], pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === '/api/admin/live-center/shows' && request.method === 'POST') {
      saveWrites += 1;
      const body = await readJson(request);
      requestBodies.push(body);
      if (saveMode === 'fail') return json(response, { error: 'จำลองการบันทึกล้มเหลว', code: 'TEST_SAVE_FAILED' }, 503);
      savedShow = {
        id: showId,
        title: body.title,
        description: body.description || '',
        avatar_preset: body.avatar_preset,
        output_profile: body.output_profile,
        scene_count: body.scenes.length,
        revision: 1,
        owner_id: viewerId,
        created_at: now,
        updated_at: now,
        scenes: body.scenes.map(sceneFrom),
      };
      return json(response, { viewer_id: viewerId, item: savedShow }, 201);
    }
    const detailMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})$/);
    if (detailMatch && request.method === 'GET') {
      if (!savedShow || detailMatch[1] !== savedShow.id) return json(response, { error: 'ไม่พบรายการไลฟ์' }, 404);
      if (refreshGate) {
        refreshGate.entered.resolve();
        await refreshGate.release.promise;
      }
      return json(response, { viewer_id: viewerId, item: structuredClone(savedShow) });
    }
    const versionsMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})\/versions$/);
    if (versionsMatch && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: savedShow ? [version] : [], pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === '/api/admin/live-center/integration-health' && request.method === 'GET') return json(response, health);
    const presenterMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})\/presenter$/);
    if (presenterMatch && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [], binding: { active_id: null, revision: 0 }, pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    const facebookMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})\/facebook-connector$/);
    if (facebookMatch && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, status: 'not_connected', label: 'ยังไม่ได้เชื่อมต่อ', capabilities: health.facebook, platform_live_start: false });
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
const expectedHttpErrors = [];

const workflowSnapshot = page => page.evaluate(() => {
  const steps = [...document.querySelectorAll('.live-workspace > [data-workflow-step]')];
  const ids = [...document.querySelectorAll('[id]')].map(node => node.id);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  const tops = steps.map(node => node.getBoundingClientRect().top + scrollY);
  const opener = document.querySelector('a[href="/live-package-open.html"]');
  const download = document.querySelector('#versionList a[download]');
  return {
    stepValues: steps.map(node => Number(node.dataset.workflowStep)),
    stepLabels: steps.map(node => node.querySelector('.section-head small')?.textContent?.trim() || ''),
    tops,
    duplicateIds,
    sidebarBeforeWorkspace: Boolean(document.querySelector('.live-sidebar')?.compareDocumentPosition(document.querySelector('.live-workspace')) & Node.DOCUMENT_POSITION_FOLLOWING),
    sidebarIsStep: document.querySelector('.live-sidebar')?.hasAttribute('data-workflow-step'),
    headerOpeners: document.querySelectorAll('.live-toolbar a[href="/live-package-open.html"]').length,
    totalOpeners: document.querySelectorAll('a[href="/live-package-open.html"]').length,
    openerInStep7: opener?.closest('[data-workflow-step]')?.dataset.workflowStep,
    retiredAudienceIds: ['audienceTestPanel', 'audienceEventKind', 'audienceViewerLabel', 'audienceProduct', 'audienceQuestion', 'startAudienceTest', 'sendAudienceTest', 'claimAudienceTest', 'stopAudienceTest', 'audienceTestAnswer', 'audienceStatus'].filter(id => document.getElementById(id)),
    downloadBeforeOpener: download ? Boolean(download.compareDocumentPosition(opener) & Node.DOCUMENT_POSITION_FOLLOWING) : null,
    save: {
      type: document.querySelector('#saveShow')?.type,
      form: document.querySelector('#saveShow')?.form?.id,
      nestedInForm: Boolean(document.querySelector('#saveShow')?.closest('form')),
      step: document.querySelector('#saveShow')?.closest('[data-workflow-step]')?.dataset.workflowStep,
    },
    noOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1,
  };
});
const assertWorkflow = (snapshot, { saved }) => {
  assert.deepEqual(snapshot.stepValues, [1, 2, 3, 4, 5, 6, 7]);
  snapshot.stepLabels.forEach((label, index) => assert.match(label, new RegExp(`ขั้นตอนที่ ${index + 1}`)));
  assert.equal(snapshot.tops.every((top, index) => index === 0 || top > snapshot.tops[index - 1]), true, `workflow cards must descend visually: ${snapshot.tops}`);
  assert.deepEqual(snapshot.duplicateIds, []);
  assert.equal(snapshot.sidebarBeforeWorkspace, true);
  assert.equal(snapshot.sidebarIsStep, false);
  assert.equal(snapshot.headerOpeners, 0);
  assert.equal(snapshot.totalOpeners, 1);
  assert.equal(snapshot.openerInStep7, '7');
  assert.deepEqual(snapshot.retiredAudienceIds, []);
  assert.deepEqual(snapshot.save, { type: 'submit', form: 'showForm', nestedInForm: false, step: '4' });
  assert.equal(snapshot.noOverflow, true);
  assert.equal(snapshot.downloadBeforeOpener, saved ? true : null);
};
const tabFrom = async (page, selector, count) => {
  await page.locator(selector).focus();
  const values = [];
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab');
    values.push(await page.evaluate(() => {
      const active = document.activeElement;
      return active?.id || active?.getAttribute('href') || active?.textContent?.trim() || active?.tagName || '';
    }));
  }
  return values;
};

try {
  const context = await browser.newContext({ locale: 'th-TH', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of 503/.test(message.text())) expectedHttpErrors.push(message.text());
    else errors.push(message.text());
  });
  await page.goto(`${base}/live-center.html`);
  await page.getByText(product.title, { exact: true }).first().waitFor();

  assertWorkflow(await workflowSnapshot(page), { saved: false });
  const newTabs = await tabFrom(page, '#showTitle', 8);
  assert.ok(newTabs.indexOf('productSearch') >= 0, `new-show keyboard path reaches products: ${newTabs}`);
  assert.ok(newTabs.indexOf('saveShow') > newTabs.indexOf('productSearch'), `new-show keyboard path reaches save after products: ${newTabs}`);

  await page.locator('.product-item').getByRole('button', { name: 'เพิ่มเข้าฉาก', exact: true }).click();
  await page.locator('#showTitle').fill('รายการลำดับขั้นตอน');
  await page.locator('#showTitle').press('Enter');
  await page.waitForFunction(() => document.querySelector('#showStatus')?.textContent.includes('จำลองการบันทึกล้มเหลว'));
  assert.equal(saveWrites, 1, 'Enter on a details input submits through the external associated button');
  assert.equal(await page.locator('.scene-item').count(), 1, 'failed save retains the edited scene');
  assert.equal(await page.locator('#editorTitle').textContent(), 'สร้างรายการไลฟ์', 'failed save retains the new editor');
  assert.equal(await page.locator('#createVersion').isDisabled(), true);

  saveMode = 'success';
  await page.locator('#saveShow').click();
  await page.waitForFunction(() => document.querySelector('#showStatus')?.textContent.includes('บันทึกร่างแล้ว'));
  await page.getByRole('link', { name: 'ดาวน์โหลด', exact: true }).waitFor();
  assert.equal(saveWrites, 2);
  assert.equal(requestBodies.every(body => body.scenes.length === 1), true);
  assert.equal(await page.locator('#refreshShow').isEnabled(), true);
  assert.equal(await page.locator('#presenterPortrait').isEnabled(), true);
  assert.equal(await page.locator('#audienceTestPanel').count(), 0);
  assert.equal(await page.locator('#createVersion').isEnabled(), true);
  assertWorkflow(await workflowSnapshot(page), { saved: true });

  const savedTabs = await tabFrom(page, '#saveShow', 16);
  const tabIndex = value => savedTabs.indexOf(value);
  assert.ok(tabIndex('refreshShow') >= 0 && tabIndex('presenterPortrait') > tabIndex('refreshShow'), `saved-show tabs enter optional Photo after save: ${savedTabs}`);
  assert.ok(tabIndex('createVersion') > tabIndex('presenterPortrait'), `saved-show tabs enter version creation directly after optional Photo: ${savedTabs}`);
  assert.ok(savedTabs.indexOf(version.download_url) > tabIndex('createVersion'), `download follows create version: ${savedTabs}`);
  assert.ok(savedTabs.indexOf('/live-package-open.html') > savedTabs.indexOf(version.download_url), `package opener follows version download: ${savedTabs}`);

  await page.setViewportSize({ width: 390, height: 844 });
  assertWorkflow(await workflowSnapshot(page), { saved: true });
  const mobileSavedTabs = await tabFrom(page, '#saveShow', 16);
  assert.ok(mobileSavedTabs.indexOf('createVersion') > mobileSavedTabs.indexOf('presenterPortrait'), `390px keyboard order remains linear: ${mobileSavedTabs}`);
  assert.ok(mobileSavedTabs.indexOf('/live-package-open.html') > mobileSavedTabs.indexOf(version.download_url), `390px opener remains after download: ${mobileSavedTabs}`);

  await page.locator('#showDescription').fill('แก้ไขหลังบันทึก');
  assert.equal(await page.locator('#createVersion').isDisabled(), true, 'editing a saved draft disables version creation until re-save');
  refreshGate = { entered: deferred(), release: deferred() };
  await page.locator('#refreshShow').click();
  await refreshGate.entered.promise;
  await page.locator('#newShow').click();
  refreshGate.release.resolve();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#editorTitle').textContent(), 'สร้างรายการไลฟ์', 'late refresh cannot replace a newly selected editor');
  assert.equal(await page.locator('#showTitle').inputValue(), '');
  assertWorkflow(await workflowSnapshot(page), { saved: false });
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.ok(expectedHttpErrors.length >= 1, 'the intentional failed-save response was observed');
  await page.close();
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(audienceRequests, [], 'open/save/refresh/show-switch/unload issue zero retired audience requests');
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.136 Live Center linear workflow desktop/390 DOM, keyboard, form, state and race checks passed');
