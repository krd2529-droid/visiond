import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import './test-v020136-live-center-workflow-browser.mjs';

const root = new URL('../', import.meta.url);
const text = relative => readFile(new URL(relative, root), 'utf8');

const releasedVersion = (await text('VERSION.txt')).trim();
const assetVersion = ['v0.20.138','v0.20.139','v0.20.140','v0.20.141','v0.20.142'].includes(releasedVersion) ? '020138' : releasedVersion === 'v0.20.137' ? '020137' : '020136';
assert.ok(['v0.20.136', 'v0.20.137', 'v0.20.138', 'v0.20.139', 'v0.20.140', 'v0.20.141', 'v0.20.142'].includes(releasedVersion));
assert.ok((await text('public/index.html')).includes(`WEB ${releasedVersion}`));
assert.ok((await text('public/admin.html')).includes(`ADMIN ${releasedVersion}`));
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020136'], 'node scripts/test-v020136.mjs && npm run test:v020135');

const editorHtml = await text('public/live-center.html');
const editorCss = await text('public/live-center.css');
assert.deepEqual([...editorHtml.matchAll(/data-workflow-step="(\d)"/g)].map(match => Number(match[1])), ['v0.20.138','v0.20.139','v0.20.140','v0.20.141','v0.20.142'].includes(releasedVersion) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7, 8]);
assert.match(editorHtml, /id="saveShow"[^>]*type="submit"[^>]*form="showForm"/);
assert.equal((editorHtml.match(/href="\/live-package-open\.html"/g) || []).length, 1);
assert.doesNotMatch(editorHtml.match(/<header[\s\S]*?<\/header>/)?.[0] || '', /live-package-open\.html/);
assert.doesNotMatch(editorCss, /(?:^|[;{])\s*order\s*:/m, 'workflow order must come from DOM, not CSS order');

const graph = await Promise.all([
  'public/live-center.html',
  'public/live-center.js',
  'public/live-package-open.html',
  'public/live-package-open.js',
  'public/live-package-ai-host.js',
  'public/live-package-player.js',
].map(text));
assert.equal(graph.some(source => source.includes(`?v=${assetVersion === '020138' ? '020137' : assetVersion === '020137' ? '020136' : '020135'}`)), false, 'Live Center graph must not mix the previous cache key');
assert.ok(graph.every(source => source.includes(`?v=${assetVersion}`)), `every Live Center entry or nested module source carries the ${releasedVersion} cache key`);

const ledger = JSON.parse(await text('patch-ledgers/v0.20.136.json'));
assert.equal(ledger.version, 'v0.20.136');
assert.equal(ledger.feature, 'LIVE-CENTER-001');
for (const required of [
  'public/live-center.html',
  'public/live-center.css',
  'scripts/test-v020136-live-center-workflow-browser.mjs',
  'scripts/test-v020136.mjs',
]) assert.ok(ledger.files.includes(required), `${required} must be in the v0.20.136 release ledger`);

console.log('v0.20.136 release umbrella checks passed');
