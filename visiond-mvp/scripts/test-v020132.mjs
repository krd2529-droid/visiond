import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import './test-v020132-legacy-thai-voice.mjs';
import './test-v020132-legacy-thai-voice-browser.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const text = async path => (await read(path)).toString('utf8');
const sha256 = async path => createHash('sha256').update(await read(path)).digest('hex').toUpperCase();

assert.equal((await text('VERSION.txt')).trim(), 'v0.20.132');
assert.match(await text('public/index.html'), /WEB v0\.20\.132/);
assert.match(await text('public/admin.html'), /ADMIN v0\.20\.132/);
assert.match(await text('public/live-center.html'), /live-center\.css\?v=020132/);
assert.match(await text('public/live-center.html'), /live-center\.js\?v=020132/);

const openerHtml = await text('public/live-package-open.html');
const openerSource = await text('public/live-package-open.js');
const playerSource = await text('public/live-package-player.js');
const hostSource = await text('public/live-package-ai-host.js');
const presenterSource = await text('public/live-package-presenter.js');
const thaiSpeechSource = await text('public/live-package-thai-speech.js');
assert.match(openerHtml, /live-center\.css\?v=020132/);
assert.match(openerHtml, /live-package-open\.js\?v=020132/);
assert.match(openerSource, /resolveLiveAiPresenterPreset\(manifest\.show\.avatar\.preset\)/);
assert.match(presenterSource, /preset === 'none' \? 'visiond-default' : preset/);
assert.match(playerSource, /createThaiSpeechNarrator/);
assert.match(hostSource, /createThaiSpeechNarrator/);
assert.match(hostSource, /LIVE_HOST_THAI_VOICE_MISSING/);
assert.match(thaiSpeechSource, /voiceLanguage\(voice\) === 'th-th'/);
assert.match(thaiSpeechSource, /addEventListener\('voiceschanged'/);
assert.match(thaiSpeechSource, /removeEventListener\('voiceschanged'/);
assert.match(thaiSpeechSource, /THAI_VOICE_MISSING_MESSAGE/);
assert.doesNotMatch(thaiSpeechSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|https?:\/\//);
assert.doesNotMatch(`${playerSource}\n${hostSource}`, /status\s*===\s*['"]default['"]|\['thai',\s*'default'\]/);

const featureMap = await text('FEATURE-MAP.md');
assert.match(featureMap, /เลือก `th-TH` ก่อน `th-\*`/);
assert.match(featureMap, /package เก่า `none` เป็น `visiond-default`/);
assert.match(featureMap, /shared cancellable voice discovery/);
const ledger = JSON.parse(await text('patch-ledgers/v0.20.132.json'));
assert.equal(ledger.version, 'v0.20.132');
assert.ok(ledger.files.includes('public/live-package-thai-speech.js'));
assert.ok(ledger.files.includes('scripts/test-v020132-legacy-thai-voice-browser.mjs'));
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020132'], 'node scripts/test-v020132.mjs && npm run test:v020131');

assert.equal(await sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'schema-v1 parser remains byte-identical');
assert.equal(await sha256('functions/_live_center.js'), '2FD2240E4F413B3BDC57A325D5CAAE8412E1D057EA3DB2A51A5FEED3F047A9D0', 'private host server and D1/provider boundary remain byte-identical');
assert.equal(await sha256('public/vsport.js'), '1A257C80E9C734081FF3E56DE56A260F25DEB01FE6DD785C1A938C4986F2159F', 'vSport remains byte-identical');

console.log('v0.20.132 visible version, legacy AI presenter, Thai-only shared voice boundary and preservation checks passed');
