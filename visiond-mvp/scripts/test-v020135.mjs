import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import './test-v020135-live-show-delete.mjs';
import './test-v020135-live-show-delete-browser.mjs';

const root = new URL('../', import.meta.url);
const text = relative => readFile(new URL(relative, root), 'utf8');

const releasedVersion = (await text('VERSION.txt')).trim();
const assetVersion = releasedVersion === 'v0.20.136' ? '020136' : '020135';
assert.ok(['v0.20.135', 'v0.20.136'].includes(releasedVersion));
assert.ok((await text('public/index.html')).includes(`WEB ${releasedVersion}`));
assert.ok((await text('public/admin.html')).includes(`ADMIN ${releasedVersion}`));
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020135'], 'node scripts/test-v020135.mjs && npm run test:v020134');

const graph = await Promise.all([
  'public/live-center.html',
  'public/live-center.js',
  'public/live-package-open.html',
  'public/live-package-open.js',
  'public/live-package-ai-host.js',
  'public/live-package-player.js',
].map(text));
assert.equal(graph.some(source => source.includes(`?v=${assetVersion === '020136' ? '020135' : '020134'}`)), false, 'Live Center graph must not mix the previous cache key');
assert.ok(graph.every(source => source.includes(`?v=${assetVersion}`)), `every Live Center entry or nested module source carries the ${releasedVersion} cache key`);

const ledger = JSON.parse(await text('patch-ledgers/v0.20.135.json'));
assert.equal(ledger.version, 'v0.20.135');
assert.equal(ledger.feature, 'LIVE-CENTER-001');
assert.equal(ledger.release.status, 'patch_ready');
for (const required of [
  'migrations/0114_live_show_tombstones.sql',
  'functions/api/admin/live-center/shows/[id].js',
  'scripts/test-v020135-live-show-delete.mjs',
  'scripts/test-v020135-live-show-delete-browser.mjs',
]) assert.ok(ledger.files.includes(required), `${required} must be in the v0.20.135 release ledger`);

console.log('v0.20.135 release umbrella checks passed');
