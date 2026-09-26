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
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.135 browser gate');

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const viewerId = 135;
const showId = suffix => `live_${suffix.repeat(32)}`;
const activeId = showId('a');
const keepId = showId('b');
const raceId = showId('c');
const now = '2026-09-26T05:00:00.000Z';
const makeShow = (id, title, ownerId) => ({
  id,
  title,
  description: '',
  avatar_preset: 'visiond-default',
  output_profile: 'landscape-1080p',
  scene_count: 0,
  revision: 3,
  owner_id: ownerId,
  created_by: ownerId,
  updated_by: ownerId,
  created_at: now,
  updated_at: now,
  scenes: [],
});
const activeShow = makeShow(activeId, 'รายการทดสอบที่จะลบ', 41);
const keepShow = makeShow(keepId, 'รายการที่ต้องเก็บ', 42);
const raceShow = makeShow(raceId, 'รายการรอเปิด', 43);
const shows = new Map([activeShow, keepShow, raceShow].map(show => [show.id, show]));
const deleteAttempts = [];
const dialogs = [];
let localStopRequests = 0;
let activeDeleteMode = 'fail';
let activeDeleteGate = null;
let raceDetailGate = null;

const deferred = () => {
  let resolve;
  const promise = new Promise(next => { resolve = next; });
  return { promise, resolve };
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
const requestJson = async request => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
};
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
    if (pathname === '/api/auth/me') return json(response, { user: { id: viewerId, role: 'boss', name: 'Delete Browser Boss' } });
    if (pathname === '/api/admin/live-center/products' && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [], pagination: { limit: 24, has_more: false, next_cursor: null } });
    }
    if (pathname === '/api/admin/live-center/shows' && request.method === 'GET') {
      return json(response, {
        viewer_id: viewerId,
        items: [...shows.values()].map(({ scenes, ...show }) => show),
        pagination: { limit: 24, has_more: false, next_cursor: null },
      });
    }
    const showMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})$/);
    if (showMatch && request.method === 'GET') {
      const show = shows.get(showMatch[1]);
      if (!show) return json(response, { error: 'ไม่พบรายการไลฟ์', code: 'LIVE_SHOW_NOT_FOUND' }, 404);
      if (show.id === raceId && raceDetailGate) {
        raceDetailGate.entered.resolve();
        await raceDetailGate.release.promise;
      }
      return json(response, { viewer_id: viewerId, item: show });
    }
    if (showMatch && request.method === 'DELETE') {
      const id = showMatch[1];
      const body = await requestJson(request);
      deleteAttempts.push({ id, key: String(request.headers['idempotency-key'] || ''), body });
      if (id === activeId && activeDeleteMode === 'fail') {
        return json(response, { error: 'จำลองการลบล้มเหลว', code: 'TEST_DELETE_FAILED' }, 503);
      }
      if (id === activeId && activeDeleteGate) {
        activeDeleteGate.entered.resolve();
        await activeDeleteGate.release.promise;
      }
      const show = shows.get(id);
      if (!show) return json(response, { viewer_id: viewerId, deleted_id: id, replayed: true, cleanup_pending: false });
      shows.delete(id);
      return json(response, { viewer_id: viewerId, deleted_id: id, replayed: false, cleanup_pending: false });
    }
    const versionsMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})\/versions$/);
    if (versionsMatch && request.method === 'GET') {
      return json(response, { viewer_id: viewerId, items: [], pagination: { limit: 24, has_more: false, next_cursor: null } });
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
    const localSessionMatch = pathname.match(/^\/api\/admin\/live-center\/shows\/(live_[a-f0-9]{32})\/audience\/local-session$/);
    if (localSessionMatch && request.method === 'DELETE') {
      localStopRequests += 1;
      await requestJson(request);
      return json(response, { viewer_id: viewerId, ok: true });
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
const unexpected = [];
try {
  const context = await browser.newContext({ locale: 'th-TH' });
  const page = await context.newPage();
  page.on('pageerror', error => unexpected.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) unexpected.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/live-center.html`);
  await page.getByRole('button', { name: `ลบรายการ ${activeShow.title}`, exact: true }).waitFor();

  const cardContract = await page.getByRole('button', { name: `ลบรายการ ${activeShow.title}`, exact: true }).evaluate(button => ({
    parentTag: button.parentElement?.tagName,
    siblingOpenName: button.parentElement?.querySelector('.show-row')?.getAttribute('aria-label'),
    nestedButtons: button.parentElement?.querySelectorAll('button button').length,
    directButtons: [...(button.parentElement?.children || [])].filter(node => node.tagName === 'BUTTON').length,
  }));
  assert.deepEqual(cardContract, {
    parentTag: 'ARTICLE',
    siblingOpenName: `เปิดรายการ ${activeShow.title}`,
    nestedButtons: 0,
    directButtons: 2,
  });
  const desktopBoxes = await page.getByRole('button', { name: `ลบรายการ ${activeShow.title}`, exact: true }).evaluate(button => ({
    card: button.parentElement.getBoundingClientRect().toJSON(),
    open: button.previousElementSibling.getBoundingClientRect().toJSON(),
    remove: button.getBoundingClientRect().toJSON(),
  }));
  assert.ok(desktopBoxes.open.width > desktopBoxes.remove.width * 2, 'desktop card keeps separate wide open and compact delete controls');
  assert.equal(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true);

  await page.getByRole('button', { name: `เปิดรายการ ${activeShow.title}`, exact: true }).click();
  await page.getByRole('heading', { name: activeShow.title, exact: true }).waitFor();

  const cancelDialog = deferred();
  page.once('dialog', async dialog => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
    cancelDialog.resolve();
  });
  await page.getByRole('button', { name: `ลบรายการ ${keepShow.title}`, exact: true }).click();
  await cancelDialog.promise;
  assert.equal(dialogs.at(-1), `ต้องการลบรายการ "${keepShow.title}" ใช่หรือไม่?`);
  assert.equal(deleteAttempts.length, 0, 'cancel sends no destructive request');
  assert.equal(await page.getByRole('button', { name: `ลบรายการ ${keepShow.title}`, exact: true }).count(), 1);
  assert.equal(await page.locator('#editorTitle').textContent(), activeShow.title);

  const failedDialog = deferred();
  page.once('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); failedDialog.resolve(); });
  await page.getByRole('button', { name: `ลบรายการ ${activeShow.title}`, exact: true }).click();
  await failedDialog.promise;
  await page.waitForFunction(title => document.querySelector('#showStatus')?.textContent.includes(`ลบรายการ “${title}” ไม่สำเร็จ`), activeShow.title);
  assert.equal(await page.getByRole('button', { name: `ลบรายการ ${activeShow.title}`, exact: true }).count(), 1);
  assert.equal(await page.locator('#editorTitle').textContent(), activeShow.title);
  assert.equal(deleteAttempts.length, 1);

  activeDeleteMode = 'success';
  activeDeleteGate = { entered: deferred(), release: deferred() };
  const successDialog = deferred();
  page.once('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); successDialog.resolve(); });
  await page.getByRole('button', { name: `ลบรายการ ${activeShow.title}`, exact: true }).click();
  await successDialog.promise;
  await activeDeleteGate.entered.promise;
  const activeDeleteButton = page.getByRole('button', { name: `ลบรายการ ${activeShow.title}`, exact: true });
  assert.equal(await activeDeleteButton.isDisabled(), true);
  assert.equal(await activeDeleteButton.textContent(), 'กำลังลบ…');
  assert.equal(await page.getByRole('button', { name: `ลบรายการ ${keepShow.title}`, exact: true }).isDisabled(), false, 'busy state is scoped to one card');
  activeDeleteGate.release.resolve();
  await activeDeleteButton.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelector('#editorTitle')?.textContent === 'สร้างรายการไลฟ์');
  assert.equal(await page.getByRole('button', { name: `ลบรายการ ${keepShow.title}`, exact: true }).count(), 1);
  assert.equal(await page.getByRole('button', { name: `ลบรายการ ${raceShow.title}`, exact: true }).count(), 1);
  assert.equal(localStopRequests, 0, 'deleting the active editor avoids a background stop against the tombstone');
  assert.equal(deleteAttempts.length, 2);
  assert.ok(deleteAttempts[0].key);
  assert.equal(deleteAttempts[1].key, deleteAttempts[0].key, 'retry after a failed response reuses the delete Idempotency-Key');
  assert.deepEqual(deleteAttempts[1].body, { owner_id: activeShow.owner_id, title: activeShow.title, expected_revision: activeShow.revision });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileBoxes = await page.getByRole('button', { name: `ลบรายการ ${keepShow.title}`, exact: true }).evaluate(button => ({
    cardWidth: button.parentElement.getBoundingClientRect().width,
    deleteWidth: button.getBoundingClientRect().width,
    media: matchMedia('(max-width:520px)').matches,
    gridColumns: getComputedStyle(button.parentElement).gridTemplateColumns,
    widthRule: getComputedStyle(button).width,
    margin: getComputedStyle(button).margin,
    justifySelf: getComputedStyle(button).justifySelf,
    boxSizing: getComputedStyle(button).boxSizing,
  }));
  assert.ok(mobileBoxes.deleteWidth >= mobileBoxes.cardWidth * 0.85, `390px delete control stacks to a readable full row: ${JSON.stringify(mobileBoxes)}`);
  assert.equal(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, '390px editor has no horizontal overflow');

  raceDetailGate = { entered: deferred(), release: deferred() };
  await page.getByRole('button', { name: `เปิดรายการ ${raceShow.title}`, exact: true }).click();
  await raceDetailGate.entered.promise;
  const raceDeleteDialog = deferred();
  page.once('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); raceDeleteDialog.resolve(); });
  await page.getByRole('button', { name: `ลบรายการ ${raceShow.title}`, exact: true }).click();
  await raceDeleteDialog.promise;
  await page.getByRole('button', { name: `ลบรายการ ${raceShow.title}`, exact: true }).waitFor({ state: 'detached' });
  raceDetailGate.release.resolve();
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#editorTitle').textContent(), 'สร้างรายการไลฟ์', 'late open response cannot rehydrate a deleted show');
  assert.equal(await page.getByRole('button', { name: `ลบรายการ ${keepShow.title}`, exact: true }).count(), 1);
  assert.equal(unexpected.length, 0, unexpected.join('\n'));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.135 Live Center delete browser desktop/390 confirm, failure, success and stale-open checks passed');
