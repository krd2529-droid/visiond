import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { LIVE_AUDIENCE_SOURCE_LABELS, createLiveAudienceQueue } from '../public/live-audience-queue.js';
import { LIVE_PHOTO_AVATAR_PHASES, createExactAudioAvatarController } from '../public/live-photo-avatar.js';
import { LIVE_AUDIENCE_UNKNOWN_ANSWER, groundLiveAudienceAnswer } from '../functions/_live_audience_foundation.js';
import { createLiveAvatarAdapter, liveExternalIntegrationHealth } from '../functions/_live_avatar_provider.js';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const sha256 = relative => createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex').toUpperCase();

assert.equal(read('VERSION.txt').trim(), 'v0.20.134');
assert.match(read('public/index.html'), /WEB v0\.20\.134/);
assert.match(read('public/admin.html'), /ADMIN v0\.20\.134/);
assert.equal(sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'package schema-v1 parser stays byte-identical');
assert.equal(sha256('.codex/active-work.md'), 'F390B44976E3B759C6C0807484C5EFA970496ED7E3D2852EDD99F71A077056A4', 'pre-existing active-work stays byte-identical');
assert.equal(sha256('public/vsport.js'), '1A257C80E9C734081FF3E56DE56A260F25DEB01FE6DD785C1A938C4986F2159F', 'vSport stays byte-identical');

const editorHtml = read('public/live-center.html');
const editorSource = read('public/live-center.js');
const openerHtml = read('public/live-package-open.html');
const openerSource = read('public/live-package-open.js');
const hostSource = read('public/live-package-ai-host.js');
const playerSource = read('public/live-package-player.js');
const portraitSource = read('functions/_live_portrait_foundation.js');
const audienceSource = read('functions/_live_audience_foundation.js');
const migration = read('migrations/0113_live_photo_avatar_audience.sql');
const workerSource = read('workers/live-portrait-sanitizer/src/index.js');
const workerConfig = read('workers/live-portrait-sanitizer/wrangler.toml');
const pagesConfig = read('wrangler.toml');
const pagesConfigExample = read('wrangler.toml.example');
const featureMap = read('FEATURE-MAP.md');
const packageJson = JSON.parse(read('package.json'));

