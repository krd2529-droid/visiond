import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import './test-v020131-human-presenter-browser.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const text = async path => (await read(path)).toString('utf8');
const sha256 = async path => createHash('sha256').update(await read(path)).digest('hex').toUpperCase();

assert.ok(['v0.20.131', 'v0.20.132', 'v0.20.133'].includes((await text('VERSION.txt')).trim()));
assert.match(await text('public/index.html'), /WEB v0\.20\.(?:131|132|133)/);
assert.match(await text('public/admin.html'), /ADMIN v0\.20\.(?:131|132|133)/);
assert.match(await text('public/live-center.html'), /live-center\.css\?v=020(?:131|132|133)/);
assert.match(await text('public/live-center.html'), /live-center\.js\?v=020(?:131|132|133)/);

const openerHtml = await text('public/live-package-open.html');
const openerSource = await text('public/live-package-open.js');
const hostSource = await text('public/live-package-ai-host.js');
const presenterSource = await text('public/live-package-presenter.js');
const thaiSpeechSource = await text('public/live-package-thai-speech.js');
const playerSource = await text('public/live-package-player.js');
const css = await text('public/live-center.css');
assert.match(openerHtml, /live-center\.css\?v=020(?:131|132|133)/);
assert.match(openerHtml, /live-package-open\.js\?v=020(?:131|132|133)/);
for (const id of ['aiPresenterPreview', 'aiPresenterStateLabel', 'obsPresenter', 'obsAiHost', 'obsLiveCaption']) {
  assert.match(openerHtml, new RegExp(`id="${id}"`));
}
assert.doesNotMatch(`${openerHtml}\n${css}`, /obs-ai-orb/);
for (const anatomy of ['presenter-face', 'presenter-mouth', 'presenter-torso', 'presenter-arm-left', 'presenter-arm-right']) {
  assert.match(`${presenterSource}\n${css}`, new RegExp(anatomy));
}
for (const state of ['idle', 'thinking', 'talk', 'present', 'open', 'cheer', 'paused', 'error']) {
  assert.match(presenterSource, new RegExp(`['"]${state}['"]`));
}
assert.match(openerSource, /manifest\.show\.avatar\.preset/);
assert.match(openerSource, /createLiveHumanPresenter/);
assert.match(openerSource, /presenter\?\.startSpeaking/);
assert.match(`${hostSource}\n${thaiSpeechSource}`, /utterance\.onstart\s*=\s*\(\)\s*=>/);
assert.match(hostSource, /handleSpeechStart/);
assert.match(hostSource, /token\.started/);
assert.match(css, /prefers-reduced-motion:reduce/);
assert.match(css, /data-presenter-visible="false"/);
assert.doesNotMatch(presenterSource, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|https?:\/\//);

const featureMap = await text('FEATURE-MAP.md');
assert.match(featureMap, /half-body SVG presenter/);
assert.match(featureMap, /utterance\.onstart/);
assert.match(featureMap, /visiond-default/);
assert.match(featureMap, /reduced-motion/);
assert.equal(JSON.parse(await text('patch-ledgers/v0.20.131.json')).version, 'v0.20.131');
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020131'], 'node scripts/test-v020131.mjs && npm run test:v020130');

assert.equal(await sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'schema-v1 parser must remain byte-identical');
assert.ok(await sha256('public/live-package-player.js') === '1EF48EB00CAC02ABF925F49618DABCF782C1D816A5BE0DF12289A416E3665D9C'
  || (/createThaiSpeechNarrator/.test(playerSource) && !/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(playerSource)), 'v0.20.132 may connect the offline player only to the network-free Thai narrator');

console.log('v0.20.131 visible version, genuine-speech human presenter, release ledger and offline byte-identity checks passed');
