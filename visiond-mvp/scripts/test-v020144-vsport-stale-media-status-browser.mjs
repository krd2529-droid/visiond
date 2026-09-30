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
assert.ok(chromium, 'installed Chrome verification requires Playwright');

const publicRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const project = (id, title) => ({
  id,
  title,
  news_date: '2026-09-30',
  scope_mode: 'specific_team',
  team_name: 'Liverpool FC',
  target_minutes: 30,
  target_seconds: 0,
  status: 'media_review',
  narration_script: 'บทจำลองสถานะรูป '.repeat(260),
  thumbnail_headline: '',
  thumbnail_subheadline: '',
  thumbnail_focus_text: '',
  thumbnail_focus_asset_id: null,
  thumbnail_palette: 'red-yellow',
  thumbnail_layout: 'split',
});
const projects = [project(1441, 'Status project A'), project(1442, 'Status project B')];
const stories = projectId => Array.from({ length: 7 }, (_, index) => ({
  id: projectId * 10 + index,
  headline: `ข่าวจำลอง ${projectId}-${index + 1}`,
  summary: 'ข้อมูลจำลองสำหรับทดสอบ viewport และ focus โดยไม่แตะ Production',
  team_name: 'Liverpool FC',
  publisher: 'Fixture Sport',
  source_url: `https://news.invalid/${projectId}/${index + 1}`,
  published_at: '2026-09-30T10:00:00Z',
  retrieved_at: '2026-09-30T10:01:00Z',
  selected: 1,
  sort_order: index * 10,
}));
const candidate = (overrides = {}) => ({
  id: 2441,
  story_id: 14410,
  publisher: 'Fixture Sport',
  state: 'failed',
  source_url: 'https://img.invalid/recoverable.jpg',
  source_page_url: 'https://news.invalid/1441/1',
  error_message: 'IMAGE_MIME_UNSUPPORTED',
  display_eligible: true,
  ...overrides,
});
const asset = (id = 3441, candidateId = 2440) => ({
  id,
  story_id: 14410,
  candidate_id: candidateId,
  source_url: `https://img.invalid/ready-${id}.jpg`,
  source_page_url: 'https://news.invalid/1441/1',
  publisher: 'Fixture Sport',
  mime_type: 'image/jpeg',
  file_size: 1234,
  width: 800,
  height: 533,
  created_at: '2026-09-30',
  preview_url: `/api/admin/vsport-assets/${id}`,
});
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const json = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json; charset=utf-8',
  headers: { 'cache-control': 'private, no-store' },
  body: JSON.stringify(body),
});
const stable = (before, after, label) => assert.ok(Math.abs(after - before) <= 30, `${label}: ${before} -> ${after}`);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const relative = url.pathname === '/' || url.pathname === '/vsport' ? '/vsport.html' : url.pathname;
  const local = path.resolve(publicRoot, `.${relative}`);
  if (!local.startsWith(publicRoot) || !fs.existsSync(local)) { res.statusCode = 404; return res.end('not found'); }
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
  res.setHeader('content-type', types[path.extname(local)] || 'application/octet-stream');
  res.end(fs.readFileSync(local));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' });

function makeFixture(mode) {
  const gates = { post: deferred(), detail: deferred(), job: deferred(), jobs: deferred(), stories: deferred() };
  const fixture = {
    mode,
    candidates: [candidate()],
    assets: mode === 'terminal-zero' ? [] : [asset()],
    requests: [],
    detailCalls: 0,
    detailHeld: false,
    jobsCalls: 0,
    postCalls: 0,
    jobCalls: 0,
    storyPageCalls: 0,
    gates,
  };
  fixture.detail = id => ({
    project: projects.find(item => item.id === Number(id)),
    stories: mode === 'legacy-stories' && Number(id) === 1441 ? [stories(1441)[0]] : stories(Number(id)),
    candidates: Number(id) === 1441 ? fixture.candidates : [],
    assets: Number(id) === 1441 ? fixture.assets : [],
    story_pagination: mode === 'legacy-stories' && Number(id) === 1441 ? { limit: 24, has_more: true, next_cursor: '24', hidden_non_soccer: 23 } : { limit: 24, has_more: false, next_cursor: null, hidden_non_soccer: 0 },
    media_pagination: {
      candidates: { limit: 24, has_more: mode === 'omission', next_cursor: mode === 'omission' ? '2441' : null },
      assets: { limit: 24, has_more: false, next_cursor: null },
    },
  });
  return fixture;
}

