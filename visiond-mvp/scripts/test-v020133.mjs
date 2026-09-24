import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import './test-v020133-live-esm-cache.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const text = async path => (await read(path)).toString('utf8');
const sha256 = async path => createHash('sha256').update(await read(path)).digest('hex').toUpperCase();
const sha256Text = value => createHash('sha256').update(value).digest('hex').toUpperCase();

assert.equal((await text('VERSION.txt')).trim(), 'v0.20.133');
assert.match(await text('public/index.html'), /WEB v0\.20\.133/);
assert.match(await text('public/admin.html'), /ADMIN v0\.20\.133/);
assert.match(await text('public/live-center.html'), /live-center\.css\?v=020133/);
assert.match(await text('public/live-center.html'), /live-center\.js\?v=020133/);

const openerHtml = await text('public/live-package-open.html');
const openerSource = await text('public/live-package-open.js');
const hostSource = await text('public/live-package-ai-host.js');
const playerSource = await text('public/live-package-player.js');
assert.match(openerHtml, /live-center\.css\?v=020133/);
assert.match(openerHtml, /live-package-open\.js\?v=020133/);
for (const dependency of [
  'live-center-package.js',
  'live-package-ai-host.js',
  'live-package-presenter.js',
  'live-package-player.js',
  'live-package-thai-speech.js',
]) {
  assert.match(openerSource, new RegExp(`from ['"]\\./${dependency.replace('.', '\\.')}\\?v=020133['"]`), `${dependency} must share the entry cache key`);
}
for (const source of [hostSource, playerSource]) {
  assert.match(source, /from ['"]\.\/live-package-thai-speech\.js\?v=020133['"]/);
  assert.doesNotMatch(source, /from ['"]\.\/live-package-thai-speech\.js['"]/);
}
assert.equal((openerSource.match(/\?v=020133/g) || []).length, 5, 'every direct opener ESM edge is versioned exactly once');
assert.doesNotMatch(openerSource, /from ['"]\.\/(?:live-center-package|live-package-(?:ai-host|presenter|player|thai-speech))\.js['"]/);

const featureMap = await text('FEATURE-MAP.md');
assert.match(featureMap, /static ESM dependency ทุก edge/);
assert.match(featureMap, /returning browser/);
const ledger = JSON.parse(await text('patch-ledgers/v0.20.133.json'));
assert.equal(ledger.version, 'v0.20.133');
assert.ok(ledger.files.includes('scripts/test-v020133-live-esm-cache.mjs'));
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020133'], 'node scripts/test-v020133.mjs && npm run test:v020132');

assert.equal(sha256Text(openerSource.replaceAll('?v=020133', '')), '5009F3FBF1DB8DF3A5F27878469C6FCAC92737C60240CB9255439FCDEC739CD2', 'opener product logic differs from v0.20.132 only by ESM cache keys');
assert.equal(sha256Text(hostSource.replaceAll('?v=020133', '')), '6137635C82CC3CE86154410101E035BD04A32D2BD9D49702DFCC67AD40B9673D', 'AI host logic differs from v0.20.132 only by its shared-module cache key');
assert.equal(sha256Text(playerSource.replaceAll('?v=020133', '')), '00C0DFECBCDA546DD30965E18577B53977E090FD4DD4CB99CB909F28C5EA381E', 'offline player logic differs from v0.20.132 only by its shared-module cache key');
assert.equal(await sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'schema-v1 parser remains byte-identical');
assert.equal(await sha256('public/live-package-presenter.js'), '9104B066C7FA668AE68884C2B7C453F9938AD9D0CE1B339F7BA879A7217DB9DB', 'presenter remains byte-identical');
assert.equal(await sha256('public/live-package-thai-speech.js'), '29205FB148CC96585795B4CD3E8C8CEE7A1B11889E1482308C6986740D0822D8', 'Thai narrator remains byte-identical');
assert.equal(await sha256('functions/_live_center.js'), '2FD2240E4F413B3BDC57A325D5CAAE8412E1D057EA3DB2A51A5FEED3F047A9D0', 'private host server remains byte-identical');
assert.equal(await sha256('public/vsport.js'), '1A257C80E9C734081FF3E56DE56A260F25DEB01FE6DD785C1A938C4986F2159F', 'vSport remains byte-identical');

console.log('v0.20.133 versioned ESM graph, returning-cache recovery and v0.20.132 behavior preservation checks passed');
