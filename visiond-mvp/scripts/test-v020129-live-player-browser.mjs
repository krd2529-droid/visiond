import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

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
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.129 browser gate');

const packageA = await representativePackage('Package A local player');
const packageB = await representativePackage('Package B reopened safely');
const packageC = await representativePackage('Package C after deferred exit');
const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const requests = [];
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
]);

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push(`${request.method} ${url.pathname}`);
    const relative = url.pathname === '/' ? 'live-package-open.html' : decodeURIComponent(url.pathname.slice(1));
    if (!relative || relative.split('/').includes('..')) {
      response.writeHead(400).end();
      return;
    }
    const filePath = path.join(publicRoot, ...relative.split('/'));
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
      'content-length': body.byteLength,
      'cache-control': 'no-store',
    });
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
  window.__liveTest = {
    speechTexts: [],
    speechVoices: [],
    speechCancels: 0,
    objectUrls: 0,
    revokedUrls: 0,
    fullscreenRequestMode: 'resolve',
    fullscreenExitMode: 'resolve',
    fullscreenRequests: 0,
    fullscreenExits: 0,
    pendingRequests: [],
    pendingExits: [],
  };
  class LocalUtterance {
    constructor(text) { this.text = text; this.lang = ''; this.voice = null; }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: LocalUtterance });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => [{ name: 'English', lang: 'en-US' }, { name: 'Thai Device', lang: 'th-TH' }],
      speak: utterance => {
        window.__liveTest.speechTexts.push(utterance.text);
        window.__liveTest.speechVoices.push({ lang: utterance.lang, name: utterance.voice?.name || '' });
      },
      cancel: () => { window.__liveTest.speechCancels += 1; },
    },
  });

  const nativeCreate = URL.createObjectURL.bind(URL);
  const nativeRevoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = blob => {
    window.__liveTest.objectUrls += 1;
    return nativeCreate(blob);
  };
  URL.revokeObjectURL = value => {
    window.__liveTest.revokedUrls += 1;
    return nativeRevoke(value);
  };

  let fullscreenElement = null;
  Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fullscreenElement });
  const dispatchFullscreenChange = () => document.dispatchEvent(new Event('fullscreenchange'));
  HTMLElement.prototype.requestFullscreen = function requestFullscreen() {
    const control = window.__liveTest;
    const element = this;
    control.fullscreenRequests += 1;
    if (control.fullscreenRequestMode === 'reject') return Promise.reject(new Error('fullscreen denied by test'));
    if (control.fullscreenRequestMode === 'defer') {
      return new Promise((resolve, reject) => control.pendingRequests.push({
        resolve: () => { fullscreenElement = element; dispatchFullscreenChange(); resolve(); },
        reject,
      }));
    }
    fullscreenElement = element;
    dispatchFullscreenChange();
    return Promise.resolve();
  };
  document.exitFullscreen = function exitFullscreen() {
    const control = window.__liveTest;
    control.fullscreenExits += 1;
    if (control.fullscreenExitMode === 'defer') {
      return new Promise(resolve => control.pendingExits.push({
        resolve: () => { fullscreenElement = null; dispatchFullscreenChange(); resolve(); },
      }));
    }
    fullscreenElement = null;
    dispatchFullscreenChange();
    return Promise.resolve();
  };
  window.__liveTest.resolveRequest = () => window.__liveTest.pendingRequests.shift()?.resolve();
  window.__liveTest.resolveExit = () => window.__liveTest.pendingExits.shift()?.resolve();
  window.__liveTest.forceFullscreenExit = () => { fullscreenElement = null; dispatchFullscreenChange(); };
  window.__liveTest.isFullscreen = () => Boolean(fullscreenElement);
});

const browserErrors = [];
const platformRequests = [];
const attachDiagnostics = page => {
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('request', request => { if (/facebook|tiktok|shopee/i.test(request.url())) platformRequests.push(request.url()); });
};
const choosePackage = async (page, bytes, name) => {
  await page.locator('#packageFile').setInputFiles({
    name,
    mimeType: 'application/vnd.visiond.live',
    buffer: Buffer.from(bytes),
  });
};

