import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { representativePackage } from './test-v020129-live-player.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [process.env.PLAYWRIGHT_PACKAGE, 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.130 AI host browser gate');

const packageA = await representativePackage('Package A AI host');
const packageB = await representativePackage('Package B AI host reopen');
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const requests = [];
const hostRequests = [];
const mimeTypes = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml']]);
const control = { hold: true, serial: 0 };
const readRequestJson = request => new Promise((resolve, reject) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
  request.on('error', reject);
});
const turnPayload = (productId, label = '') => {
  control.serial += 1;
  return { viewer_id: 7, turn: { text: `บทสด AI ${productId} รอบ ${control.serial}${label}`, product: { id: productId, title: `สินค้าปัจจุบัน ${productId}`, price_minor: 55500 + productId, currency: 'THB', stock: 40 + productId } } };
};
const release = (entry, { status = 200, payload = turnPayload(entry.body.product_id) } = {}) => {
  if (!entry || entry.closed || entry.released) return false;
  entry.released = true;
  const body = Buffer.from(JSON.stringify(payload));
  entry.response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': body.byteLength, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
  entry.response.end(body);
  return true;
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push(`${request.method} ${url.pathname}`);
    if (url.pathname === '/api/admin/live-center/host-turn' && request.method === 'POST') {
      const body = await readRequestJson(request);
      const entry = { body, request, response, closed: false, released: false };
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
  window.__aiBrowser = { spoken: [], utterances: [], cancels: 0, speakSnapshots: [], fullscreenMode: 'resolve' };
  class HostUtterance { constructor(text) { this.text = String(text); this.lang = ''; this.voice = null; } }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: HostUtterance });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
    getVoices: () => [{ name: 'Thai Browser', lang: 'th-TH' }],
    speak: utterance => {
      window.__aiBrowser.spoken.push(utterance.text);
      window.__aiBrowser.utterances.push(utterance);
      window.__aiBrowser.speakSnapshots.push({ caption: document.querySelector('#aiLiveCaption')?.textContent || '', obsCaption: document.querySelector('#obsLiveCaption')?.textContent || '' });
      utterance.onstart?.();
    },
    cancel: () => { window.__aiBrowser.cancels += 1; },
  } });
  let fullscreenElement = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  HTMLElement.prototype.requestFullscreen = function requestFullscreen() {
    if (window.__aiBrowser.fullscreenMode === 'reject') return Promise.reject(new Error('fullscreen denied'));
    fullscreenElement = this;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  };
  document.exitFullscreen = () => {
    fullscreenElement = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  };
});

