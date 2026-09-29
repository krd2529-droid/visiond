import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import './test-v020137-photo-avatar-consent-server.mjs';
import './test-v020137-photo-avatar-consent-browser.mjs';

const root = new URL('../', import.meta.url);
const read = relative => readFile(new URL(relative, root));
const text = async relative => (await read(relative)).toString('utf8');
const sha256 = async relative => createHash('sha256').update(await read(relative)).digest('hex').toUpperCase();

const releasedVersion = (await text('VERSION.txt')).trim();
const assetVersion = ['v0.20.138','v0.20.139','v0.20.140','v0.20.141','v0.20.142','v0.20.143'].includes(releasedVersion) ? '020138' : '020137';
assert.ok(['v0.20.137', 'v0.20.138', 'v0.20.139', 'v0.20.140', 'v0.20.141', 'v0.20.142', 'v0.20.143'].includes(releasedVersion));
assert.ok((await text('public/index.html')).includes(`WEB ${releasedVersion}`));
assert.ok((await text('public/admin.html')).includes(`ADMIN ${releasedVersion}`));
assert.equal(JSON.parse(await text('package.json')).scripts['test:v020137'], 'node scripts/test-v020137.mjs && npm run test:v020136');

const editorHtml = await text('public/live-center.html');
const editorCss = await text('public/live-center.css');
const editorSource = await text('public/live-center.js');
const photoPanel = editorHtml.slice(editorHtml.indexOf('<section id="photoPresenterPanel"'), editorHtml.indexOf('</section>', editorHtml.indexOf('<section id="photoPresenterPanel"')));
assert.equal((photoPanel.match(/<input\b[^>]*type="checkbox"/g) || []).length, 0);
for (const removedId of ['presenterRightsConsent', 'presenterAnimationConsent', 'presenterAuthorizedAdult']) {
  assert.doesNotMatch(editorHtml, new RegExp(removedId));
  assert.doesNotMatch(editorSource, new RegExp(removedId));
}
assert.match(photoPanel, /id="presenterConsentNotice"[^>]*>เมื่อกด “ยืนยันสิทธิ์และอัปโหลด” คุณรับรองว่ามีสิทธิ์ใช้รูป บุคคลในรูปเป็นผู้ใหญ่ที่อนุญาตให้ใช้ภาพ อนุญาตให้นำภาพไปสร้างภาพเคลื่อนไหว และไม่ใช่การเลียนแบบบุคคลสาธารณะ<\/p>/);
assert.match(photoPanel, /id="uploadPresenterPortrait"[^>]*type="button"[^>]*aria-describedby="presenterConsentNotice"[^>]*disabled>ยืนยันสิทธิ์และอัปโหลด<\/button>/);
assert.match(editorCss, /\.consent-notice\{/);
assert.doesNotMatch(editorCss, /\.consent-check\b/);
assert.match(editorSource, /LIVE_PORTRAIT_SOURCE_TYPES = new Set\(\['image\/jpeg', 'image\/png'\]\)/);
assert.match(editorSource, /selectedFile\.size > 0[\s\S]*selectedFile\.size <= LIVE_PORTRAIT_SOURCE_MAX_BYTES[\s\S]*LIVE_PORTRAIT_SOURCE_TYPES\.has/);
assert.match(editorSource, /uploadPresenterPortrait'\)\.disabled = portraitDisabled \|\| !validSelection/);
for (const [field, value] of [['rights_consent', 'accepted'], ['animation_consent', 'accepted'], ['identity_scope', 'authorized_adult'], ['consent_policy', 'visiond-live-portrait-consent-v1']]) {
  assert.match(editorSource, new RegExp(`form\\.set\\(['"]${field}['"], ['"]${value}['"]\\)`));
}
assert.equal(await sha256('functions/_live_portrait_foundation.js'), '2A9F0B807CECBF76F2EBB88BD939BDB1CA5B8BC710E4C3DFE56FE148DD95AFDB', 'strict backend consent/audit/idempotency implementation stays byte-identical');

assert.deepEqual([...editorHtml.matchAll(/data-workflow-step="(\d)"/g)].map(match => Number(match[1])), ['v0.20.138','v0.20.139','v0.20.140','v0.20.141','v0.20.142','v0.20.143'].includes(releasedVersion) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7, 8]);
assert.equal((editorHtml.match(/href="\/live-package-open\.html"/g) || []).length, 1);
assert.doesNotMatch(editorCss, /(?:^|[;{])\s*order\s*:/m, 'workflow order remains real DOM order');
const graph = await Promise.all([
  'public/live-center.html',
  'public/live-center.js',
  'public/live-package-open.html',
  'public/live-package-open.js',
  'public/live-package-ai-host.js',
  'public/live-package-player.js',
].map(text));
assert.equal(graph.some(source => source.includes(`?v=${assetVersion === '020138' ? '020137' : '020136'}`)), false, 'Live Center graph must not mix the previous cache key');
assert.ok(graph.every(source => source.includes(`?v=${assetVersion}`)), `every Live Center entry or nested module source carries the ${releasedVersion} cache key`);

const ledger = JSON.parse(await text('patch-ledgers/v0.20.137.json'));
assert.equal(ledger.version, 'v0.20.137');
assert.equal(ledger.feature, 'LIVE-CENTER-001');
for (const required of [
  'public/live-center.html',
  'public/live-center.css',
  'public/live-center.js',
  'scripts/test-v020137-photo-avatar-consent-server.mjs',
  'scripts/test-v020137-photo-avatar-consent-browser.mjs',
  'scripts/test-v020137.mjs',
]) assert.ok(ledger.files.includes(required), `${required} must be in the v0.20.137 release ledger`);

console.log('v0.20.137 Photo Avatar consent UI simplification release checks passed');
