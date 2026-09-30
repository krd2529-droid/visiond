import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import './test-v020134-live-photo-foundation.mjs';
import './test-v020134-live-audience-foundation.mjs';
import './test-v020134-live-photo-foundation-browser.mjs';

const root = new URL('../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

const releasedVersion = (await text('VERSION.txt')).trim();
assert.ok(['v0.20.134', 'v0.20.135', 'v0.20.136', 'v0.20.137', 'v0.20.138', 'v0.20.139', 'v0.20.140', 'v0.20.141', 'v0.20.142', 'v0.20.143','v0.20.144','v0.20.145'].includes(releasedVersion));
assert.ok((await text('public/index.html')).includes(`WEB ${releasedVersion}`));
assert.ok((await text('public/admin.html')).includes(`ADMIN ${releasedVersion}`));
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020134'], 'node scripts/test-v020134.mjs && npm run test:v020133');

console.log('v0.20.134 release umbrella checks passed');
