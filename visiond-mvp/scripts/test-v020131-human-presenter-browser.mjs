import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import './test-v020130-live-ai-host-browser.mjs';
import { representativePackage } from './test-v020129-live-player.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [process.env.PLAYWRIGHT_PACKAGE, 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.131 human presenter browser gate');

const packages = {
  full: await representativePackage('Human presenter full', { avatarPreset: 'visiond-default' }),
  placeholder: await representativePackage('Human presenter simple', { avatarPreset: 'presenter-placeholder' }),
  none: await representativePackage('Human presenter hidden', { avatarPreset: 'none' }),
};
const openerSource = await readFile(new URL('../public/live-package-open.js', import.meta.url), 'utf8');
const legacyNoneUsesAiPresenter = /resolveLiveAiPresenterPreset\(manifest\.show\.avatar\.preset\)/.test(openerSource);
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const mimeTypes = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml']]);
const requests = [];
const hostRequests = [];
const control = { hold: true, serial: 0 };

const readRequestJson = request => new Promise((resolve, reject) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
  request.on('error', reject);
});
const payloadFor = productId => ({
  viewer_id: 91,
  turn: {
    text: `บทพิธีกรมนุษย์ ${productId} รอบ ${++control.serial}`,
    product: { id: productId, title: `สินค้าพิธีกรมนุษย์ ${productId}`, price_minor: 45900 + productId, currency: 'THB', stock: 12 + productId },
  },
});
const release = entry => {
  if (!entry || entry.closed || entry.released) return false;
  entry.released = true;
  const body = Buffer.from(JSON.stringify(payloadFor(entry.body.product_id)));
  entry.response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.byteLength, 'cache-control': 'private, no-store' });
  entry.response.end(body);
  return true;
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push(`${request.method} ${url.pathname}`);
    if (url.pathname === '/api/admin/live-center/host-turn' && request.method === 'POST') {
      const entry = { body: await readRequestJson(request), request, response, released: false, closed: false };
      hostRequests.push(entry);
      response.on('close', () => { entry.closed = true; });
      if (!control.hold) release(entry);
      return;
    }
    const relative = url.pathname === '/' ? 'live-package-open.html' : decodeURIComponent(url.pathname.slice(1));
    if (!relative || relative.split('/').includes('..')) return response.writeHead(400).end();
    const filePath = path.join(publicRoot, ...relative.split('/'));
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream', 'content-length': body.byteLength, 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const context = await browser.newContext({ locale: 'th-TH' });
await context.addInitScript(() => {
  window.__humanPresenter = { spoken: [], utterances: [], cancels: 0, autoStart: false };
  class PresenterUtterance { constructor(text) { this.text = String(text); this.lang = ''; this.voice = null; } }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: PresenterUtterance });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [{ name: 'Thai Presenter', lang: 'th-TH' }],
    speak: utterance => {
      window.__humanPresenter.spoken.push(utterance.text);
      window.__humanPresenter.utterances.push(utterance);
      if (window.__humanPresenter.autoStart) utterance.onstart?.();
    },
    cancel: () => { window.__humanPresenter.cancels += 1; },
  } });
  let fullscreenElement = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  HTMLElement.prototype.requestFullscreen = function requestFullscreen() { fullscreenElement = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
  document.exitFullscreen = () => { fullscreenElement = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
});

