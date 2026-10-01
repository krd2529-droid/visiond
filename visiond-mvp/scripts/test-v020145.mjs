import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import './test-v020145-vsport-soccer-media.mjs';
import './test-v020143-vsport-historical-images.mjs';
import './test-v020142-vsport-image-workflow-browser.mjs';
import './test-v020143-vsport-historical-images-browser.mjs';

const root = new URL('../', import.meta.url);
const text = relative => readFile(new URL(relative, root), 'utf8');
const [version, home, admin, html, foundation, api, client, css, migration, packageText, ledgerText] = await Promise.all([
  'VERSION.txt', 'public/index.html', 'public/admin.html', 'public/vsport.html',
  'functions/_vsport.js', 'functions/api/admin/vsport.js', 'public/vsport.js',
  'public/vsport.css', 'migrations/0117_vsport_headline_lookup.sql',
  'package.json', 'patch-ledgers/v0.20.145.json',
].map(text));
assert.ok(['v0.20.145','v0.20.146'].includes(version.trim()));
assert.ok(home.includes(`WEB ${version.trim()}`));
assert.ok(admin.includes(`ADMIN ${version.trim()}`));
const assetVersion=version.trim()==='v0.20.146'?'020146':'020145';
assert.match(html,new RegExp(`vsport\\.css\\?v=${assetVersion}`));
assert.match(html,new RegExp(`vsport\\.js\\?v=${assetVersion}`));
assert.match(foundation, /export const isSoccerEligibleNews/);
assert.match(foundation, /export function isLikelyContentImageUrl/);
assert.match(api, /thumbnail_headline_eligible/);
assert.match(api, /story_eligible/);
assert.match(client, /loadMoreCandidates/);
assert.match(client, /story_eligible/);
assert.match(css, /min-width:0/);
assert.match(migration, /idx_vsport_stories_project_headline/);
assert.equal(JSON.parse(packageText).scripts['test:v020145'], 'node scripts/test-v020145.mjs && npm run test:v020144');
const ledger = JSON.parse(ledgerText);
assert.equal(ledger.version, 'v0.20.145');
assert.equal(ledger.feature, 'VSPORT-001');
for (const required of ['functions/_vsport.js', 'functions/api/admin/vsport.js', 'public/vsport.js', 'public/vsport.css', 'migrations/0117_vsport_headline_lookup.sql', 'scripts/test-v020145-vsport-soccer-media.mjs', 'scripts/test-v020145.mjs']) {
  assert.ok(ledger.files.includes(required), required);
}
console.log('v0.20.145 V Sport soccer media release checks passed');
