import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { representativePackage } from './test-v020129-live-player.mjs';
import { THAI_VOICE_MISSING_MESSAGE } from '../public/live-package-thai-speech.js';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [process.env.PLAYWRIGHT_PACKAGE, 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.132 Thai-voice browser gate');

const legacyPackage = await representativePackage('Legacy none Thai host', { avatarPreset: 'none' });
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const mimeTypes = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml']]);
const requests = [];
const hostRequests = [];
let turnSerial = 0;

const readRequestJson = request => new Promise((resolve, reject) => {
  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); } });
  request.on('error', reject);
});

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push(`${request.method} ${url.pathname}`);
    if (url.pathname === '/api/admin/live-center/host-turn' && request.method === 'POST') {
      const body = await readRequestJson(request);
      hostRequests.push(body);
      const productId = body.product_id;
      const payload = Buffer.from(JSON.stringify({
        viewer_id: 132,
        turn: {
          text: `บทสดภาษาไทยสินค้า ${productId} รอบ ${++turnSerial}`,
          product: { id: productId, title: `สินค้าเสียงไทย ${productId}`, price_minor: 32000 + productId, currency: 'THB', stock: 20 + productId },
        },
      }));
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'content-length': payload.byteLength, 'cache-control': 'private, no-store' });
      response.end(payload);
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
  const state = { voices: [], utterances: [], cancels: 0, listeners: new Set() };
  class ThaiGateUtterance {
    constructor(text) {
      this.text = String(text);
      this.lang = '';
      this.voice = null;
    }
  }
  const synthesis = {
    getVoices: () => [...state.voices],
    speak: utterance => state.utterances.push(utterance),
    cancel: () => { state.cancels += 1; },
    addEventListener(type, listener) { if (type === 'voiceschanged') state.listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'voiceschanged') state.listeners.delete(listener); },
  };
  window.__thaiSpeech = {
    state,
    setVoices(voices, dispatch = true) {
      state.voices = voices.map(voice => ({ ...voice }));
      if (dispatch) for (const listener of [...state.listeners]) listener(new Event('voiceschanged'));
    },
    startLast() { state.utterances.at(-1)?.onstart?.(); },
  };
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: ThaiGateUtterance });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synthesis });
  let fullscreenElement = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  HTMLElement.prototype.requestFullscreen = function requestFullscreen() {
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
const chooseLegacyPackage = page => page.locator('#packageFile').setInputFiles({
  name: 'legacy-none.visiondlive',
  mimeType: 'application/vnd.visiond.live',
  buffer: Buffer.from(legacyPackage),
});
const waitForHostCount = async count => {
  const deadline = Date.now() + 4_000;
  while (hostRequests.length < count && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(hostRequests.length >= count, `expected ${count} host requests, received ${hostRequests.length}`);
};
const speechSnapshot = page => page.evaluate(() => ({
  utterances: window.__thaiSpeech.state.utterances.map(utterance => ({ text: utterance.text, lang: utterance.lang, voice: utterance.voice && { name: utterance.voice.name, lang: utterance.voice.lang } })),
  listeners: window.__thaiSpeech.state.listeners.size,
  cancels: window.__thaiSpeech.state.cancels,
}));

try {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  attachDiagnostics(page);
  await page.goto(`${baseUrl}/live-package-open.html`);
  await page.waitForLoadState('networkidle');
  await chooseLegacyPackage(page);
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Legacy none Thai host');

  assert.equal(hostRequests.length, 0, 'opening a legacy package remains zero-host-network');
  assert.equal(await page.locator('#aiPresenterPreview').isVisible(), true, 'legacy none maps to a visible online presenter before Start');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-preset'), 'visiond-default');
  assert.equal(await page.locator('#obsPresenter').getAttribute('data-presenter-preset'), 'visiond-default');
  const previewBox = await page.locator('#aiPresenterPreview').boundingBox();
  assert.ok(previewBox.width >= 150 && previewBox.height >= 160, `legacy host must be a recognizable human: ${JSON.stringify(previewBox)}`);

  const staticRequestCount = requests.length;
  await page.click('#startPlayback');
  await page.waitForFunction(() => document.querySelector('#openNarrationStatus')?.textContent.includes('กำลังค้นหาเสียงภาษาไทย'));
  assert.equal((await speechSnapshot(page)).utterances.length, 0, 'initially empty Chrome voices cannot fall through to its default voice');
  assert.equal(hostRequests.length, 0, 'offline discovery remains zero-host-network');
  assert.equal(requests.length, staticRequestCount, 'offline Start adds no network request');
  assert.equal((await speechSnapshot(page)).listeners, 1);
  await page.click('#stopPlayback');
  assert.equal((await speechSnapshot(page)).listeners, 0, 'offline Stop removes pending voice discovery');
  await page.evaluate(() => window.__thaiSpeech.setVoices([{ name: 'Thai late stale', lang: 'th-TH' }]));
  await page.waitForTimeout(30);
  assert.equal((await speechSnapshot(page)).utterances.length, 0, 'late voiceschanged after offline Stop is stale');

  await page.click('#restartPlayback');
  await page.evaluate(() => window.__thaiSpeech.setVoices([
    { name: 'Thai generic first', lang: 'th' },
    { name: 'Thai Thailand exact', lang: 'th-TH' },
  ], false));
  await page.click('#startPlayback');
  await page.waitForFunction(() => window.__thaiSpeech.state.utterances.length === 1);
  const offlineVoice = (await speechSnapshot(page)).utterances[0];
  assert.equal(offlineVoice.voice?.name, 'Thai Thailand exact');
  assert.equal(offlineVoice.lang.toLowerCase(), 'th-th');
  assert.equal(hostRequests.length, 0);

  await page.evaluate(() => window.__thaiSpeech.setVoices([], false));
  const firstAiHostCount = hostRequests.length + 1;
  await page.click('#startAiHost');
  await waitForHostCount(firstAiHostCount);
  await page.waitForFunction(() => document.querySelector('#aiHostStatus')?.textContent.includes('กำลังค้นหาเสียงภาษาไทย'));
  assert.match(await page.locator('#aiLiveCaption').textContent(), /^บทสดภาษาไทยสินค้า 1/);
  assert.equal((await speechSnapshot(page)).utterances.length, 1, 'AI waits instead of queueing a default utterance');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'thinking');
  await page.waitForTimeout(80);
  assert.equal(hostRequests.length, firstAiHostCount, 'voice discovery cannot start AI prefetch');

  await page.evaluate(() => window.__thaiSpeech.setVoices([
    { name: 'Thai generic first', lang: 'th' },
    { name: 'Thai Thailand exact', lang: 'th-TH' },
  ]));
  await page.waitForFunction(() => window.__thaiSpeech.state.utterances.length === 2);
  const queuedAi = (await speechSnapshot(page)).utterances.at(-1);
  assert.equal(queuedAi.voice?.name, 'Thai Thailand exact');
  assert.equal(queuedAi.lang.toLowerCase(), 'th-th');
  assert.equal(hostRequests.length, firstAiHostCount, 'queued speech is not yet genuine narration');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'thinking');
  await page.evaluate(() => window.__thaiSpeech.startLast());
  await page.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'talk');
  await waitForHostCount(firstAiHostCount + 1);
  assert.equal(hostRequests.at(-1).product_id, 1, 'one-slot prefetch stays on the authoritative current product');

  await page.click('#obsMode');
  await page.waitForFunction(() => document.body.classList.contains('obs-mode'));
  assert.equal(await page.locator('#obsPresenter').isVisible(), true);
  assert.equal(await page.locator('#obsPresenter').getAttribute('data-presenter-preset'), 'visiond-default');
  assert.match(await page.locator('#obsLiveCaption').textContent(), /^บทสดภาษาไทยสินค้า 1/);
  assert.equal(await page.locator('#obsStage').locator('button,input,textarea,select').count(), 0, 'clean OBS contains no operator controls');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('obs-mode'));

  await page.click('#stopAiHost');
  await chooseLegacyPackage(page);
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Legacy none Thai host');
  await page.evaluate(() => window.__thaiSpeech.setVoices([], false));
  const reopenPendingHostCount = hostRequests.length + 1;
  const utterancesBeforeReopen = (await speechSnapshot(page)).utterances.length;
  await page.click('#startAiHost');
  await waitForHostCount(reopenPendingHostCount);
  await page.waitForFunction(() => window.__thaiSpeech.state.listeners.size === 1);
  await chooseLegacyPackage(page);
  await page.waitForFunction(() => document.querySelector('#aiHostPanel')?.dataset.aiHostState === 'ready');
  assert.equal((await speechSnapshot(page)).listeners, 0, 'reopen removes pending AI voice discovery');
  await page.evaluate(() => window.__thaiSpeech.setVoices([{ name: 'Thai stale reopen', lang: 'th-TH' }]));
  await page.waitForTimeout(30);
  assert.equal((await speechSnapshot(page)).utterances.length, utterancesBeforeReopen, 'late discovery from the old package cannot speak in the reopened package');
  assert.equal(hostRequests.length, reopenPendingHostCount, 'reopen cannot launch a stale prefetch');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'idle');

  await page.evaluate(() => window.__thaiSpeech.setVoices([{ name: 'English only', lang: 'en-US' }], false));
  const missingOfflineSpeechCount = (await speechSnapshot(page)).utterances.length;
  await page.click('#startPlayback');
  await page.waitForFunction(message => document.querySelector('#openNarrationStatus')?.textContent === message, THAI_VOICE_MISSING_MESSAGE);
  assert.equal((await speechSnapshot(page)).utterances.length, missingOfflineSpeechCount, 'English-only offline playback never calls speechSynthesis.speak');
  await page.click('#stopPlayback');

  const missingAiHostCount = hostRequests.length + 1;
  await page.click('#startAiHost');
  await waitForHostCount(missingAiHostCount);
  await page.waitForFunction(message => document.querySelector('#aiHostStatus')?.textContent === message, THAI_VOICE_MISSING_MESSAGE);
  assert.equal(await page.locator('#aiHostPanel').getAttribute('data-ai-host-state'), 'error');
  assert.equal(await page.locator('#aiPresenterPreview').getAttribute('data-presenter-state'), 'error');
  assert.equal((await speechSnapshot(page)).utterances.length, missingOfflineSpeechCount, 'English-only AI never calls speechSynthesis.speak');
  await page.waitForTimeout(80);
  assert.equal(hostRequests.length, missingAiHostCount, 'missing Thai voice cannot start prefetch or an automatic retry loop');
  assert.equal(await page.locator('#retryAiHost').isVisible(), true, 'retry is explicit after installing or enabling a Thai voice');
  await page.close();

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  attachDiagnostics(mobile);
  await mobile.goto(`${baseUrl}/live-package-open.html`);
  await mobile.waitForLoadState('networkidle');
  await chooseLegacyPackage(mobile);
  await mobile.waitForFunction(() => !document.querySelector('#packageWorkspace')?.hidden);
  assert.equal(await mobile.locator('#aiPresenterPreview').isVisible(), true);
  assert.equal(await mobile.locator('#aiPresenterPreview').getAttribute('data-presenter-preset'), 'visiond-default');
  assert.equal(await mobile.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, 'legacy host preview has no 390px horizontal overflow');
  await mobile.evaluate(() => window.__thaiSpeech.setVoices([{ name: 'Thai mobile exact', lang: 'th-TH' }], false));
  const mobileHostCount = hostRequests.length + 1;
  await mobile.click('#startAiHost');
  await waitForHostCount(mobileHostCount);
  await mobile.waitForFunction(() => window.__thaiSpeech.state.utterances.length === 1);
  await mobile.evaluate(() => window.__thaiSpeech.startLast());
  await mobile.waitForFunction(() => document.querySelector('#aiPresenterPreview')?.dataset.presenterState === 'talk');
  await mobile.click('#obsMode');
  await mobile.waitForFunction(() => document.body.classList.contains('obs-mode'));
  const mobileObs = await mobile.locator('#obsStage').evaluate(element => ({
    fits: element.scrollWidth <= innerWidth + 1 && element.scrollHeight <= innerHeight + 1,
    presenterVisible: !document.querySelector('#obsPresenter').hidden && getComputedStyle(document.querySelector('#obsPresenter')).display !== 'none',
    caption: document.querySelector('#obsLiveCaption').textContent,
  }));
  assert.equal(mobileObs.fits, true, JSON.stringify(mobileObs));
  assert.equal(mobileObs.presenterVisible, true, JSON.stringify(mobileObs));
  assert.match(mobileObs.caption, /^บทสดภาษาไทยสินค้า 1/);
  await mobile.keyboard.press('Escape');
  await mobile.close();

  assert.deepEqual(externalRequests, [], 'Thai voice discovery and the code-native presenter add no external request');
  assert.deepEqual(errors, [], 'desktop and 390px legacy/Thai voice flows have no console or page error');
  assert.equal(requests.some(item => /facebook|tiktok|shopee|openai|googleapis/i.test(item)), false);
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.132 Chrome desktop/390 legacy AI presenter, Thai-only async discovery, cancellation, OBS and zero-extra-network checks passed');
