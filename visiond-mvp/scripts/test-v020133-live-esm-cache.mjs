import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { representativePackage } from './test-v020129-live-player.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [process.env.PLAYWRIGHT_PACKAGE, 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'Playwright Chromium is required for the v0.20.133 ESM cache regression');

const publicRoot = fileURLToPath(new URL('../public/', import.meta.url));
const staleResult = spawnSync('git', ['show', '09cb1d306415998979639d5586cd7bea61db664b^:visiond-mvp/public/live-package-presenter.js'], { encoding: null });
assert.equal(staleResult.status, 0, 'released v0.20.131 presenter fixture must be available');
const stalePresenter = staleResult.stdout;
assert.doesNotMatch(stalePresenter.toString('utf8'), /resolveLiveAiPresenterPreset/, 'fixture must be the stale presenter that caused Production failure');

const legacyPackage = await representativePackage('Returning browser cache package', { avatarPreset: 'none' });
const mimeTypes = new Map([['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'], ['.svg', 'image/svg+xml']]);
const requests = [];
let seedStalePresenter = true;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    requests.push(`${request.method} ${url.pathname}${url.search}`);
    if (url.pathname === '/seed-stale-v131.html') {
      const body = Buffer.from('<!doctype html><script type="module">import "/live-package-presenter.js"; window.__stalePresenterSeeded = true;</script>');
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': body.byteLength, 'cache-control': 'no-store' });
      response.end(body);
      return;
    }
    if (url.pathname === '/favicon.ico') {
      response.writeHead(204, { 'cache-control': 'no-store' });
      response.end();
      return;
    }
    if (url.pathname === '/live-package-presenter.js' && !url.search && seedStalePresenter) {
      response.writeHead(200, {
        'content-type': 'text/javascript; charset=utf-8',
        'content-length': stalePresenter.byteLength,
        'cache-control': 'public, max-age=31536000, immutable',
        etag: '"released-v020131-presenter"',
      });
      response.end(stalePresenter);
      return;
    }
    const relative = url.pathname === '/' ? 'live-package-open.html' : decodeURIComponent(url.pathname.slice(1));
    if (!relative || relative.split('/').includes('..')) return response.writeHead(400).end();
    const filePath = path.join(publicRoot, ...relative.split('/'));
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
      'content-length': body.byteLength,
      'cache-control': path.extname(filePath).toLowerCase() === '.js' ? 'public, max-age=31536000, immutable' : 'no-store',
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
const page = await context.newPage();
const errors = [];
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', error => errors.push(error.message));

let packageOpened = false;
try {
  await page.goto(`${baseUrl}/seed-stale-v131.html`);
  await page.waitForFunction(() => window.__stalePresenterSeeded === true);
  assert.equal(requests.filter(item => item === 'GET /live-package-presenter.js').length, 1, 'seed loads the released unversioned presenter once');

  seedStalePresenter = false;
  await page.goto(`${baseUrl}/live-package-open.html`);
  await page.waitForLoadState('networkidle');
  await page.locator('#packageFile').setInputFiles({
    name: 'returning-cache.visiondlive',
    mimeType: 'application/vnd.visiond.live',
    buffer: Buffer.from(legacyPackage),
  });
  try {
    await page.waitForFunction(() => document.querySelector('#packageTitle')?.textContent === 'Returning browser cache package', null, { timeout: 1_500 });
    packageOpened = true;
  } catch {}
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

const openerHtml = await readFile(new URL('../public/live-package-open.html', import.meta.url), 'utf8');
const openerSource = await readFile(new URL('../public/live-package-open.js', import.meta.url), 'utf8');
const hostSource = await readFile(new URL('../public/live-package-ai-host.js', import.meta.url), 'utf8');
const playerSource = await readFile(new URL('../public/live-package-player.js', import.meta.url), 'utf8');
const releasedVersion = (await readFile(new URL('../VERSION.txt', import.meta.url), 'utf8')).trim();
const expectedVersion = releasedVersion === 'v0.20.134' ? '020134' : '020133';
const expectedEdges = [
  'live-center-package.js',
  'live-package-ai-host.js',
  'live-package-presenter.js',
  'live-package-player.js',
  'live-package-thai-speech.js',
  ...(expectedVersion === '020134' ? ['live-photo-avatar.js'] : []),
];
const versionedEntry = openerHtml.includes(`/live-package-open.js?v=${expectedVersion}`);
const versionedOpenerEdges = expectedEdges.every(file => openerSource.includes(`./${file}?v=${expectedVersion}`));
const versionedNestedEdges = hostSource.includes(`./live-package-thai-speech.js?v=${expectedVersion}`)
  && playerSource.includes(`./live-package-thai-speech.js?v=${expectedVersion}`);
const staleUnversionedWasReused = requests.filter(item => item === 'GET /live-package-presenter.js').length === 1;

console.log(JSON.stringify({
  versionedEntry,
  versionedOpenerEdges,
  versionedNestedEdges,
  staleUnversionedWasReused,
  packageOpened,
  errors,
  moduleRequests: requests.filter(item => /live-(?:center-package|package-(?:open|ai-host|player|presenter|thai-speech))\.js/.test(item)),
}, null, 2));

assert.equal(staleUnversionedWasReused, true, 'fixture must faithfully reuse the cached v0.20.131 unversioned presenter');
assert.equal(versionedEntry, true, 'HTML must version the current module entry');
assert.equal(versionedOpenerEdges, true, 'every opener dependency edge must use the current cache key');
assert.equal(versionedNestedEdges, true, 'nested AI/player Thai-speech edges must use the same current cache key');
assert.deepEqual(errors, [], 'a returning browser must not hit an ESM missing-export error');
assert.equal(packageOpened, true, 'the existing package must open after a stale v0.20.131 dependency was cached');

console.log(`${releasedVersion} returning-browser ESM dependency cache-bust regression passed`);