const browserErrors = [];
const expectedNetworkErrors = [];
const platformRequests = [];
const attachDiagnostics = page => {
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/Failed to load resource: the server responded with a status of 502/.test(message.text())) expectedNetworkErrors.push(message.text());
    else browserErrors.push(message.text());
  });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('request', request => { if (/facebook|tiktok|shopee|openai|googleapis/i.test(request.url())) platformRequests.push(request.url()); });
};
const choosePackage = (page, bytes, name) => page.locator('#packageFile').setInputFiles({ name, mimeType: 'application/vnd.visiond.live', buffer: Buffer.from(bytes) });
const waitClosed = async (entry, message) => {
  const deadline = Date.now() + 3000;
  while (!entry.closed && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(entry.closed, true, message);
};
const waitHostCount = (page, count) => page.waitForFunction(expected => performance.getEntriesByType('resource').filter(entry => entry.name.includes('/api/admin/live-center/host-turn')).length >= expected, count).catch(async () => {
  const deadline = Date.now() + 3000;
  while (hostRequests.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(hostRequests.length >= count, `expected ${count} host requests`);
});

try {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  attachDiagnostics(page);
  await page.goto(`${baseUrl}/live-package-open.html`);
  await page.waitForLoadState('networkidle');
  await choosePackage(page, packageA, 'ai-host-a.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Package A AI host');
  assert.equal(hostRequests.length, 0, 'opening a valid package makes no online host request');
  assert.match(await page.locator('#aiHostTitle').textContent(), /AI พิธีกรสด/);
  assert.equal(await page.locator('#startAiHost').isEnabled(), true);
  assert.equal(await page.locator('#aiLiveCaption').textContent(), 'ยังไม่มีบทสด');

  await page.click('#startPlayback');
  assert.deepEqual(await page.evaluate(() => window.__aiBrowser.spoken), ['บทพูดฉากหนึ่ง']);
  assert.equal(hostRequests.length, 0, 'offline Start remains saved-script-only and zero-host-network');
  await page.fill('#aiHostCue', 'เน้นชื่อรุ่น');
  const cancelsBeforeAi = await page.evaluate(() => window.__aiBrowser.cancels);
  await page.locator('#startAiHost').evaluate(button => { button.click(); button.click(); });
  while (hostRequests.length < 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(hostRequests.length, 1, 'double AI Start creates one request');
  assert.deepEqual(Object.keys(hostRequests[0].body).sort(), ['operator_cue', 'product_id', 'recent_turns']);
  assert.deepEqual(hostRequests[0].body, { product_id: 1, recent_turns: [], operator_cue: 'เน้นชื่อรุ่น' });
  assert.doesNotMatch(JSON.stringify(hostRequests[0].body), /บทพูดฉาก|Package A|visiondlive|livev_|image/i);
  assert.equal(await page.locator('#aiHostPanel').getAttribute('data-ai-host-state'), 'generating');
  assert.equal(await page.locator('#startPlayback').isDisabled(), true, 'offline controls lock while AI mode owns playback');
  assert.ok(await page.evaluate(value => window.__aiBrowser.cancels > value, cancelsBeforeAi), 'AI start cancels offline narration/timer ownership');

  assert.equal(release(hostRequests[0]), true);
  await page.waitForFunction(() => window.__aiBrowser.spoken.length === 2);
  while (hostRequests.length < 2) await new Promise(resolve => setTimeout(resolve, 10));
  const firstAiText = await page.locator('#aiLiveCaption').textContent();
  assert.match(firstAiText, /^บทสด AI 1/);
  assert.deepEqual((await page.evaluate(() => window.__aiBrowser.speakSnapshots)).at(-1), { caption: firstAiText, obsCaption: firstAiText }, 'live caption is rendered before device speech');
  assert.equal(await page.locator('#aiHostPanel').getAttribute('data-ai-host-state'), 'speaking');
  assert.match(await page.locator('#openProduct').textContent(), /สินค้าปัจจุบัน 1/);
  assert.match(await page.locator('#openPrice').textContent(), /ราคาปัจจุบันจาก VisionD/);
  assert.equal(hostRequests.length, 2, 'one held prefetch exists while speaking');

  await page.evaluate(() => window.__aiBrowser.utterances.at(-1).onend());
  await page.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'generating');
  assert.equal(hostRequests.length, 2, 'speech end waits for the existing prefetch instead of duplicating it');
  assert.equal(release(hostRequests[1]), true);
  await page.waitForFunction(() => window.__aiBrowser.spoken.length === 3);
  while (hostRequests.length < 3) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(hostRequests.length, 3, 'consuming prefetch replenishes only one next turn');

  await page.click('#pauseAiHost');
  await page.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'paused');
  await waitClosed(hostRequests[2], 'Pause aborts the active prefetch');
  const pausedCount = hostRequests.length;
  await page.waitForTimeout(100);
  assert.equal(hostRequests.length, pausedCount, 'Pause has no silent retry');
  await page.click('#startAiHost');
  while (hostRequests.length < pausedCount + 1) await new Promise(resolve => setTimeout(resolve, 10));
  const resumed = hostRequests.at(-1);
  assert.equal(resumed.body.product_id, 1);
  assert.equal(resumed.body.recent_turns.length, 2);
  assert.equal(release(resumed), true);
  await page.waitForFunction(() => window.__aiBrowser.spoken.length === 4);
  while (hostRequests.length < pausedCount + 2) await new Promise(resolve => setTimeout(resolve, 10));
  const stalePrefetch = hostRequests.at(-1);
  await page.click('#skipAiProduct');
  while (hostRequests.length < pausedCount + 3) await new Promise(resolve => setTimeout(resolve, 10));
  await waitClosed(stalePrefetch, 'Skip aborts the old product prefetch');
  assert.equal(hostRequests.at(-1).body.product_id, 2);
  assert.deepEqual(hostRequests.at(-1).body.recent_turns, []);
  assert.equal(await page.locator('#openPosition').textContent(), '2');
  assert.equal(await page.locator('#openerScene').getAttribute('data-transition'), 'fade');
  assert.equal(release(hostRequests.at(-1)), true);
  await page.waitForFunction(() => document.querySelector('#aiLiveCaption')?.textContent.includes('AI 2'));
  while (hostRequests.at(-1).body.product_id !== 2 || hostRequests.at(-1).released) await new Promise(resolve => setTimeout(resolve, 10));

  await page.evaluate(() => { window.__aiBrowser.fullscreenMode = 'reject'; });
  await page.click('#obsMode');
  await page.waitForFunction(() => document.body.classList.contains('obs-mode'));
  assert.equal(await page.locator('#obsAiHost').isVisible(), true);
  assert.equal(await page.locator('#obsStage').locator('button,input,textarea,select').count(), 0);
  const obsText = await page.locator('#obsStage').innerText();
  assert.match(obsText, /VISIOND AI HOST · ONLINE/);
  assert.match(obsText, /บทสด AI 2/);
  assert.match(obsText, /สินค้าปัจจุบัน 2/);
  assert.doesNotMatch(obsText, /บทพูดฉาก|คิวสั้น|เน้นชื่อรุ่น|เลือกไฟล์|เริ่ม AI/);
  const obsMetrics = await page.locator('#obsStage').evaluate(element => ({ scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight, innerWidth, innerHeight, rect: element.getBoundingClientRect().toJSON(), offenders: [...element.querySelectorAll('*')].map(item => ({ selector: `${item.tagName}#${item.id}.${item.className}`, rect: item.getBoundingClientRect().toJSON(), scrollWidth: item.scrollWidth })).filter(item => item.rect.right > innerWidth + 1 || item.scrollWidth > item.rect.width + 1) }));
  assert.equal(obsMetrics.scrollWidth <= obsMetrics.innerWidth + 1 && obsMetrics.scrollHeight <= obsMetrics.innerHeight + 1, true, JSON.stringify(obsMetrics));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('obs-mode'));

  const failingPrefetch = hostRequests.at(-1);
  assert.equal(release(failingPrefetch, { status: 502, payload: { error: 'AI ยังสร้างบทพูดไม่สำเร็จ กรุณาลองใหม่', code: 'LIVE_AI_PROVIDER_FAILED' } }), true);
  await page.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'error');
  assert.equal(await page.locator('#retryAiHost').isVisible(), true);
  const countAtFailure = hostRequests.length;
  await page.waitForTimeout(120);
  assert.equal(hostRequests.length, countAtFailure, 'provider failure stops without a tight retry');
  await page.click('#retryAiHost');
  while (hostRequests.length < countAtFailure + 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(release(hostRequests.at(-1)), true);
  await page.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'speaking');
  while (hostRequests.length < countAtFailure + 2) await new Promise(resolve => setTimeout(resolve, 10));
  const mutualPrefetch = hostRequests.at(-1);
  await page.locator('#startPlayback').evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'stopped');
  await waitClosed(mutualPrefetch, 'offline playback action aborts online prefetch');
  assert.equal(await page.locator('#stopPlayback').isEnabled(), true, 'offline timer owns playback after explicit mode switch');

  await page.click('#stopPlayback');
  await page.click('#startAiHost');
  while (hostRequests.length < countAtFailure + 3) await new Promise(resolve => setTimeout(resolve, 10));
  const packageARequest = hostRequests.at(-1);
  await choosePackage(page, packageB, 'ai-host-b.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Package B AI host reopen');
  await waitClosed(packageARequest, 'valid reopen aborts package A generation');
  assert.equal(await page.locator('#aiHostPanel').getAttribute('data-ai-host-state'), 'ready');
  assert.equal(await page.locator('#aiLiveCaption').textContent(), 'ยังไม่มีบทสด');
  assert.equal(await page.locator('#obsAiHost').isHidden(), true);

  await page.click('#startAiHost');
  while (hostRequests.length < countAtFailure + 4) await new Promise(resolve => setTimeout(resolve, 10));
  const validToInvalid = hostRequests.at(-1);
  await choosePackage(page, new Uint8Array([1, 2, 3, 4]), 'invalid.visiondlive');
  await page.waitForFunction(() => document.querySelector('#openStatus')?.textContent.includes('LIVE_PACKAGE_INVALID'));
  await waitClosed(validToInvalid, 'valid-to-invalid reopen also destroys active AI work');
  assert.equal(await page.locator('#packageWorkspace').isHidden(), true);

  control.hold = false;
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  attachDiagnostics(mobile);
  await mobile.goto(`${baseUrl}/live-package-open.html`);
  await mobile.waitForLoadState('networkidle');
  await choosePackage(mobile, packageA, 'mobile-ai-host.visiondlive');
  await mobile.waitForFunction(() => !document.querySelector('#packageWorkspace')?.hidden);
  assert.equal(await mobile.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true);
  assert.equal(await mobile.locator('#startAiHost').isVisible(), true);
  await mobile.click('#startAiHost');
  await mobile.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'speaking');
  assert.equal(await mobile.locator('#aiLiveCaption').isVisible(), true);
  assert.equal(await mobile.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, '390px AI host has no horizontal overflow');
  await mobile.evaluate(() => { window.__aiBrowser.fullscreenMode = 'reject'; });
  await mobile.click('#obsMode');
  await mobile.waitForFunction(() => document.body.classList.contains('obs-mode'));
  assert.equal(await mobile.locator('#obsAiHost').isVisible(), true);
  assert.equal(await mobile.locator('#obsStage').evaluate(element => element.scrollWidth <= innerWidth + 1 && element.scrollHeight <= innerHeight + 1), true);
  await mobile.keyboard.press('Escape');
  await mobile.close();

  assert.deepEqual(platformRequests, [], 'browser never calls a provider or platform directly');
  assert.deepEqual(browserErrors, [], 'desktop and 390px AI host have no unexpected console/page errors');
  assert.equal(expectedNetworkErrors.length, 1, 'only the intentional private 502 reports a browser network error');
  assert.ok(requests.filter(item => item === 'POST /api/admin/live-center/host-turn').length >= hostRequests.length);
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.130 Chrome desktop/390 online AI host, clean OBS, abort/retry/reopen and offline-isolation checks passed');
