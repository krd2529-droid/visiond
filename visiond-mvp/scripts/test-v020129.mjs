import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import './test-v020129-live-player-browser.mjs';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const text = async path => (await read(path)).toString('utf8');
const sha256 = async path => createHash('sha256').update(await read(path)).digest('hex').toUpperCase();

const releasedVersion=(await text('VERSION.txt')).trim();assert.ok(['v0.20.129','v0.20.130','v0.20.131','v0.20.132','v0.20.133','v0.20.134','v0.20.135','v0.20.136','v0.20.137','v0.20.138','v0.20.139'].includes(releasedVersion));
assert.match(await text('public/index.html'), /WEB v0\.20\.(?:129|130|131|132|133|134|135|136|137|138|139)/);
assert.match(await text('public/admin.html'), /ADMIN v0\.20\.(?:129|130|131|132|133|134|135|136|137|138|139)/);
assert.match(await text('public/live-center.html'), /live-center\.css\?v=020(?:129|130|131|132|133|134|135|136|137|138)/);
assert.match(await text('public/live-center.html'), /live-center\.js\?v=020(?:129|130|131|132|133|134|135|136|137|138)/);
const openerHtml = await text('public/live-package-open.html');
assert.match(openerHtml, /live-center\.css\?v=020(?:129|130|131|132|133|134|135|136|137|138)/);
assert.match(openerHtml, /live-package-open\.js\?v=020(?:129|130|131|132|133|134|135|136|137|138)/);
for (const id of ['startPlayback', 'stopPlayback', 'restartPlayback', 'openCountdown', 'obsMode', 'obsStage']) {
  assert.match(openerHtml, new RegExp(`id="${id}"`));
}
const obsSurface = openerHtml.slice(openerHtml.indexOf('<section id="obsStage"'), openerHtml.indexOf('</section>', openerHtml.indexOf('<section id="obsStage"')));
assert.doesNotMatch(obsSurface, /<button|<input|<textarea|<select|openScript/, 'OBS surface must not contain script or controls');
const openerSource = await text('public/live-package-open.js');
const playerSource = await text('public/live-package-player.js');
assert.match(openerSource, /createLocalSpeechNarrator\(window\)/);
assert.match(openerSource, /pendingFullscreenExit/);
assert.match(playerSource, /globalThis\.performance\?\.now/);
assert.match(playerSource, /stop-expired/);
assert.doesNotMatch(playerSource, /\bfetch\s*\(|XMLHttpRequest|WebSocket/, 'offline player runtime must remain network-free');
assert.match(openerSource, /photoPrivateRequest/);
const css = await text('public/live-center.css');
assert.match(css, /@keyframes live-scene-fade/);
assert.match(css, /\.obs-stage:fullscreen/);
const featureMap = await text('FEATURE-MAP.md');
assert.match(featureMap, /monotonic countdown/);
assert.match(featureMap, /OBS local surface/);
assert.equal(JSON.parse(await text('patch-ledgers/v0.20.129.json')).version, 'v0.20.129');
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020129'], 'node scripts/test-v020129.mjs && npm run test:v020128');
assert.equal(await sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'schema-v1 package parser must remain byte-identical');

const unchangedVsport = {
  'migrations/0111_vsport.sql': '0AD1F2DA8B5833615BAE8967A7953CB75F83CE9ABEBAC12E5F1E4CEC2321A59D',
  'functions/_vsport.js': releasedVersion === 'v0.20.139' ? '9089691CDA6DEB576E41359E4991219DF660B6C76EEA13B626C8DC75A6A7C6AF' : '976BFECEC019BE414734B4DC8DD8B75E3C9C6B06690B4F105426CD333B5FA2B5',
  'functions/api/admin/vsport.js': releasedVersion === 'v0.20.139' ? '139A8A453F3AEE4284458BDC8881BFC3FDB18FE9477CB87C6B4DBB77F3CC1488' : 'C695DDC0A71B9C7300D1E52C910BF07F85583439B733B6B006E26D3154A9322E',
  'functions/api/admin/vsport-assets/[id].js': '6BEF06AD1B137C56707D6F01CE0F86777CB79D8D6EFF108C763F9C07EAB4A434',
  'public/vsport.html': releasedVersion === 'v0.20.139' ? 'B8D5444993682CD85EE67FCB599F17235F1B3A760D859D60B3D9755A1A07E0C1' : '7F4315D8ECD75762D15B31224F763561FA98DF71A5020A21965ABBC4F7A21ABC',
  'public/vsport.css': '262CE0A73E4044B3F2FEABBD4DE65C5C98D635EDFD44AAABFEF2B395111A0EFC',
  'public/vsport.js': releasedVersion === 'v0.20.139' ? 'A76A02B528D30B6DB390586E7515BCF674A045EAEA88FDFD69DB51B572AE208B' : '1A257C80E9C734081FF3E56DE56A260F25DEB01FE6DD785C1A938C4986F2159F',
  'scripts/test-v020124-vsport-news.mjs': releasedVersion === 'v0.20.139' ? '44CF43323EFE25205651546456AA2463765701B1B4231EABBB8561833E788931' : '4924FD3925702A27219C7982EB59B47D80E2B19221D4FAF3D1BD074AA3D70CF1',
};
for (const [path, expected] of Object.entries(unchangedVsport)) assert.equal(await sha256(path), expected, `${path} must remain byte-identical`);

console.log('v0.20.129 visible version, local-only player surface, parser and vSport byte-identity checks passed');