for (const id of [
  'presenterPortrait', 'presenterRightsConsent', 'presenterAnimationConsent', 'presenterAuthorizedAdult',
  'uploadPresenterPortrait', 'deletePresenterPortrait', 'integrationHealthList', 'audienceTestPanel',
  'startAudienceTest', 'sendAudienceTest', 'claimAudienceTest', 'stopAudienceTest',
]) assert.match(editorHtml, new RegExp(`id="${id}"`), `${id} must be connected in the Boss/Admin editor`);
assert.match(editorHtml, /LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม/);
assert.match(editorHtml, /live-center\.css\?v=020134/);
assert.match(editorHtml, /live-center\.js\?v=020134/);
for (const token of ['portraitUploadAttempt', 'portraitDeleteAttempt', 'audienceEventAttempt', 'sourceHash', 'derivativeHash', 'createLiveAudienceQueue']) {
  assert.match(editorSource, new RegExp(token));
}
assert.match(editorSource, /eventId: `local\.event\./);
assert.match(editorSource, /LIVE_FOUNDATION_REQUEST_TIMEOUT_MS = 15_000/);
assert.match(editorSource, /if \(signal\?\.aborted\) throw error/);
assert.match(editorSource, /LIVE_FOUNDATION_TIMEOUT/);
assert.doesNotMatch(editorSource, /EventSource\s*\(|WebSocket\s*\(|facebook\.com|graph\.facebook/i, 'the editor must not invent a platform event stream');

for (const id of [
  'photoAvatarPanel', 'activatePhotoAvatar', 'useLegacyPresenter', 'photoAvatarPreviewVideo',
  'obsPhotoAvatarSlot', 'obsPhotoAvatarVideo', 'obsPhotoAvatarFallback',
]) assert.match(openerHtml, new RegExp(`id="${id}"`), `${id} must be connected in preview/OBS`);
assert.match(openerHtml, /<video id="photoAvatarPreviewVideo"/);
assert.match(openerHtml, /<video id="obsPhotoAvatarVideo"/);
assert.match(openerHtml, /ยังไม่ได้เชื่อมต่อ/);
assert.match(openerSource, /createExactAudioAvatarController/);
assert.match(openerSource, /visible && !photoAvatarRequested/);
assert.match(openerSource, /aiPhase === 'error' \|\| photoAvatarRequested/);
assert.match(openerSource, /session_contract_verified/);
assert.match(openerSource, /LIVE_AVATAR_SESSION_CONTRACT_UNAVAILABLE/);
assert.match(openerSource, /LIVE_PHOTO_PRIVATE_TIMEOUT_MS = 15_000/);
assert.match(openerSource, /LIVE_PHOTO_TIMEOUT/);
assert.doesNotMatch(openerSource, /RTCPeerConnection|setRemoteDescription|createAnswer/, 'unverified provider session fields must not be invented');

assert.match(openerHtml, /live-center\.css\?v=020134/);
assert.match(openerHtml, /live-package-open\.js\?v=020134/);
for (const dependency of [
  'live-center-package.js', 'live-package-ai-host.js', 'live-package-presenter.js',
  'live-package-player.js', 'live-package-thai-speech.js', 'live-photo-avatar.js',
]) {
  const escaped = dependency.replaceAll('.', '\\.');
  assert.match(openerSource, new RegExp(`from ['"]\\./${escaped}\\?v=020134['"]`), `${dependency} must use the v0.20.134 module key`);
}
assert.match(hostSource, /live-package-thai-speech\.js\?v=020134/);
assert.match(playerSource, /live-package-thai-speech\.js\?v=020134/);

for (const table of [
  'live_presenter_assets', 'live_presenter_bindings', 'live_portrait_upload_claims',
  'live_portrait_object_cleanup_jobs', 'live_runtime_sessions', 'live_provider_resources', 'live_audience_events',
]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
for (const index of [
  'idx_live_presenter_active_show_owner', 'idx_live_portrait_upload_claim_retention',
  'idx_live_runtime_owner_show_status_cursor', 'idx_live_audience_ready_queue', 'idx_live_audience_owner_show_expiry',
]) assert.match(migration, new RegExp(`CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ${index}\\b`));
assert.match(migration, /idx_live_portrait_upload_claim_retention\s+ON live_portrait_upload_claims\(owner_id,\s*show_id,\s*status,\s*expires_at,\s*id\)/);
assert.match(migration, /CHECK\(mode IN \('avatar','local_test','facebook'\)\)/);
assert.match(portraitSource, /PORTRAIT_SANITIZER\.fetch/);
assert.match(portraitSource, /x-visiond-sanitizer/);
assert.match(portraitSource, /cleanupExpiredPortraitUploadClaims/);
assert.match(portraitSource, /platform_live_start:\s*false/);
assert.match(audienceSource, /LIMIT 24/);
assert.match(audienceSource, /LIVE_AUDIENCE_REDACTED_VIEWER_HASH/);
assert.match(audienceSource, /live_show_scenes/);

assert.match(workerConfig, /workers_dev\s*=\s*false/);
assert.match(workerConfig, /preview_urls\s*=\s*false/);
assert.match(workerConfig, /\[images\][\s\S]*binding\s*=\s*"IMAGES"/);
assert.match(pagesConfig, /\[\[env\.production\.services\]\][\s\S]*binding\s*=\s*"PORTRAIT_SANITIZER"[\s\S]*service\s*=\s*"visiond-live-portrait-sanitizer"/);
assert.match(pagesConfig, /\[env\.production\.vars\][\s\S]*LIVE_CENTER_LOCAL_TEST_ENABLED\s*=\s*"1"/);
assert.match(pagesConfigExample, /\[vars\][\s\S]*LIVE_CENTER_LOCAL_TEST_ENABLED\s*=\s*"1"/);
for (const name of [
  'LIVE_CENTER_PROVIDER_ENCRYPTION_KEY', 'DID_BASIC_AUTHORIZATION',
  'AZURE_SPEECH_RESOURCE_NAME', 'AZURE_SPEECH_VOICE', 'AZURE_SPEECH_KEY',
  'FACEBOOK_PAGE_ID', 'FACEBOOK_APP_ID', 'FACEBOOK_PAGE_ACCESS_TOKEN',
  'FACEBOOK_APP_SECRET', 'FACEBOOK_WEBHOOK_VERIFY_TOKEN',
]) assert.match(pagesConfigExample, new RegExp(`(?:Secret|Secrets|Vars):[^\\n]*\\b${name}\\b`));
assert.match(pagesConfigExample, /D-ID Agent\/WebRTC provisioning remains fail-closed until its authenticated contract and entitlement are verified/);
assert.match(featureMap, /production branch `main` \(หรือระบุ `--branch main`\)/);
assert.match(featureMap, /หลัง deploy Worker `visiond-live-portrait-sanitizer` ก่อน/);
assert.doesNotMatch(pagesConfig, /\[images\]/, 'Pages must not declare the unsupported Images binding');
assert.match(workerSource, /IMAGES\.info/);
assert.match(workerSource, /IMAGES\.input/);
assert.match(workerSource, /format:\s*'image\/jpeg'/);
assert.match(workerSource, /anim:\s*false/);
assert.match(workerSource, /x-visiond-sanitizer/);
assert.equal(Object.hasOwn(packageJson.dependencies || {}, 'jpeg-js'), false);
assert.equal(Object.hasOwn(packageJson.devDependencies || {}, 'jpeg-js'), false);
assert.doesNotMatch(read('package-lock.json'), /"jpeg-js"/);

const disconnected = liveExternalIntegrationHealth({});
assert.equal(disconnected.avatar.connected, false);
assert.equal(disconnected.avatar.provisioning_contract_verified, false);
assert.equal(disconnected.avatar.session_contract_verified, false);
assert.equal(disconnected.thai_voice.connected, false);
assert.equal(disconnected.facebook.connected, false);
assert.equal(disconnected.facebook.live_start, false);
assert.equal(disconnected.local_test, false);
const localTestEnabled = liveExternalIntegrationHealth({ LIVE_CENTER_LOCAL_TEST_ENABLED: '1' });
assert.equal(localTestEnabled.local_test, true);
assert.equal(localTestEnabled.facebook.connected, false);
assert.equal(localTestEnabled.facebook.live_start, false);
assert.throws(() => createLiveAvatarAdapter({ env: {} }).startSession(), error => error?.code === 'DID_AGENT_CONTRACT_UNAVAILABLE');

assert.deepEqual([...LIVE_PHOTO_AVATAR_PHASES], ['disconnected', 'connecting', 'ready', 'speaking', 'stopped', 'error']);
const pendingFrames = [];
let sample = 128;
const makeTrack = kind => {
  const target = new EventTarget();
  return Object.assign(target, { kind, enabled: true, readyState: 'live', stopCalls: 0, stop() { this.stopCalls += 1; this.readyState = 'ended'; } });
};
const audioTrack = makeTrack('audio');
const videoTrack = makeTrack('video');
const stream = {
  getTracks: () => [audioTrack, videoTrack],
  getAudioTracks: () => [audioTrack],
  getVideoTracks: () => [videoTrack],
};
class FakeAudioContext {
  createAnalyser() { return { fftSize: 0, smoothingTimeConstant: 0, disconnect() {}, getByteTimeDomainData(buffer) { buffer.fill(sample); } }; }
  createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
  async resume() {}
  async close() {}
}
const makeVideo = () => ({ hidden: true, muted: false, srcObject: null, pauseCalls: 0, playCalls: 0, async play() { this.playCalls += 1; }, pause() { this.pauseCalls += 1; } });
const previewVideo = makeVideo();
const obsVideo = makeVideo();
const photoStates = [];
const photo = createExactAudioAvatarController({
  previewVideo, obsVideo, AudioContextCtor: FakeAudioContext,
  requestFrame: callback => { pendingFrames.push(callback); return pendingFrames.length; },
  cancelFrame: () => {}, onState: state => photoStates.push(state),
});
await photo.connect(stream, { id: 'session-one' });
assert.equal(photo.snapshot().phase, 'ready');
assert.equal(previewVideo.muted, true);
assert.equal(obsVideo.muted, false);
assert.equal(previewVideo.srcObject, stream);
assert.equal(obsVideo.srcObject, stream);
sample = 200;
pendingFrames.shift()();
assert.equal(photo.snapshot().phase, 'speaking', 'audible analyser samples alone drive speaking');
sample = 128;
pendingFrames.shift()();
assert.equal(photo.snapshot().phase, 'ready', 'silence immediately leaves speaking state');
videoTrack.dispatchEvent(new Event('ended'));
assert.equal(photo.snapshot().phase, 'stopped', 'either media track ending tears down the session');
assert.equal(audioTrack.stopCalls, 1);
assert.equal(videoTrack.stopCalls, 1);
assert.ok(photoStates.some(state => state.reason === 'audio-signal'));

const invalidTracks = [makeTrack('audio'), makeTrack('audio'), makeTrack('video')];
const invalidPhoto = createExactAudioAvatarController({ AudioContextCtor: FakeAudioContext });
await assert.rejects(invalidPhoto.connect({
  getTracks: () => invalidTracks,
  getAudioTracks: () => invalidTracks.slice(0, 2),
  getVideoTracks: () => invalidTracks.slice(2),
}), /one live audio track, one live video track/);
assert.deepEqual(invalidTracks.map(track => track.stopCalls), [1, 1, 1]);

assert.equal(LIVE_AUDIENCE_SOURCE_LABELS.local_test, 'LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม');
const queue = createLiveAudienceQueue({ capacity: 2 });
const event = (id, kind, answerKind, text, second) => ({
  id, source: 'local_test', kind, product_id: 7, answer_kind: answerKind,
  answer_text: text, created_at: `2026-09-25T00:00:0${second}.000Z`,
});
assert.equal(queue.enqueue(event('event-001', 'viewer_join', 'greeting', 'สวัสดีค่ะ', 1)).accepted, true);
assert.equal(queue.enqueue(event('event-002', 'viewer_join', 'greeting', 'ยินดีต้อนรับค่ะ', 2)).accepted, true);
assert.equal(queue.enqueue(event('event-003', 'comment', 'grounded', 'ราคา 50.00 THB ค่ะ', 3)).accepted, true, 'a grounded comment displaces lower-priority join at capacity');
assert.equal(queue.enqueue(event('event-003', 'comment', 'grounded', 'ราคา 50.00 THB ค่ะ', 3)).reason, 'duplicate');
assert.equal(queue.snapshot().queued, 2);
assert.throws(() => queue.enqueue({ ...event('event-004', 'comment', 'grounded', '', 4) }), /invalid/);

const product = { id: 7, title: 'ตุ๊กตาทดสอบ', price_cents: 5000, currency: 'THB', quantity: 3, status: 'published', availability: 'in stock', brand: '', product_line: '', series: '' };
assert.match(groundLiveAudienceAnswer(product, { kind: 'comment', question: 'ราคาเท่าไหร่' }).text, /50\.00 THB/);
assert.deepEqual(groundLiveAudienceAnswer(product, { kind: 'comment', question: 'ผลิตที่ประเทศอะไร' }), { kind: 'unknown', text: LIVE_AUDIENCE_UNKNOWN_ANSWER });

for (const route of [
  'functions/api/admin/live-center/integration-health.js',
  'functions/api/admin/live-center/shows/[id]/presenter.js',
  'functions/api/admin/live-center/shows/[id]/presenter/image.js',
  'functions/api/admin/live-center/shows/[id]/presenter-cleanup.js',
  'functions/api/admin/live-center/shows/[id]/avatar-session.js',
  'functions/api/admin/live-center/shows/[id]/facebook-connector.js',
  'functions/api/admin/live-center/shows/[id]/audience/local-session.js',
  'functions/api/admin/live-center/shows/[id]/audience/local-events.js',
  'functions/api/admin/live-center/shows/[id]/audience/queue.js',
  'functions/api/admin/live-center/shows/[id]/audience/queue/claim.js',
]) {
  assert.equal(fs.existsSync(path.join(root, route)), true, `${route} must exist`);
  await import(`${pathToFileURL(path.join(root, route)).href}?v134=${Date.now()}`);
}

console.log('v0.20.134 photo-avatar service boundary, exact-audio lifecycle, grounded audience queue, UI and cache graph checks passed');