async function routeFixture(page, fixture) {
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()), record = { method: request.method(), path: `${url.pathname}${url.search}` };
    fixture.requests.push(record);
    if (url.pathname === '/api/auth/me') return json(route, { user: { id: 144, role: 'admin' } });
    if (/^\/api\/admin\/vsport-assets\/\d+$/.test(url.pathname)) return route.fulfill({
      status: 200,
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="533"><rect width="800" height="533" fill="#2457c5"/></svg>',
    });
    assert.equal(url.pathname, '/api/admin/vsport', `unexpected API path ${url.pathname}`);
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      record.body = body;
      if (body.action === 'ingest_image') {
        fixture.postCalls += 1;
        assert.equal(body.project_id, 1441);
        assert.equal(body.candidate_id, 2441);
        if (fixture.mode === 'focus-moved') await fixture.gates.post.promise;
        if (fixture.mode === 'success') {
          fixture.candidates = [candidate({ state: 'ready', error_message: '', display_eligible: true })];
          fixture.assets = [...fixture.assets, asset(3442, 2441)];
          return json(route, { ok: true, id: 3442, preview_url: '/api/admin/vsport-assets/3442', width: 800, height: 533 }, 201);
        }
        if (['retryable', 'focus-during-refresh-retryable'].includes(fixture.mode)) fixture.candidates = [candidate({ error_message: 'IMAGE_HTTP_500', display_eligible: true })];
        else if (fixture.mode === 'omission') fixture.candidates = [];
        else fixture.candidates = [candidate({ error_message: 'IMAGE_DECODE_OR_SIZE_INVALID', display_eligible: false })];
        return json(route, { error: ['retryable', 'focus-during-refresh-retryable'].includes(fixture.mode) ? 'IMAGE_HTTP_500' : 'IMAGE_DECODE_OR_SIZE_INVALID', candidate_id: 2441 }, 422);
      }
      if (body.action === 'discover_images') {
        assert.equal(body.project_id, 1441);
        return json(route, { job: { id: 'fixture-image-job', project_id: 1441, job_type: 'images', status: 'running', checkpoint: 'queued', updated_at: '2026-09-30 10:00:00' } }, 202);
      }
      assert.fail(`unexpected fictional POST ${JSON.stringify(body)}`);
    }
    if (url.searchParams.has('job')) {
      fixture.jobCalls += 1;
      if (fixture.mode === 'watcher-after-neutral') await fixture.gates.job.promise;
      if (fixture.mode === 'recovered-before') return json(route, { job: { id: 'fixture-image-job', project_id: 1441, job_type: 'images', status: 'running', checkpoint: 'candidates:1', updated_at: '2026-09-30 10:00:00' } });
      const failed = fixture.mode === 'same-project-newer';
      return json(route, { job: { id: 'fixture-image-job', project_id: 1441, job_type: 'images', status: failed ? 'failed' : 'completed', checkpoint: failed ? 'failed' : 'done', error_text: failed ? 'NEWER_IMAGE_JOB_ERROR' : '', updated_at: '2026-09-30 10:00:00' } });
    }
    if (url.searchParams.has('jobs_project')) {
      fixture.jobsCalls += 1;
      const heldCall = fixture.mode === 'recovered-after' ? 2 : 0;
      if (fixture.jobsCalls === heldCall) await fixture.gates.jobs.promise;
      const active = fixture.mode === 'recovered-before' ? fixture.jobsCalls === 1 : fixture.jobsCalls === heldCall;
      return json(route, { jobs: active ? [{ id: 'fixture-image-job', project_id: 1441, job_type: 'images', idempotency_key: 'fixture-job-key', status: 'running', checkpoint: 'candidates:1', updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }] : [] });
    }
    if (url.searchParams.has('id')) {
      fixture.detailCalls += 1;
      const id = Number(url.searchParams.get('id'));
      if (fixture.mode === 'legacy-stories' && url.searchParams.has('story_cursor')) {
        fixture.storyPageCalls += 1;
        assert.equal(id, 1441);
        assert.equal(url.searchParams.get('include'), 'stories');
        assert.equal(url.searchParams.get('story_cursor'), '24');
        await fixture.gates.stories.promise;
        return json(route, { project: projects[0], stories: [{ ...stories(1441)[1], id: 14425, headline: 'ข่าวฟุตบอลแถวที่ 25' }], story_pagination: { limit: 24, has_more: false, next_cursor: null, hidden_non_soccer: 1 } });
      }
      if (id === 1441 && fixture.detailCalls === 2) {
        if (fixture.mode === 'refresh-error') return json(route, { error: 'DETAIL_REFRESH_FAILED' }, 500);
        if (['same-project-newer', 'aba', 'focus-during-refresh-terminal', 'focus-during-refresh-retryable'].includes(fixture.mode)) {
          if (fixture.mode.startsWith('focus-during-refresh-')) fixture.detailHeld = true;
          await fixture.gates.detail.promise;
        }
      }
      return json(route, fixture.detail(id));
    }
    return json(route, { items: projects, pagination: { limit: 24, has_more: false, next_cursor: null } });
  });
}

