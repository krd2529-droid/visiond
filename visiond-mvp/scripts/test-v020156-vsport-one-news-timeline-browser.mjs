import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const candidate of ['C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright', 'playwright']) {
  try { ({ chromium } = require(candidate)); break; } catch {}
}
assert.ok(chromium, 'installed Chrome required');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
const scenario = process.argv[2] || 'team_only';
assert.ok(['generic', 'team_only', 'cover_only', 'cover_team', 'focus_team'].includes(scenario), `unknown scenario ${scenario}`);
const project = { id: 903, title: 'One real-news-shaped timeline repro', news_date: '2026-10-03', scope_mode: 'specific_team', team_name: 'แมนเชสเตอร์ ซิตี้', target_minutes: 30, target_seconds: 12, status: 'media_review', narration_script: 'ข่าวฟุตบอล แมนเชสเตอร์ ซิตี้ วันนี้', person_names_override: '', thumbnail_headline: 'ข่าวฟุตบอลวันนี้', thumbnail_subheadline: '', thumbnail_focus_text: '', thumbnail_focus_asset_id: null, thumbnail_palette: 'blue-white', thumbnail_layout: 'split', selected_story_ids: [101] };
if (scenario === 'focus_team') project.thumbnail_focus_asset_id = 9;
const story = { id: 101, team_name: 'แมนเชสเตอร์ ซิตี้', headline: 'Manchester City soccer news', summary: 'Premier League soccer', publisher: 'Channel 4', source_url: 'https://www.channel4.com/news/sport', selected: 1, sort_order: 1, published_at: '2026-10-03T00:00:00Z', retrieved_at: '2026-10-03T00:00:00Z' };
const assets = [9, 10].map((id, index) => ({ id, story_id: 101, candidate_id: id + 100, source_url: `https://commons.wikimedia.org/wiki/File:Fixture_${id}.jpg`, source_page_url: `https://commons.wikimedia.org/wiki/File:Fixture_${id}.jpg`, publisher: 'Wikimedia Commons', mime_type: 'image/png', file_size: 1000, width: 640, height: 360, person_name: '', subject_kind: '', subject_name: '', script_hash: '', license_code: 'CC0', identity_confirmed: 0, story_association: 'selected_story', story_eligible: true, preview_url: `/api/admin/vsport-assets/${id}`, fixture_color: index ? '#1c86c8' : '#dd7638' }));
const scriptHash = createHash('sha256').update(project.narration_script.trim()).digest('hex');
if (['team_only', 'cover_team', 'focus_team'].includes(scenario)) {
  const teamAssets = scenario === 'team_only' ? assets : [assets[1]];
  for (const asset of teamAssets) Object.assign(asset, { subject_kind: 'team', subject_name: 'แมนเชสเตอร์ ซิตี้', script_hash: scriptHash });
}
if (['cover_only', 'cover_team'].includes(scenario)) assets[0].story_association = 'news_cover';
const send = (response, body) => { response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'private, no-store' }); response.end(JSON.stringify(body)); };
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/api/auth/me') return send(response, { user: { id: 903, role: 'admin' } });
  if (url.pathname === '/api/admin/vsport' && url.searchParams.has('jobs_project')) return send(response, { jobs: [] });
  if (url.pathname === '/api/admin/vsport' && url.searchParams.has('id')) return send(response, { project, stories: [story], candidates: [], assets, story_pagination: { limit: 24, has_more: false, next_cursor: null }, media_pagination: { candidates: { limit: 24, has_more: false, next_cursor: null }, assets: { limit: 24, has_more: false, next_cursor: null } } });
  if (url.pathname === '/api/admin/vsport') return send(response, { items: [project], pagination: { limit: 24, has_more: false, next_cursor: null } });
  if (url.pathname.startsWith('/api/admin/vsport-assets/')) {
    const id = Number(url.pathname.split('/').at(-1)), asset = assets.find(item => item.id === id);
    if (!asset) { response.writeHead(404); return response.end(); }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="${asset.fixture_color}"/></svg>`;
    response.writeHead(200, { 'content-type': 'image/svg+xml' }); return response.end(svg);
  }
  const relative = url.pathname === '/' ? '/vsport.html' : url.pathname, local = path.resolve(root, `.${relative}`);
  if (!local.startsWith(root) || !fs.existsSync(local)) { response.writeHead(404); return response.end('not found'); }
  response.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[path.extname(local)] || 'application/octet-stream');
  response.end(fs.readFileSync(local));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/vsport.html`);
  await page.getByRole('button', { name: /เปิดทำต่อ/ }).click();
  await page.waitForSelector('#workspace:not([hidden])');
  await page.waitForFunction(() => document.querySelectorAll('.asset-card[data-ready="true"]').length === 2);
  assert.equal(await page.locator('[data-story-check]:checked').count(), 1);
  assert.equal(await page.locator('.asset-card[data-ready="true"]').count(), 2);
  assert.equal(await page.locator('#targetSeconds').inputValue(), '12');
  await page.locator('#planTimeline').click();
  const status = await page.locator('#mediaStatus').innerText();
  const rows = await page.locator('#timelineList tbody tr').count();
  console.log(JSON.stringify({ scenario, selectedStories: 1, decodedReadyAssets: 2, targetSeconds: 12, rows, status, browserErrors: errors }, null, 2));
  assert.deepEqual(errors, [], 'no browser exception should explain the failure');
  const expectedRows = ['team_only', 'cover_team', 'focus_team'].includes(scenario) ? 2 : 0;
  assert.equal(rows, expectedRows, 'only script-matched subjects from the selected story can form the silent timeline');
  if (expectedRows) assert.deepEqual(await page.locator('#timelineList tbody tr td:nth-child(2)').allTextContents(), ['9', '10']);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
