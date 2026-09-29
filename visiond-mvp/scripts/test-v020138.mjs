import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  claimLocalAudienceEvent,
  createLocalAudienceEvent,
  listLocalAudienceQueue,
  startLocalAudienceSession,
} from '../functions/_live_audience_foundation.js';

import './test-v020138-live-center-local-test-removal-browser.mjs';

const root = new URL('../', import.meta.url);
const text = relative => readFile(new URL(relative, root), 'utf8');

const releasedVersion=(await text('VERSION.txt')).trim();assert.ok(['v0.20.138','v0.20.139','v0.20.140','v0.20.141','v0.20.142','v0.20.143'].includes(releasedVersion));
assert.ok((await text('public/index.html')).includes(`WEB ${releasedVersion}`));
assert.ok((await text('public/admin.html')).includes(`ADMIN ${releasedVersion}`));
const packageJson = JSON.parse(await text('package.json'));
assert.equal(packageJson.scripts['test:v020138'], 'node scripts/test-v020138.mjs && npm run test:v020137');

const editorHtml = await text('public/live-center.html');
const editorCss = await text('public/live-center.css');
const editorSource = await text('public/live-center.js');
const audienceSource = await text('functions/_live_audience_foundation.js');
const pagesConfig = await text('wrangler.toml');
const pagesConfigExample = await text('wrangler.toml.example');
const featureMap = await text('FEATURE-MAP.md');
assert.deepEqual([...editorHtml.matchAll(/data-workflow-step="(\d)"/g)].map(match => Number(match[1])), [1, 2, 3, 4, 5, 6, 7]);
assert.match(editorHtml, /ทำตามขั้นตอน 1–7/);
assert.match(editorHtml, /data-workflow-step="6"[\s\S]*ขั้นตอนที่ 6 · สร้างและดาวน์โหลด/);
assert.match(editorHtml, /data-workflow-step="7"[\s\S]*ขั้นตอนที่ 7 · เปิดไฟล์ที่ดาวน์โหลด/);
assert.equal((editorHtml.match(/href="\/live-package-open\.html"/g) || []).length, 1);
for (const token of [
  'audienceTestPanel', 'audienceQueueCount', 'audienceEventKind', 'audienceViewerLabel',
  'audienceProduct', 'audienceQuestion', 'startAudienceTest', 'sendAudienceTest',
  'claimAudienceTest', 'stopAudienceTest', 'audienceTestAnswer', 'audienceStatus',
  'LOCAL TEST', 'Local Test', 'ทดสอบคำทักทายและ Q&amp;A',
]) assert.doesNotMatch(editorHtml, new RegExp(token));
for (const token of [
  'live-audience-queue', 'createLiveAudienceQueue', 'audienceEventAttempt', 'audienceBusy',
  'audienceQueued', 'localSession', 'localStopAttempt', 'stopSession', 'stopLocalSessionInBackground', '/audience/',
]) assert.doesNotMatch(editorSource, new RegExp(token.replaceAll('/', '\\/')));
for (const token of ['audience-test-grid', 'audience-question', 'audience-test-answer']) assert.doesNotMatch(editorCss, new RegExp(token));
assert.doesNotMatch(editorCss, /(?:^|[;{])\s*order\s*:/m);
assert.doesNotMatch(pagesConfig, /LIVE_CENTER_LOCAL_TEST_ENABLED/);
assert.doesNotMatch(pagesConfigExample, /LIVE_CENTER_LOCAL_TEST_ENABLED/);
assert.match(featureMap, /Local Test ถูกถอดจาก DOM\/client\/cache graph/);
assert.match(featureMap, /start\/create\/list\/claim จึง fail closed/);

let authReads = 0;
const disabledContext = (path, method = 'POST') => ({
  request: new Request(`https://example.test${path}`, {
    method,
    headers: { cookie: 'vd_session=retired-local-test-session', 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : '{}',
  }),
  params: { id: `live_${'a'.repeat(32)}` },
  env: {
    DB: {
      prepare(sql) {
        authReads += 1;
        assert.match(sql, /FROM sessions s JOIN users u/);
        return {
          bind() { return this; },
          async first() { return { id: 138, role: 'boss', is_course_owner: 0 }; },
        };
      },
    },
  },
});
for (const [name, invoke] of [
  ['start', () => startLocalAudienceSession(disabledContext('/api/admin/live-center/shows/retired/audience/local-session'))],
  ['create', () => createLocalAudienceEvent(disabledContext('/api/admin/live-center/shows/retired/audience/local-events'))],
  ['list', () => listLocalAudienceQueue(disabledContext('/api/admin/live-center/shows/retired/audience/queue', 'GET'))],
  ['claim', () => claimLocalAudienceEvent(disabledContext('/api/admin/live-center/shows/retired/audience/queue/claim'))],
]) {
  const response = await invoke();
  assert.equal(response.status, 503, `${name} must fail closed when the Production binding is absent`);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.json()).code, 'LIVE_LOCAL_TEST_DISABLED');
}
assert.equal(authReads, 4, 'each retired creation/list/claim route authorizes once and performs no show/event query');
const stopSection = audienceSource.slice(
  audienceSource.indexOf('export async function stopLocalAudienceSession'),
  audienceSource.indexOf('async function existingEvent'),
);
const completeSection = audienceSource.slice(audienceSource.indexOf('export async function completeLocalAudienceEvent'));
assert.doesNotMatch(stopSection, /requireLocalTest/, 'historical session stop cleanup stays callable');
assert.doesNotMatch(completeSection, /requireLocalTest/, 'historical claim completion cleanup stays callable');
for (const retained of [
  'migrations/0113_live_photo_avatar_audience.sql',
  'functions/_live_audience_foundation.js',
  'functions/api/admin/live-center/shows/[id]/audience/local-session.js',
  'functions/api/admin/live-center/shows/[id]/audience/local-events.js',
  'functions/api/admin/live-center/shows/[id]/audience/queue.js',
  'functions/api/admin/live-center/shows/[id]/audience/queue/claim.js',
]) await readFile(new URL(retained, root));

const graph = await Promise.all([
  'public/live-center.html',
  'public/live-center.js',
  'public/live-package-open.html',
  'public/live-package-open.js',
  'public/live-package-ai-host.js',
  'public/live-package-player.js',
].map(text));
assert.equal(graph.some(source => source.includes('?v=020137')), false, 'Live Center graph must not mix the prior cache key');
assert.ok(graph.every(source => source.includes('?v=020138')), 'every active Live Center entry or nested module source carries v0.20.138');

const ledger = JSON.parse(await text('patch-ledgers/v0.20.138.json'));
assert.equal(ledger.version, 'v0.20.138');
assert.equal(ledger.feature, 'LIVE-CENTER-001');
for (const required of [
  'public/live-center.html',
  'public/live-center.css',
  'public/live-center.js',
  'wrangler.toml',
  'wrangler.toml.example',
  'scripts/test-v020138-live-center-local-test-removal-browser.mjs',
  'scripts/test-v020138.mjs',
]) assert.ok(ledger.files.includes(required), `${required} must be in the v0.20.138 ledger`);

console.log('v0.20.138 Local Test retirement release checks passed');