async function openFixture(page) {
  await page.goto(`${base}/vsport`);
  await page.getByRole('button', { name: 'เปิดทำต่อ Status project A', exact: true }).click();
  await page.waitForSelector('#workspace:not([hidden])');
  await page.waitForTimeout(100);
}

async function observeStatus(page) {
  await page.evaluate(() => {
    window.__v144StatusTexts = [];
    const node = document.querySelector('#mediaStatus');
    let last = node.textContent.trim();
    new MutationObserver(() => {
      const text = node.textContent.trim();
      if (text !== last) { last = text; window.__v144StatusTexts.push(text); }
    }).observe(node, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  });
}

async function candidateClick(page) {
  const button = page.locator('[data-candidate-id="2441"]').getByRole('button', { name: 'ตรวจและเก็บสำเนา', exact: true });
  await button.scrollIntoViewIfNeeded();
  await button.focus();
  const before = await page.evaluate(() => scrollY);
  await button.click();
  return { button, before };
}

async function snapshot(page) {
  return page.evaluate(() => ({
    status: document.querySelector('#mediaStatus').textContent.trim(),
    className: document.querySelector('#mediaStatus').className,
    candidates: document.querySelectorAll('[data-candidate-id]').length,
    assets: document.querySelectorAll('#assetList .asset-card[data-ready="true"]').length,
    activeId: document.activeElement?.id || '',
    activeCandidate: document.activeElement?.closest?.('[data-candidate-id]')?.dataset.candidateId || '',
    scrollY,
    scrollWidth: document.documentElement.scrollWidth,
    announcementTexts: window.__v144StatusTexts || [],
  }));
}

async function runCore(mode, viewport) {
  const fixture = makeFixture(mode), page = await browser.newPage({ viewport }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/422 \(Unprocessable Entity\)/.test(message.text()) && !(mode === 'refresh-error' && /500 \(Internal Server Error\)/.test(message.text()))) errors.push(message.text()); });
  await routeFixture(page, fixture);
  await openFixture(page);
  if (fixture.assets.length) await page.waitForSelector('#assetList .asset-card[data-ready="true"]');
  await observeStatus(page);
  const { before } = await candidateClick(page);
  if (mode === 'focus-moved') {
    await page.locator('#manualImageUrl').focus();
    fixture.gates.post.resolve();
  }
  if (mode.startsWith('focus-during-refresh-')) {
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.classList.contains('error'));
    for (let count = 0; count < 200 && !fixture.detailHeld; count += 1) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(fixture.detailHeld, true, `${mode} holds the authoritative detail refresh`);
    assert.match(await page.locator('#createStatus').textContent(), /กำลังเปิดโปรเจกต์/, `${mode} remains inside the held refresh`);
    await page.locator('#manualImageUrl').focus();
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'manualImageUrl', `${mode} owns focus before detail release`);
    fixture.gates.detail.resolve();
  }
  if (mode === 'refresh-error') await page.waitForFunction(() => document.querySelector('#createStatus')?.textContent.includes('DETAIL_REFRESH_FAILED'));
  else if (mode === 'omission') await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('IMAGE_DECODE_OR_SIZE_INVALID') && document.querySelector('#candidateList')?.textContent.includes('ยังมีรายการหน้าถัดไป'));
  else if (['retryable', 'focus-during-refresh-retryable'].includes(mode)) await page.waitForFunction(() => document.querySelector('[data-candidate-id="2441"]')?.textContent.includes('IMAGE_HTTP_500'));
  else if (mode === 'success') await page.waitForFunction(() => document.querySelectorAll('#assetList .asset-card[data-ready="true"]').length === 2);
  else await page.waitForFunction(() => document.querySelectorAll('[data-candidate-id]').length === 0 && document.querySelector('#mediaStatus')?.textContent.includes('ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว'));
  if (mode.startsWith('focus-during-refresh-')) await page.waitForFunction(() => document.querySelector('#createStatus')?.textContent === '');
  const result = await snapshot(page);
  stable(before, result.scrollY, `${mode}/${viewport.width} viewport`);
  assert.equal(result.scrollWidth, viewport.width, `${mode}/${viewport.width} overflow`);
  if (['terminal-ready', 'focus-moved', 'focus-during-refresh-terminal'].includes(mode)) {
    assert.equal(result.status, 'ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว · รูปที่เก็บสำเร็จยังพร้อมใช้งาน');
    assert.equal(result.className, 'status-line');
    assert.equal(result.candidates, 0);
    assert.equal(result.assets, 1);
    assert.equal(result.announcementTexts.filter(text => text === result.status).length, 1, 'neutral status is announced once');
    assert.equal(result.activeId, ['focus-moved', 'focus-during-refresh-terminal'].includes(mode) ? 'manualImageUrl' : 'discoverImages');
  } else if (mode === 'terminal-zero') {
    assert.equal(result.status, 'ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว · กรุณาเลือกรูปอื่นหรือเพิ่ม URL รูปด้วยตนเอง');
    assert.equal(result.className, 'status-line');
    assert.equal(result.assets, 0);
    assert.equal(result.activeId, 'discoverImages');
  } else if (['retryable', 'focus-during-refresh-retryable'].includes(mode)) {
    assert.equal(result.className, 'status-line error');
    assert.match(result.status, /IMAGE_HTTP_500/);
    assert.equal(result.candidates, 1);
    if (mode === 'focus-during-refresh-retryable') assert.equal(result.activeId, 'manualImageUrl');
    else assert.equal(result.activeCandidate, '2441');
  } else if (mode === 'success') {
    assert.equal(result.className, 'status-line success');
    assert.match(result.status, /เก็บรูปสำเร็จ/);
    assert.equal(result.candidates, 1);
    assert.equal(result.assets, 2);
  } else {
    assert.equal(result.className, 'status-line error', `${mode} must retain the candidate error class: ${JSON.stringify(result)}`);
    assert.match(result.status, /IMAGE_DECODE_OR_SIZE_INVALID/, `${mode} must retain the exact candidate error`);
    assert.equal(result.announcementTexts.some(text => text.includes('ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว')), false);
  }
  if (mode === 'terminal-ready') {
    await page.locator('#refreshProject').click();
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent === '');
    assert.equal(await page.locator('#mediaStatus').getAttribute('class'), 'status-line');
  }
  assert.equal(fixture.postCalls, 1);
  assert.equal(fixture.requests.some(item => item.method === 'DELETE'), false);
  assert.deepEqual(errors, []);
  await page.close();
}