try {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  attachDiagnostics(page);
  await page.goto(`${baseUrl}/live-package-open.html`);
  await page.waitForLoadState('networkidle');
  const requestsBeforePackage = requests.length;
  await choosePackage(page, packageA, 'package-a.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Package A local player');
  assert.deepEqual(requests.slice(requestsBeforePackage), [], 'selecting and rendering a package performs zero HTTP/API/platform requests');
  assert.equal(await page.locator('#openPosition').textContent(), '1');
  assert.equal(await page.locator('#openCountdown').textContent(), '00:05.0');
  assert.equal(await page.locator('#startPlayback').isEnabled(), true);
  assert.equal(await page.locator('#stopPlayback').isDisabled(), true);
  assert.deepEqual(await page.evaluate(() => window.__liveTest.speechTexts), [], 'package open is non-autoplay and silent');

  await page.click('#startPlayback');
  assert.deepEqual(await page.evaluate(() => window.__liveTest.speechTexts), ['บทพูดฉากหนึ่ง']);
  assert.deepEqual(await page.evaluate(() => window.__liveTest.speechVoices), [{ lang: 'th-TH', name: 'Thai Device' }]);
  const countdownBefore = await page.locator('#openCountdown').textContent();
  await page.waitForTimeout(450);
  const countdownAfter = await page.locator('#openCountdown').textContent();
  assert.ok(countdownAfter <= countdownBefore, 'rendered countdown must not increase');
  await page.waitForFunction(() => document.querySelector('#openPosition')?.textContent === '2', null, { timeout: 6500 });
  assert.deepEqual(await page.evaluate(() => window.__liveTest.speechTexts), ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง']);
  assert.equal(await page.locator('#openerScene').getAttribute('data-transition'), 'fade');
  assert.equal(await page.locator('.opener-image-frame').evaluate(element => getComputedStyle(element).animationName), 'live-scene-fade');
  assert.equal(await page.locator('#openCountdown').textContent(), '00:06.0');

  await page.click('#stopPlayback');
  await page.click('#nextScene');
  assert.equal(await page.locator('#openPosition').textContent(), '3');
  assert.deepEqual(await page.evaluate(() => window.__liveTest.speechTexts), ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง'], 'paused manual navigation stays silent');
  await page.click('#startPlayback');
  assert.deepEqual(await page.evaluate(() => window.__liveTest.speechTexts), ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง', 'บทพูดฉากสาม']);
  await page.click('#restartPlayback');
  assert.equal(await page.locator('#openPosition').textContent(), '1');
  assert.equal(await page.locator('#openCountdown').textContent(), '00:05.0');
  assert.match(await page.locator('#openPlaybackStatus').textContent(), /ไม่เริ่มอัตโนมัติ/);
  assert.ok(await page.evaluate(() => window.__liveTest.speechCancels >= 4));

  await page.evaluate(() => { window.__liveTest.fullscreenRequestMode = 'reject'; });
  await page.click('#obsMode');
  await page.waitForFunction(() => document.body.classList.contains('obs-mode'));
  assert.equal(await page.locator('#obsStage').isVisible(), true);
  assert.equal(await page.locator('#obsStage').locator('button,input,textarea,select').count(), 0, 'captured OBS surface contains no controls');
  assert.equal(await page.locator('#obsStage').locator('#openScript').count(), 0, 'captured OBS surface contains no script node');
  const obsText = await page.locator('#obsStage').innerText();
  assert.match(obsText, /สินค้าทดสอบ 1/);
  assert.match(obsText, /ราคาจากแพ็กเกจ/);
  assert.doesNotMatch(obsText, /บทพูดฉาก/);
  assert.match(await page.locator('#openPlaybackStatus').textContent(), /เต็มหน้าต่างแทน/);
  assert.equal(await page.locator('#obsStage').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return Math.abs(rect.width - innerWidth) <= 1 && Math.abs(rect.height - innerHeight) <= 1 && element.scrollWidth <= innerWidth + 1 && element.scrollHeight <= innerHeight + 1;
  }), true, 'OBS fallback surface fills the viewport without overflow');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('obs-mode'));
  assert.equal(await page.locator('#obsStage').isHidden(), true);

  await page.evaluate(() => { window.__liveTest.fullscreenRequestMode = 'resolve'; });
  await page.click('#obsMode');
  await page.waitForFunction(() => window.__liveTest.isFullscreen());
  await page.evaluate(() => window.__liveTest.forceFullscreenExit());
  await page.waitForFunction(() => !document.body.classList.contains('obs-mode'));
  assert.equal(await page.locator('#obsStage').isHidden(), true, 'fullscreenchange exit removes the clean surface safely');

  await page.click('#startPlayback');
  const cancelsBeforeReopen = await page.evaluate(() => window.__liveTest.speechCancels);
  const revokesBeforeReopen = await page.evaluate(() => window.__liveTest.revokedUrls);
  await page.evaluate(() => { window.__liveTest.fullscreenRequestMode = 'defer'; });
  await page.click('#obsMode');
  await page.waitForFunction(() => window.__liveTest.pendingRequests.length === 1);
  await choosePackage(page, packageB, 'package-b.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Package B reopened safely');
  assert.equal(await page.locator('#obsStage').isHidden(), true);
  await page.evaluate(() => window.__liveTest.resolveRequest());
  await page.waitForFunction(() => !window.__liveTest.isFullscreen() && !document.body.classList.contains('obs-mode'));
  assert.equal(await page.locator('#packageTitle').textContent(), 'Package B reopened safely', 'late OBS request from package A cannot hide or replace package B');
  assert.equal(await page.locator('#openPosition').textContent(), '1');
  assert.equal(await page.locator('#openNarrationStatus').textContent(), 'เสียงจะเริ่มหลังผู้ใช้กดเล่นเท่านั้น', 'reopened package resets stale narration UI before any click');
  assert.ok(await page.evaluate(value => window.__liveTest.speechCancels > value, cancelsBeforeReopen), 'reopening cancels old speech');
  assert.ok(await page.evaluate(value => window.__liveTest.revokedUrls > value, revokesBeforeReopen), 'reopening revokes old object URLs');

  await page.evaluate(() => {
    window.__liveTest.fullscreenRequestMode = 'resolve';
    window.__liveTest.fullscreenExitMode = 'defer';
  });
  await page.click('#obsMode');
  await page.waitForFunction(() => window.__liveTest.isFullscreen());
  await choosePackage(page, packageC, 'package-c.visiondlive');
  await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Package C after deferred exit');
  assert.equal(await page.locator('#obsStage').isHidden(), true);
  await page.click('#obsMode');
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.body.classList.contains('obs-mode')), false, 'new OBS entry waits behind the old deferred fullscreen exit');
  assert.equal(await page.evaluate(() => window.__liveTest.pendingExits.length), 1);
  await page.evaluate(() => {
    window.__liveTest.fullscreenExitMode = 'resolve';
    window.__liveTest.resolveExit();
  });
  await page.waitForFunction(() => document.body.classList.contains('obs-mode') && window.__liveTest.isFullscreen());
  assert.equal(await page.locator('#obsProduct').textContent(), 'สินค้าทดสอบ 1');
  await page.waitForTimeout(50);
  assert.equal(await page.evaluate(() => document.body.classList.contains('obs-mode') && window.__liveTest.isFullscreen()), true, 'old exit completion cannot hide the newer package C OBS surface');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.body.classList.contains('obs-mode'));

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  attachDiagnostics(mobile);
  await mobile.goto(`${baseUrl}/live-package-open.html`);
  await mobile.waitForLoadState('networkidle');
  await choosePackage(mobile, packageA, 'mobile.visiondlive');
  await mobile.waitForFunction(() => !document.querySelector('#packageWorkspace')?.hidden);
  assert.equal(await mobile.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= innerWidth + 1), true, '390px opener has no horizontal overflow');
  assert.equal(await mobile.locator('#startPlayback').isVisible(), true);
  assert.equal(await mobile.locator('#obsMode').isVisible(), true);
  await mobile.evaluate(() => { window.__liveTest.fullscreenRequestMode = 'reject'; });
  await mobile.click('#obsMode');
  await mobile.waitForFunction(() => document.body.classList.contains('obs-mode'));
  assert.equal(await mobile.locator('#obsStage').evaluate(element => element.scrollWidth <= innerWidth + 1 && element.scrollHeight <= innerHeight + 1), true, '390px OBS surface has no overflow');
  await mobile.keyboard.press('Escape');

  assert.deepEqual(platformRequests, [], 'local player never contacts Facebook, TikTok, Shopee, or another platform');
  assert.deepEqual(browserErrors, [], 'desktop and 390px player runs have no console/page errors');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('v0.20.129 Chrome desktop/390 local playback, TTS, Cut/Fade, OBS fallback/fullscreen and reopen race checks passed');