const errors = [];
const externalRequests = [];
const attachDiagnostics = page => {
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith(baseUrl) && !url.startsWith('blob:') && !url.startsWith('data:')) externalRequests.push(url);
  });
};
const choosePackage = (page, bytes, name) => page.locator('#packageFile').setInputFiles({ name, mimeType: 'application/vnd.visiond.live', buffer: Buffer.from(bytes) });
const waitForHostCount = async count => {
  const deadline = Date.now() + 4_000;
  while (hostRequests.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(hostRequests.length >= count, `expected ${count} host requests, received ${hostRequests.length}`);
};

try {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  attachDiagnostics(page);
  await page.goto(`${baseUrl}/live-package-open.html`);
  await page.waitForLoadState('networkidle');
  await choosePackage(page, packages.full, 'human-full.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Human presenter full');
  assert.equal(hostRequests.length, 0, 'opening a package remains zero-host-network');
  assert.equal(await page.locator('#aiPresenterPreview').isVisible(), true, 'full presenter is previewable before OBS');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-preset'), 'visiond-default');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'idle');
  assert.match(await page.locator('#aiPresenterPreview').getAttribute('aria-label'), /พิธีกรเสมือน VisionD.*พร้อมเริ่ม/);
  assert.equal(await page.locator('#aiPresenterPreview svg').getAttribute('aria-hidden'), 'true');
  for (const selector of ['.presenter-face', '.presenter-mouth', '.presenter-torso', '.presenter-arm-left', '.presenter-arm-right']) {
    assert.equal(await page.locator(`#aiPresenterPreview ${selector}`).count(), 1, `${selector} must exist in the operator preview`);
  }
  const previewBox = await page.locator('#aiPresenterPreview').boundingBox();
  assert.ok(previewBox.width >= 150 && previewBox.height >= 160, `human preview must be recognizable, received ${JSON.stringify(previewBox)}`);

  await page.click('#startPlayback');
  assert.equal(hostRequests.length, 0, 'offline playback remains zero-host-network');
  await page.click('#startAiHost');
  await waitForHostCount(1);
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'thinking');
  await page.waitForTimeout(1_550);
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'thinking', 'generation cannot run speaking gestures before narration starts');
  assert.equal(release(hostRequests[0]), true);
  await page.waitForFunction(() => window.__humanPresenter.utterances.length >= 2);
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'thinking', 'queued Web Speech is not genuine audible narration');
  assert.equal(hostRequests.length, 1, 'prefetch waits for the utterance onstart boundary');
  await page.waitForTimeout(1_550);
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'thinking', 'queued speech without onstart cannot schedule gestures');
  await page.evaluate(() => window.__humanPresenter.utterances.at(-1).onstart());
  await page.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'talk');
  assert.match((await page.evaluate(() => window.__humanPresenter.spoken)).at(-1), /^บทพิธีกรมนุษย์ 1/);
  await waitForHostCount(2);
  await page.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'present', null, { timeout: 3_000 });
  assert.match(await page.locator('#aiPresenterStateLabel').textContent(), /นำเสนอสินค้า/);
  await page.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'open', null, { timeout: 4_000 });

  await page.click('#obsMode');
  await page.waitForFunction(() => document.body.classList.contains('obs-mode'));
  const synchronized = await page.evaluate(() => ({
    preview: document.querySelector('#aiPresenterPreview')?.dataset.presenterState,
    obs: document.querySelector('#obsPresenter')?.dataset.presenterState,
    preset: document.querySelector('#obsPresenter')?.dataset.presenterPreset,
  }));
  assert.equal(synchronized.preview, synchronized.obs, 'operator and OBS surfaces share one presenter state');
  assert.equal(synchronized.preset, 'visiond-default');
  assert.equal(await page.locator('#obsPresenter').isVisible(), true);
  assert.equal(await page.locator('#obsStage').locator('button,input,textarea,select').count(), 0);
  const simultaneous = await page.evaluate(() => {
    const presenter = document.querySelector('#obsPresenter').getBoundingClientRect();
    const product = document.querySelector('#obsImage').getBoundingClientRect();
    return { presenter: { width: presenter.width, height: presenter.height }, product: { width: product.width, height: product.height } };
  });
  assert.ok(simultaneous.presenter.width >= 150 && simultaneous.presenter.height >= 170, JSON.stringify(simultaneous));
  assert.ok(simultaneous.product.width > 200 && simultaneous.product.height > 150, 'current product remains visible beside the human presenter');

  await page.locator('#pauseAiHost').evaluate(button => button.click());
  await page.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'paused');
  await page.waitForTimeout(1_550);
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'paused', 'pause invalidates the gesture clock');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('obs-mode'));

  const beforeResume = hostRequests.length;
  await page.click('#startAiHost');
  await waitForHostCount(beforeResume + 1);
  const utterancesBeforeFailure = await page.evaluate(() => window.__humanPresenter.utterances.length);
  assert.equal(release(hostRequests.at(-1)), true);
  await page.waitForFunction(expected => window.__humanPresenter.utterances.length > expected, utterancesBeforeFailure);
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'thinking');
  await page.evaluate(() => window.__humanPresenter.utterances.at(-1).onerror({ error: 'synthetic-presenter-error' }));
  await page.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'error');
  await page.evaluate(() => window.__humanPresenter.utterances.at(-1).onstart());
  await page.waitForTimeout(1_550);
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'error', 'onerror-before-onstart and late stale onstart hold a safe static pose');

  await choosePackage(page, packages.placeholder, 'human-placeholder.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Human presenter simple');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-preset'), 'presenter-placeholder');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'idle');
  assert.equal(await page.locator('#aiPresenterPreview .presenter-brand').evaluate(element => getComputedStyle(element).display), 'none', 'placeholder is a simplified human, not the full branded variant');

  const beforePlaceholder = hostRequests.length;
  await page.click('#startAiHost');
  await waitForHostCount(beforePlaceholder + 1);
  const utterancesBeforePlaceholder = await page.evaluate(() => window.__humanPresenter.utterances.length);
  assert.equal(release(hostRequests.at(-1)), true);
  await page.waitForFunction(expected => window.__humanPresenter.utterances.length > expected, utterancesBeforePlaceholder);
  await page.evaluate(() => window.__humanPresenter.utterances.at(-1).onstart());
  await page.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'talk');
  const stalePlaceholderIndex = (await page.evaluate(() => window.__humanPresenter.utterances.length)) - 1;
  await choosePackage(page, packages.none, 'human-none.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Human presenter hidden');
  await page.evaluate(index => window.__humanPresenter.utterances[index].onstart(), stalePlaceholderIndex);
  await page.waitForTimeout(1_550);
  assert.equal(await page.locator('#aiPresenterPreview').isVisible(), legacyNoneUsesAiPresenter, '`none` follows the active release compatibility policy');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-preset'), legacyNoneUsesAiPresenter ? 'visiond-default' : 'none');
  assert.equal(await page.locator('.ai-presenter-preview').getAttribute('data-presenter-visible'), legacyNoneUsesAiPresenter ? 'true' : 'false');
  assert.equal((await page.locator('.ai-presenter-preview').evaluate(element => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length)), legacyNoneUsesAiPresenter ? 2 : 1, 'preview layout follows presenter visibility');
  assert.match(await page.locator('#aiPresenterStateLabel').textContent(), legacyNoneUsesAiPresenter ? /พร้อมเริ่ม/ : /ซ่อนพิธีกร/);

  const beforeNone = hostRequests.length;
  await page.click('#startAiHost');
  await waitForHostCount(beforeNone + 1);
  const utterancesBeforeNone = await page.evaluate(() => window.__humanPresenter.utterances.length);
  assert.equal(release(hostRequests.at(-1)), true);
  await page.waitForFunction(expected => window.__humanPresenter.utterances.length > expected, utterancesBeforeNone);
  await page.evaluate(() => window.__humanPresenter.utterances.at(-1).onstart());
  await page.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'speaking' && document.querySelector('#obsLiveCaption')?.textContent.startsWith('บทพิธีกรมนุษย์'));
  assert.equal(await page.locator('#aiPresenterPreview').isVisible(), legacyNoneUsesAiPresenter);
  await page.click('#obsMode');
  await page.waitForFunction(() => document.body.classList.contains('obs-mode'));
  assert.equal(await page.locator('#obsAiHost').isVisible(), true, 'AI caption/status remains in OBS when presenter preset is none');
  assert.equal(await page.locator('#obsPresenter').isVisible(), legacyNoneUsesAiPresenter);
  assert.equal(await page.locator('#obsAiHost').getAttribute('data-presenter-visible'), legacyNoneUsesAiPresenter ? 'true' : 'false');
  assert.equal((await page.locator('#obsAiHost').evaluate(element => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length)), legacyNoneUsesAiPresenter ? 2 : 1, 'OBS layout follows presenter visibility');
  assert.match(await page.locator('#obsLiveCaption').textContent(), /^บทพิธีกรมนุษย์/);
  await page.keyboard.press('Escape');
  await page.close();

  control.hold = false;
  const mobile = await context.newPage();
  await mobile.emulateMedia({ reducedMotion: 'reduce' });
  await mobile.setViewportSize({ width: 390, height: 844 });
  attachDiagnostics(mobile);
  await mobile.goto(`${baseUrl}/live-package-open.html`);
  await mobile.waitForLoadState('networkidle');
  await choosePackage(mobile, packages.full, 'human-mobile.visiondlive');
  await mobile.waitForFunction(() => !document.querySelector('#packageWorkspace')?.hidden);
  assert.equal(await mobile.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true);
  const mobilePreview = await mobile.locator('#aiPresenterPreview').boundingBox();
  assert.ok(mobilePreview.width >= 100 && mobilePreview.height >= 120, `390px preview must remain recognizable: ${JSON.stringify(mobilePreview)}`);
  await mobile.evaluate(() => { window.__humanPresenter.autoStart = true; });
  await mobile.click('#startAiHost');
  await mobile.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'talk');
  await mobile.waitForTimeout(1_550);
  assert.equal(await mobile.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'talk', 'reduced motion keeps one static speaking pose');
  assert.equal(await mobile.locator('#aiPresenterPreview').evaluate(element => element.getAnimations({ subtree: true }).length), 0, 'reduced motion disables continuous SVG animation');
  await mobile.click('#obsMode');
  await mobile.waitForFunction(() => document.body.classList.contains('obs-mode'));
  const mobileObs = await mobile.locator('#obsStage').evaluate(element => {
    const presenter = document.querySelector('#obsPresenter').getBoundingClientRect();
    const product = document.querySelector('#obsImage').getBoundingClientRect();
    return { fits: element.scrollWidth <= innerWidth + 1 && element.scrollHeight <= innerHeight + 1, presenter: { width: presenter.width, height: presenter.height }, product: { width: product.width, height: product.height } };
  });
  assert.equal(mobileObs.fits, true, JSON.stringify(mobileObs));
  assert.ok(mobileObs.presenter.width >= 90 && mobileObs.presenter.height >= 120, JSON.stringify(mobileObs));
  assert.ok(mobileObs.product.width > 100 && mobileObs.product.height > 100, JSON.stringify(mobileObs));
  await mobile.keyboard.press('Escape');
  await mobile.close();

  assert.deepEqual(externalRequests, [], 'code-native presenter makes no remote avatar/provider/platform request');
  assert.deepEqual(errors, [], 'desktop and 390px human presenter have no console/page errors');
  assert.equal(requests.some(item => /facebook|tiktok|shopee|openai|googleapis/i.test(item)), false);
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.131 Chrome desktop/390 human presenter, gestures, presets, teardown, reduced-motion and zero-extra-network checks passed');