async function runRace(mode, viewport) {
  const fixture = makeFixture(mode), page = await browser.newPage({ viewport }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/422 \(Unprocessable Entity\)/.test(message.text())) errors.push(message.text()); });
  await routeFixture(page, fixture);
  await openFixture(page);
  await page.waitForSelector('#assetList .asset-card[data-ready="true"]');
  await observeStatus(page);
  if (mode === 'watcher-after-neutral') {
    await page.locator('#discoverImages').click();
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('กำลังเริ่มงาน'));
  }
  if (mode === 'recovered-before') await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('กู้คืนงาน images'));
  const { before } = await candidateClick(page);
  let stableTop = before;
  if (mode === 'same-project-newer') {
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('IMAGE_DECODE_OR_SIZE_INVALID'));
    await page.locator('#discoverImages').click();
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('NEWER_IMAGE_JOB_ERROR'));
    stableTop = await page.evaluate(() => scrollY);
    const detailBeforeRelease = fixture.detailCalls;
    fixture.gates.detail.resolve();
    await page.waitForTimeout(150);
    assert.equal(fixture.detailCalls, detailBeforeRelease, 'stale candidate refresh does not trigger a newer open');
    assert.match((await snapshot(page)).status, /NEWER_IMAGE_JOB_ERROR/);
  } else if (mode === 'watcher-after-neutral') {
    // The older watcher started above; the candidate operation is now the current owner.
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว'));
    await page.waitForTimeout(100);
    stableTop = await page.evaluate(() => scrollY);
    const details = fixture.detailCalls;
    fixture.gates.job.resolve();
    await page.waitForTimeout(150);
    assert.equal(fixture.detailCalls, details, 'stale completed watcher is fenced before openProject');
    assert.match((await snapshot(page)).status, /ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว/);
  } else if (mode === 'recovered-before') {
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว'));
    await page.waitForTimeout(150);
    assert.match((await snapshot(page)).status, /ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว/);
  } else if (mode === 'recovered-after') {
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว'));
    fixture.gates.jobs.resolve();
    await page.waitForFunction(() => /กู้คืนงาน images|ทำงานสำเร็จ/.test(document.querySelector('#mediaStatus')?.textContent || ''));
    assert.doesNotMatch((await snapshot(page)).status, /ซ่อนรูปที่นำเข้าไม่สำเร็จแล้ว/);
  } else if (mode === 'aba') {
    await page.waitForFunction(() => document.querySelector('#mediaStatus')?.textContent.includes('IMAGE_DECODE_OR_SIZE_INVALID'));
    await page.getByRole('button', { name: 'เปิดทำต่อ Status project B', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#workspaceTitle')?.textContent === 'Status project B');
    await page.getByRole('button', { name: 'เปิดทำต่อ Status project A', exact: true }).click();
    fixture.gates.detail.resolve();
    await page.waitForFunction(() => document.querySelector('#workspaceTitle')?.textContent === 'Status project A' && document.querySelector('#mediaStatus')?.textContent === '');
    await page.waitForTimeout(500);
    stableTop = await page.evaluate(() => scrollY);
    await page.waitForTimeout(150);
    const result = await snapshot(page);
    assert.equal(result.status, '');
    assert.notEqual(result.activeId, 'discoverImages', 'stale A callback cannot steal focus after A→B→A reopen');
  }
  const result = await snapshot(page);
  stable(stableTop, result.scrollY, `${mode}/${viewport.width} viewport`);
  assert.equal(result.scrollWidth, viewport.width, `${mode}/${viewport.width} overflow`);
  assert.equal(fixture.requests.some(item => item.method === 'DELETE'), false);
  assert.deepEqual(errors, []);
  await page.close();
}

async function runLegacyStories(viewport) {
  const fixture = makeFixture('legacy-stories'), page = await browser.newPage({ viewport }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await routeFixture(page, fixture);
  await openFixture(page);
  const first = page.locator('[data-story-check]').first();await first.uncheck();
  assert.match(await page.locator('#storyList').textContent(), /ซ่อนข่าวที่ไม่ใช่ฟุตบอล 23 รายการ/);
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => { const button = document.querySelector('#loadMoreStories'); button.click(); button.click(); });
  for (let count = 0; count < 200 && fixture.storyPageCalls < 1; count += 1) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(fixture.storyPageCalls, 1, 'rapid activation shares one bounded story-page request');
  await page.locator('#manualImageUrl').focus();fixture.gates.stories.resolve();
  await page.waitForFunction(() => [...document.querySelectorAll('[data-story-check]')].some(input => input.value === '14425'));
  const result = await page.evaluate(() => ({
    activeId: document.activeElement?.id,
    firstChecked: document.querySelector('[data-story-check]')?.checked,
    loadedCount: [...document.querySelectorAll('[data-story-check]')].filter(input => input.value === '14425').length,
    optionCount: [...document.querySelectorAll('#manualStory option')].filter(option => option.value === '14425').length,
    text: document.querySelector('#storyList').textContent,
    scrollY,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(result.activeId, 'manualImageUrl', 'story response cannot steal focus moved while pending');
  assert.equal(result.firstChecked, false, 'unsaved first-page selection survives load-more rerender');
  assert.equal(result.loadedCount, 1);assert.equal(result.optionCount, 1);assert.match(result.text, /ซ่อนข่าวที่ไม่ใช่ฟุตบอล 24 รายการ/);assert.doesNotMatch(result.text, /ยังมีข่าวหน้าถัดไป/);
  stable(before, result.scrollY, `legacy-stories/${viewport.width} viewport`);assert.equal(result.scrollWidth, viewport.width);assert.equal(fixture.requests.filter(item => item.path.includes('story_cursor=24')).length,1);assert.equal(fixture.requests.some(item => ['POST','DELETE'].includes(item.method)),false);assert.deepEqual(errors,[]);await page.close();
}

try {
  const viewports = [{ width: 1440, height: 800 }, { width: 390, height: 844 }];
  for (const viewport of viewports) {
    for (const mode of ['terminal-ready', 'terminal-zero', 'retryable', 'success', 'omission', 'refresh-error', 'focus-moved', 'focus-during-refresh-terminal', 'focus-during-refresh-retryable']) await runCore(mode, viewport);
    for (const mode of ['same-project-newer', 'watcher-after-neutral', 'recovered-before', 'recovered-after', 'aba']) await runRace(mode, viewport);
    await runLegacyStories(viewport);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

console.log('PASS v0.20.144 installed-Chrome desktop/390 candidate-owned stale status reconciliation, authoritative proof, focus/viewport and job/project race fences');
