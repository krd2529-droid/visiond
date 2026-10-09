import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of [process.env.PLAYWRIGHT_PACKAGE, 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'installed Chrome required');
const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const frontTopbar = ['cart', 'course-basket-edit', 'course-rights-terms', 'dashboard', 'forgot-password', 'login', 'member', 'partner-commerce-claim', 'product', 'register', 'reset-password', 'vtools'];
const frontStandalone = ['my-programs', 'toyscenter', 'vx-affiliate', 'blog/analyze-tiktok-shop-products', 'blog/create-powerpoint-online', 'blog/how-to-choose-tattoo-design', 'blog/popular-tattoo-styles', 'blog/tattoo-design-pdf-for-artists', 'blog/tiktok-open-collaboration-showcase'];
const backStandalone = ['account-vault', 'ads-center', 'basket-visibility', 'bundle-preview-audit', 'daily-tasks', 'elon-page-admin', 'live-center', 'live-package-open', 'partner-api', 'prompt-library', 'sales-page-center', 'sales-page-variants', 'tiktok-analyzer', 'toys-center-admin', 'v12-connect', 'v12-settings', 'vision13-intake', 'vision14-library', 'vision14-mix', 'vision14-summary', 'vision4-edit', 'vision7-admin', 'vpage-admin', 'vsport', 'vx-affiliate-admin', 'webhook-hub', 'work-links', 'work-notes'];
for (const name of frontTopbar) assert.match(fs.readFileSync(path.join(publicRoot, `${name}.html`), 'utf8'), /shared-nav\.js\?v=020176/, `${name} loads shared nav`);
for (const name of frontStandalone) assert.match(fs.readFileSync(path.join(publicRoot, `${name}.html`), 'utf8'), /data-page-nav="front"/, `${name} loads front bridge`);
for (const name of backStandalone) assert.match(fs.readFileSync(path.join(publicRoot, `${name}.html`), 'utf8'), /data-page-nav="back"/, `${name} loads back bridge`);

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'private, no-store' });
    response.end(JSON.stringify(url.pathname === '/api/auth/me' ? { user: null } : { items: [], products: [], courses: [], count: 0 }));
    return;
  }
  const local = path.resolve(publicRoot, `.${url.pathname === '/' ? '/index.html' : url.pathname}`);
  const relative = path.relative(publicRoot, local);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(local)) {
    response.writeHead(404); response.end(); return;
  }
  response.writeHead(200, { 'content-type': types[path.extname(local)] || 'application/octet-stream' });
  response.end(fs.readFileSync(local));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, locale: 'th-TH' });
    await context.route('https://**/*', route => route.fulfill({ status: 204, body: '' }));
    for (const [name, kind] of [['login', 'front'], ['dashboard', 'front'], ['toyscenter', 'front'], ['blog/analyze-tiktok-shop-products', 'front'], ['toys-center-admin', 'back'], ['vpage-admin', 'back'], ['vision4-edit', 'back']]) {
      const page = await context.newPage();
      await page.goto(`${base}/${name}.html`, { waitUntil: 'domcontentloaded' });
      const header = kind === 'front' && ['login', 'dashboard'].includes(name) ? page.locator('body > .topbar') : page.locator('body > .vd-page-header');
      await header.waitFor({ state: 'visible' });
      if (kind === 'front') {
        await page.locator('.topbar nav[data-account-ready="1"]').waitFor({ state: 'attached' });
        assert.equal(await page.locator('.topbar').count(), 1, `${name} has one global front header`);
        assert.equal(await page.locator('.topbar .nav-vpage-link').count(), 1, `${name} has canonical Vpage link`);
        assert.equal(await page.locator('.topbar #navLogin').count(), 1, `${name} has guest login`);
        assert.equal(await page.locator('.topbar #navRegister').count(), 1, `${name} has guest register`);
        assert.equal(await page.locator('.topbar .cart-nav').count(), 1, `${name} has one cart action`);
      } else {
        assert.equal(await page.locator('.vd-page-header').count(), 1, `${name} has one global back header`);
        for (const href of ['/admin.html', '/', '/dashboard.html']) assert.ok(await header.locator(`nav a[href="${href}"]`).count() >= 1, `${name} links ${href}`);
      }
      const visual = await header.evaluate(node => ({ height: node.getBoundingClientRect().height, width: node.getBoundingClientRect().width, viewport: innerWidth, navScroll: node.querySelector('nav').scrollWidth, navClient: node.querySelector('nav').clientWidth, background: getComputedStyle(node).backgroundImage }));
      assert.ok(visual.height >= 65, `${name} visible header height`);
      assert.notEqual(visual.background, 'none', `${name} baseline gradient`);
      assert.ok(visual.width <= visual.viewport + 1, `${name} header fits viewport`);
      if (name.startsWith('blog/')) assert.ok(visual.width >= visual.viewport - 1, `${name} header spans viewport`);
      if (viewport.width <= 800) {
        if (frontTopbar.includes(name)) await header.locator('.mobile-nav-toggle').waitFor({ state: 'visible' });
        const toggle = header.locator('.mobile-nav-toggle');
        if (await toggle.count()) {
          await toggle.click();
          await page.waitForFunction(() => document.body.classList.contains('mobile-nav-open') && document.querySelector('.mobile-nav-toggle')?.getAttribute('aria-expanded') === 'true');
        }
        const last = kind === 'front' ? header.locator('nav a[href="/about.html"]') : header.locator('nav a[href="/dashboard.html"]');
        await last.waitFor({ state: 'visible' });
        await last.evaluate(node => node.scrollIntoView());
        assert.equal(await last.isVisible(), true, `${name} last nav item is reachable on mobile`);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${name} has no horizontal page overflow`);
      await page.close();
    }
    if (viewport.width === 1440) {
      const page = await context.newPage();
      for (const [names, kind] of [[frontTopbar, 'front'], [frontStandalone, 'front'], [backStandalone, 'back']]) {
        for (const name of names) {
          await page.goto(`${base}/${name}.html`, { waitUntil: 'domcontentloaded' });
          const header = kind === 'front' && frontTopbar.includes(name) ? page.locator('body > .topbar') : page.locator('body > .vd-page-header');
          await header.waitFor({ state: 'visible' });
          if (kind === 'front') {
            await header.locator('.nav-vpage-link').waitFor({ state: 'attached' });
            assert.equal(await header.locator('.nav-vpage-link').count(), 1, `${name} one canonical Vpage link`);
          } else {
            assert.equal(await header.locator('nav a[href="/admin.html"]').count(), 1, `${name} one back link`);
          }
        }
      }
      await page.close();
    }
    const staffPage = await context.newPage();
    await staffPage.route('**/api/auth/me', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 1, role: 'boss' }, server_time: new Date().toISOString(), session_expires_at: new Date(Date.now() + 3600000).toISOString() }) }));
    await staffPage.goto(`${base}/toyscenter.html`, { waitUntil: 'domcontentloaded' });
    await staffPage.locator('.vd-front-header .nav-admin-link').waitFor({ state: 'attached' });
    assert.equal(await staffPage.locator('.vd-front-header #navLogin,.vd-front-header #navRegister').count(), 0, 'signed-in staff has no guest actions');
    assert.equal(await staffPage.locator('.vd-front-header .nav-member-account,.vd-front-header .nav-logout').count(), 2, 'signed-in staff has account and logout actions');
    await staffPage.close();
    await context.close();
  }
  console.log('PASS scoped VisionD front/back navigation, guest controls, desktop/mobile reachability and no overflow');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
