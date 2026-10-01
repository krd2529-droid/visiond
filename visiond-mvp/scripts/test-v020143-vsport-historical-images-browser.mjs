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
assert.ok(chromium, 'Playwright Chromium is required');
const publicRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const project = { id: 143, title: 'Historical candidate fixture', news_date: '2026-09-30', scope_mode: 'specific_team', team_name: 'Liverpool FC', target_minutes: 30, target_seconds: 0, status: 'media_review', narration_script: 'บททดสอบ '.repeat(220), thumbnail_headline: 'Fitzmaurice confirmed as Galway football manager', thumbnail_headline_eligible: false, thumbnail_subheadline: '', thumbnail_focus_text: '', thumbnail_focus_asset_id: null, thumbnail_palette: 'red-yellow', thumbnail_layout: 'split' };
const stories = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, headline: `ข่าวภาพย้อนหลัง ${index + 1}`, summary: 'รายละเอียดเพื่อยืนยันตำแหน่ง Step 3 และการคืนโฟกัส', team_name: 'Liverpool FC', publisher: 'Fixture Sport', source_url: `https://news.invalid/${index + 1}`, published_at: '2026-09-30T08:00:00Z', retrieved_at: '2026-09-30T08:01:00Z', selected: 1, sort_order: index * 10 }));
let candidates, assets;
const requests = [], posts = [];
const reset = () => {
  candidates = [
    { id: 401, story_id: 1, publisher: 'Fixture', state: 'failed', source_url: 'https://img.invalid/covers-header-v2-dropdown-caret.png', source_page_url: 'https://news.invalid/1', error_message: 'IMAGE_DECODE_OR_SIZE_INVALID', display_eligible: false },
    { id: 402, story_id: 1, publisher: 'Fixture', state: 'failed', source_url: 'https://img.invalid/hero.png?w=64&h=64', source_page_url: 'https://news.invalid/1', error_message: 'IMAGE_DECODE_OR_SIZE_INVALID', display_eligible: false },
    { id: 403, story_id: 2, publisher: 'Fixture', state: 'failed', source_url: 'https://img.invalid/recover.PNG?auto=format', source_page_url: 'https://news.invalid/2', error_message: 'IMAGE_MIME_UNSUPPORTED', display_eligible: true },
    { id: 404, story_id: 2, publisher: 'Fixture', state: 'failed', source_url: 'https://img.invalid/final.png?auto=format', source_page_url: 'https://news.invalid/2', error_message: 'IMAGE_SUPPORTED_FORMAT_NEGOTIATION_FAILED', display_eligible: false },
  ];
  assets = [{ id: 500, story_id: 9, candidate_id: 400, source_url: 'https://img.invalid/college-photo.png', source_page_url: 'https://apnews.com/article/ap-college-football-picks-test', publisher: 'AP', mime_type: 'image/png', file_size: 100, width: 800, height: 533, created_at: '2026-09-30', preview_url: '/api/admin/vsport-assets/500', story_eligible: false }];
  requests.length = 0;
  posts.length = 0;
};
const send = (res, data, status = 200) => { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'private, no-store'); res.end(JSON.stringify(data)); };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  requests.push(`${req.method} ${url.pathname}${url.search}`);
  if (url.pathname === '/api/auth/me') return send(res, { user: { id: 143, role: 'admin' } });
  if (url.pathname === '/api/admin/vsport' && req.method === 'POST') {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    return req.on('end', () => {
      const body = JSON.parse(raw || '{}');
      if (body.action === 'prepare_thumbnail_headline') return send(res, { ok: true, headline: 'ข่าวฟุตบอลวันนี้', requires_review: true });
      posts.push(body);
      if (body.action !== 'ingest_image' || body.candidate_id !== 403) return send(res, { error: 'unexpected fictional write' }, 400);
      candidates = candidates.map(item => item.id === 403 ? { ...item, state: 'ready', error_message: '' } : item);
      assets.push({ id: 501, story_id: 2, candidate_id: 403, source_url: candidates[2].source_url, source_page_url: 'https://news.invalid/2', publisher: 'Fixture', mime_type: 'image/png', file_size: 100, width: 800, height: 533, created_at: '2026-09-30', preview_url: '/api/admin/vsport-assets/501', story_eligible: true });
      return send(res, { ok: true, id: 501, preview_url: '/api/admin/vsport-assets/501', width: 800, height: 533 }, 201);
    });
  }
  if (url.pathname === '/api/admin/vsport' && url.searchParams.has('jobs_project')) return send(res, { jobs: [] });
  if (url.pathname === '/api/admin/vsport' && url.searchParams.get('id') === '143') return send(res, { project, stories, candidates, assets, story_pagination: { limit: 24, has_more: false, next_cursor: null }, media_pagination: { candidates: { limit: 24, has_more: true, next_cursor: '404' }, assets: { limit: 24, has_more: false, next_cursor: null } } });
  if (url.pathname === '/api/admin/vsport') return send(res, { items: [project], pagination: { limit: 24, has_more: false, next_cursor: null } });
  if (['/api/admin/vsport-assets/500','/api/admin/vsport-assets/501'].includes(url.pathname)) { res.setHeader('content-type', 'image/svg+xml'); return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="533"><rect width="800" height="533" fill="#2457c5"/></svg>'); }
  const relative = url.pathname === '/' ? '/vsport.html' : url.pathname, local = path.resolve(publicRoot, `.${relative}`);
  if (!local.startsWith(publicRoot) || !fs.existsSync(local)) { res.statusCode = 404; return res.end('not found'); }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
  res.setHeader('content-type', types[path.extname(local)] || 'application/octet-stream');
  res.end(fs.readFileSync(local));
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const deployedBase = process.env.VSPORT_DEPLOYED_BASE?.replace(/\/$/,'');
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });
const stable = (before, after, label) => assert.ok(Math.abs(after - before) <= 30, `${label}: ${before} -> ${after}`);
async function runViewport(viewport) {
  reset();
  const page = await browser.newPage({ viewport }), errors = [];
  if(deployedBase)await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url()),response=await fetch(`${base}${url.pathname}${url.search}`,{method:request.method(),headers:{'content-type':'application/json'},body:request.postData()||undefined});await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())})});
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(deployedBase?`${deployedBase}/vsport`:`${base}/vsport.html`);
  await page.getByRole('button', { name: 'เปิดทำต่อ Historical candidate fixture', exact: true }).click();
  await page.waitForSelector('#workspace:not([hidden])');
  await page.waitForTimeout(700);
  assert.match(await page.locator('[data-asset-id="500"]').textContent(),/รูปนี้มาจากข่าวที่ไม่ใช่ฟุตบอล/);
  assert.equal(await page.locator('[data-asset-id="500"]').getAttribute('data-ready'),'false');
  assert.equal(await page.locator('#thumbFocusAsset option[value="500"]').count(),0);
  assert.notEqual(await page.locator('#thumbHeadline').inputValue(),project.thumbnail_headline);
  assert.match(await page.locator('#thumbnailStatus').textContent(),/หัวข้อปกเดิมอ้างอิงข่าวที่ไม่ใช่ฟุตบอล/);
  assert.equal(await page.locator('[data-candidate-id]').count(), 1, 'only the legacy recoverable candidate remains actionable');
  assert.equal(await page.locator('[data-candidate-id="403"]').count(), 1);
  for (const id of [401, 402, 404]) assert.equal(await page.locator(`[data-candidate-id="${id}"]`).count(), 0, `${id} stays hidden`);
  const truth = await page.locator('#candidateList').textContent();
  assert.match(truth, /ซ่อนรูปประกอบเว็บไซต์หรือรายการที่ไม่ผ่านเกณฑ์ 3 รายการในหน้านี้/);
  assert.match(truth, /ยังมีรายการหน้าถัดไปที่ยังไม่ได้โหลด/);
  const button = page.locator('[data-candidate-id="403"]').getByRole('button', { name: 'ตรวจและเก็บสำเนา', exact: true });
  await button.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => scrollY);
  await button.click();
  await page.waitForFunction(() => document.querySelector('[data-candidate-id="403"] button')?.textContent === 'เก็บแล้ว' && document.querySelectorAll('#assetList .asset-card').length === 2);
  const after = await page.evaluate(() => scrollY);
  stable(before, after, `${viewport.width}px legacy recovery`);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset?.candidateId), '403', 'recovery restores row focus without scroll');
  assert.match(await page.locator('#mediaStatus').textContent(), /เก็บรูปสำเร็จ/);
  assert.equal(await page.locator('#thumbFocusAsset option[value="501"]').count(),1);
  await page.locator('#targetSeconds').fill('10');await page.locator('#planTimeline').click();assert.match(await page.locator('#timelineList').textContent(),/501/);assert.doesNotMatch(await page.locator('#timelineList').textContent(),/500/);
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0], { action: 'ingest_image', project_id: 143, candidate_id: 403 });
  assert.equal(requests.some(value => value.startsWith('DELETE ')), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), viewport.width, `${viewport.width}px has no horizontal overflow: ${JSON.stringify(await page.evaluate(()=>[...document.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).sort((a,b)=>b.getBoundingClientRect().right-a.getBoundingClientRect().right).slice(0,8).map(el=>({tag:el.tagName,id:el.id,cls:el.className,right:Math.round(el.getBoundingClientRect().right)}))))}`);
  assert.equal(errors.length, 0, errors.join('\n'));
  await page.close();
}
try {
  await runViewport({ width: 1440, height: 700 });
  await runViewport({ width: 390, height: 844 });
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
console.log('PASS v0.20.143 installed-Chrome desktop/390 historical candidate suppression, truthful status and legacy recovery preserve viewport/focus');
