import { createLocalLivePlayback, parseVisionDLivePackage } from './live-center-package.js?v=020135';
import { createLiveAiHostController, createLiveAiSpeechNarrator, requestLiveHostTurn } from './live-package-ai-host.js?v=020135';
import { createLiveHumanPresenter, mountLiveHumanPresenter, resolveLiveAiPresenterPreset } from './live-package-presenter.js?v=020135';
import { createLocalLivePlayer, createLocalSpeechNarrator } from './live-package-player.js?v=020135';
import { THAI_VOICE_MISSING_MESSAGE } from './live-package-thai-speech.js?v=020135';
import { createExactAudioAvatarController } from './live-photo-avatar.js?v=020135';

const $ = selector => document.querySelector(selector);
let playback = null;
let player = null;
let openedPackage = null;
let aiHost = null;
let presenter = null;
let aiModeActive = false;
let offlinePhase = 'ready';
let assetUrl = '';
let openTicket = 0;
let obsActive = false;
let obsEpoch = 0;
let pendingFullscreenExit = null;
let photoAvatar = null;
let photoAvatarRequested = false;
let photoAvatarRequest = null;
let photoAvatarSession = null;
let photoAvatarAttempt = null;
let photoAvatarMessage = '';
const LIVE_PHOTO_PRIVATE_TIMEOUT_MS = 15_000;

const PRESENTER_STATE_COPY = Object.freeze({
  idle: 'พร้อมเริ่ม',
  thinking: 'กำลังคิดและฟัง',
  talk: 'กำลังพูดกับผู้ชม',
  present: 'กำลังนำเสนอสินค้า',
  open: 'กำลังเน้นด้วยท่ามือเปิด',
  cheer: 'กำลังชวนตัดสินใจ',
  paused: 'พักในท่าสงบ',
  error: 'หยุดอย่างปลอดภัย',
});

const setStatus = (message, type = '') => {
  $('#openStatus').textContent = message;
  $('#openStatus').className = `status-line${type ? ` ${type}` : ''}`;
};
const money = (minor, currency) => new Intl.NumberFormat('th-TH', { style: 'currency', currency }).format(Number(minor) / 100);
const countdownText = milliseconds => {
  const tenths = Math.max(0, Math.ceil(Number(milliseconds) / 100) / 10);
  const minutes = Math.floor(tenths / 60);
  const seconds = (tenths - (minutes * 60)).toFixed(1).padStart(4, '0');
  return `${String(minutes).padStart(2, '0')}:${seconds}`;
};

function renderPresenterState({ state = 'idle', preset = 'none', visible = false, reason = '' }) {
  visible = Boolean(visible && !photoAvatarRequested);
  const label = PRESENTER_STATE_COPY[state] || PRESENTER_STATE_COPY.idle;
  const variant = preset === 'presenter-placeholder' ? 'พิธีกรเสมือนแบบย่อ' : 'พิธีกรเสมือน VisionD';
  for (const root of [$('#aiPresenterPreview'), $('#obsPresenter')]) {
    if (!root) continue;
    root.dataset.presenterState = state;
    root.dataset.presenterPreset = preset;
    root.dataset.presenterReason = reason;
    root.hidden = !visible;
    root.setAttribute('aria-label', visible ? `${variant} · ${label}` : 'ซ่อนพิธีกรเสมือนตามแพ็กเกจ');
  }
  $('#aiPresenterPreview')?.parentElement?.setAttribute('data-presenter-visible', String(visible));
  $('#obsAiHost')?.setAttribute('data-presenter-visible', String(visible));
  $('#aiPresenterStateLabel').textContent = visible ? label : 'แพ็กเกจนี้ซ่อนพิธีกร';
  if (visible) $('#obsAiState').textContent = label;
}

function mountPresenterSurfaces() {
  for (const root of [$('#aiPresenterPreview'), $('#obsPresenter')]) {
    if (root && !root.querySelector('svg')) mountLiveHumanPresenter(root);
  }
}

function createPresenter(preset) {
  presenter?.destroy();
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  presenter = createLiveHumanPresenter({ preset, reducedMotion, onState: renderPresenterState });
}

function renderPhotoAvatarState(snapshot = photoAvatar?.snapshot?.() || { phase: 'disconnected', reason: 'load', speaking: false }) {
  const phase = snapshot.phase || 'disconnected';
  const connected = phase === 'ready' || phase === 'speaking';
  const label = phase === 'connecting' ? 'กำลังตรวจการเชื่อมต่อ…'
    : phase === 'speaking' ? 'กำลังพูดจากสัญญาณเสียงจริง'
      : phase === 'ready' ? 'เชื่อมต่อแล้ว · รอสัญญาณเสียง'
        : phase === 'error' ? photoAvatarMessage || 'ยังไม่ได้เชื่อมต่อ'
          : phase === 'stopped' ? 'หยุด Photo Avatar แล้ว'
            : 'ยังไม่ได้เชื่อมต่อ';
  $('#photoAvatarPanel').dataset.photoMode = String(photoAvatarRequested);
  $('#photoAvatarPanel').dataset.photoState = phase;
  $('#photoAvatarState').textContent = label;
  $('#photoAvatarPreviewFallback').hidden = connected;
  $('#photoAvatarPreviewFallback').querySelector('span').textContent = label;
  $('#obsPhotoAvatarFallback').hidden = connected;
  $('#obsPhotoAvatarFallback').querySelector('span').textContent = label;
  $('#obsPhotoAvatarSlot').hidden = !photoAvatarRequested;
  $('.ai-presenter-preview').hidden = photoAvatarRequested;
  $('#useLegacyPresenter').hidden = !photoAvatarRequested;
  $('#activatePhotoAvatar').disabled = !playback || phase === 'connecting';
  if (photoAvatarRequested) {
    $('#aiPresenterPreview').hidden = true;
    $('#obsPresenter').hidden = true;
    $('#aiPresenterPreview').parentElement.setAttribute('data-presenter-visible', 'false');
    $('#obsAiHost').setAttribute('data-presenter-visible', 'true');
    $('#obsAiHost').hidden = false;
  }
  syncModeControls();
}

function createPhotoAvatarSurface() {
  photoAvatar?.destroy();
  photoAvatar = createExactAudioAvatarController({
    previewVideo: $('#photoAvatarPreviewVideo'),
    obsVideo: $('#obsPhotoAvatarVideo'),
    onState: renderPhotoAvatarState,
  });
  renderPhotoAvatarState(photoAvatar.snapshot());
}

async function photoPrivateRequest(url, options = {}, signal = undefined) {
  const headers = new Headers(options.headers || {});
  headers.set('accept', 'application/json');
  if (typeof options.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const requestController = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => requestController.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener?.('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, LIVE_PHOTO_PRIVATE_TIMEOUT_MS);
  let response;
  let payload;
  try {
    response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, headers, signal: requestController.signal });
    try {
      payload = await response.json();
    } catch (error) {
      if (requestController.signal.aborted) throw error;
      payload = null;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    const failure = new Error(timedOut
      ? 'การเชื่อมต่อ Photo Avatar ใช้เวลานานเกินไป กรุณาลองใหม่'
      : 'เชื่อมต่อ Photo Avatar ไม่สำเร็จ กรุณาลองใหม่');
    failure.code = timedOut ? 'LIVE_PHOTO_TIMEOUT' : 'LIVE_PHOTO_NETWORK_FAILED';
    throw failure;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', abortFromCaller);
  }
  if (!response.ok) {
    const failure = new Error(payload?.error || 'เชื่อมต่อ Photo Avatar ไม่สำเร็จ กรุณาลองใหม่');
    failure.code = payload?.code || 'LIVE_PHOTO_FAILED';
    failure.status = response.status;
    throw failure;
  }
  if (!Number.isSafeInteger(payload?.viewer_id)) {
    const failure = new Error('คำตอบ Photo Avatar ไม่ถูกต้อง');
    failure.code = 'LIVE_PHOTO_RESPONSE_INVALID';
    throw failure;
  }
  return payload;
}

function stopPhotoSessionInBackground(session = photoAvatarSession) {
  const showId = openedPackage?.manifest?.show?.id;
  if (!showId || !session?.id) return;
  void fetch(`/api/admin/live-center/shows/${showId}/avatar-session`, {
    method: 'DELETE', credentials: 'same-origin', cache: 'no-store', keepalive: true,
    headers: { 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': session.stopKey || `photo-stop.${crypto.randomUUID().replaceAll('-', '')}` },
    body: JSON.stringify({ session_id: session.id }),
  }).catch(() => undefined);
}

function stopPhotoAvatar(reason = 'operator-stop', { keepMode = true } = {}) {
  photoAvatarRequest?.controller.abort();
  photoAvatarRequest = null;
  stopPhotoSessionInBackground();
  photoAvatarSession = null;
  photoAvatarAttempt = null;
  photoAvatarMessage = '';
  photoAvatar?.stop(reason);
  photoAvatarRequested = keepMode;
  renderPhotoAvatarState(photoAvatar?.snapshot());
}

async function activatePhotoAvatar() {
  if (!playback || !openedPackage || photoAvatarRequest) return;
  if (offlinePhase === 'playing') player?.stop();
  const aiPhase = aiHost?.snapshot?.().phase;
  if (aiPhase && !['ready', 'stopped'].includes(aiPhase)) aiHost.stop();
  photoAvatarRequested = true;
  photoAvatarMessage = '';
  photoAvatar?.setConnecting('session-request');
  const ticket = openTicket;
  const controller = new AbortController();
  photoAvatarRequest = { controller, ticket };
  renderPhotoAvatarState(photoAvatar.snapshot());
  try {
    const showId = openedPackage.manifest.show.id;
    const [health, portraits] = await Promise.all([
      photoPrivateRequest('/api/admin/live-center/integration-health', {}, controller.signal),
      photoPrivateRequest(`/api/admin/live-center/shows/${showId}/presenter?limit=1`, {}, controller.signal),
    ]);
    if (ticket !== openTicket || photoAvatarRequest?.controller !== controller) return;
    const selected = portraits.items?.find(item => item.id === portraits.binding?.active_id && item.status === 'active');
    if (!selected) throw Object.assign(new Error('ยังไม่ได้เลือกรูป Photo Avatar ใน Live Center'), { code: 'LIVE_PORTRAIT_SELECTION_REQUIRED' });
    if (!health.avatar?.connected || !health.avatar?.provisioning_contract_verified || !health.avatar?.session_contract_verified || !health.thai_voice?.connected) {
      throw Object.assign(new Error('ยังไม่ได้เชื่อมต่อ D-ID Agent/session และ Azure เสียงไทยกับเซิร์ฟเวอร์'), { code: 'LIVE_AVATAR_NOT_CONNECTED' });
    }
    const signature = `${showId}:${selected.id}:${portraits.binding.revision}`;
    if (photoAvatarAttempt?.signature !== signature) photoAvatarAttempt = { signature, key: `photo-session.${crypto.randomUUID().replaceAll('-', '')}` };
    const sessionPayload = await photoPrivateRequest(`/api/admin/live-center/shows/${showId}/avatar-session`, {
      method: 'POST', headers: { 'idempotency-key': photoAvatarAttempt.key },
      body: JSON.stringify({ portrait_id: selected.id, expected_binding_revision: Number(portraits.binding.revision) }),
    }, controller.signal);
    if (ticket !== openTicket || photoAvatarRequest?.controller !== controller) return;
    if (sessionPayload?.session?.id) {
      photoAvatarSession = { id: sessionPayload.session.id, stopKey: `photo-stop.${crypto.randomUUID().replaceAll('-', '')}` };
      stopPhotoSessionInBackground(photoAvatarSession);
      photoAvatarSession = null;
    }
    throw Object.assign(new Error('เซิร์ฟเวอร์ยังไม่ส่งสัญญา WebRTC ที่ผ่านการยืนยัน จึงไม่เปิดวิดีโอ'), { code: 'LIVE_AVATAR_SESSION_CONTRACT_UNAVAILABLE' });
  } catch (error) {
    if (error?.name === 'AbortError' || ticket !== openTicket || photoAvatarRequest?.controller !== controller) return;
    controller.abort();
    photoAvatarMessage = error.message || 'ยังไม่ได้เชื่อมต่อ';
    photoAvatar?.fail(error.code || 'session-failed');
  } finally {
    if (photoAvatarRequest?.controller === controller) photoAvatarRequest = null;
    renderPhotoAvatarState(photoAvatar?.snapshot());
  }
}

function useLegacyPresenter() {
  stopPhotoAvatar('legacy-selected', { keepMode: false });
  const preset = openedPackage ? resolveLiveAiPresenterPreset(openedPackage.manifest.show.avatar.preset) : 'none';
  const snapshot = aiHost?.snapshot?.();
  createPresenter(preset);
  if (snapshot) renderAiState({ ...snapshot, reason: 'legacy-selected' });
  else renderPresenterState({ state: 'idle', preset, visible: preset !== 'none', reason: 'legacy-selected' });
}

function syncModeControls() {
  const scene = playback?.currentScene?.();
  const offlineLocked = aiModeActive;
  const aiPhase = aiHost?.snapshot?.().phase;
  const aiRunning = aiPhase === 'generating' || aiPhase === 'speaking';
  $('#startPlayback').disabled = !playback || offlineLocked || offlinePhase === 'playing';
  $('#stopPlayback').disabled = !playback || offlineLocked || offlinePhase !== 'playing';
  $('#restartPlayback').disabled = !playback || offlineLocked;
  $('#previousScene').disabled = !playback || offlineLocked || scene?.position === 0;
  $('#nextScene').disabled = !playback || offlineLocked || scene?.position === playback?.sceneCount - 1;
  $('#obsMode').disabled = !playback;
  $('#startAiHost').disabled = !aiHost || aiRunning || aiPhase === 'error' || photoAvatarRequested;
}

function resetAiSurface() {
  aiModeActive = false;
  $('#aiHostPanel').dataset.aiHostState = 'ready';
  $('#aiHostProduct').textContent = 'รอเปิดแพ็กเกจ';
  $('#aiHostStatus').textContent = 'เปิดแพ็กเกจแล้วกดเริ่มเมื่อต้องการใช้โหมดออนไลน์';
  $('#aiLiveCaption').textContent = 'ยังไม่มีบทสด';
  $('#startAiHost').textContent = 'เริ่ม AI พิธีกรสด';
  $('#startAiHost').disabled = true;
  $('#pauseAiHost').disabled = true;
  $('#stopAiHost').disabled = true;
  $('#skipAiProduct').disabled = true;
  $('#retryAiHost').hidden = true;
  $('#aiHostCue').disabled = true;
  $('#aiLoopProducts').disabled = true;
  $('#obsAiHost').hidden = true;
  $('#obsAiHost').dataset.aiHostState = 'idle';
  $('#obsAiState').textContent = 'พร้อมเริ่ม';
  $('#obsLiveCaption').textContent = 'รอบทสดจาก AI';
  renderPresenterState({ state: 'idle', preset: 'none', visible: false, reason: 'reset' });
  syncModeControls();
}

function clearAssetUrl() {
  if (assetUrl) URL.revokeObjectURL(assetUrl);
  assetUrl = '';
  for (const image of [$('#openImage'), $('#obsImage')]) image?.removeAttribute('src');
}

function applyTransition(transition) {
  const normalized = transition === 'fade' ? 'fade' : 'cut';
  for (const stage of [$('#openerScene'), $('#obsStage')]) {
    if (!stage) continue;
    stage.dataset.transition = 'none';
    void stage.offsetWidth;
    stage.dataset.transition = normalized;
  }
}

function renderScene({ scene, asset, transition = 'cut' }) {
  if (!scene || !asset) return;
  clearAssetUrl();
  assetUrl = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mime_type }));
  const price = `${money(scene.product.price_minor, scene.product.currency)} · ราคาจากแพ็กเกจ · stock ${scene.product.stock}`;
  $('#openImage').src = assetUrl;
  $('#openImage').alt = `รูปสินค้า ${scene.product.title}`;
  $('#obsImage').src = assetUrl;
  $('#obsImage').alt = `รูปสินค้า ${scene.product.title}`;
  $('#openPosition').textContent = String(scene.position + 1);
  $('#openProduct').textContent = scene.product.title;
  $('#openPrice').textContent = price;
  $('#openScript').textContent = scene.script || 'ไม่มีบทพูดในฉากนี้';
  $('#openCue').textContent = `${scene.cue.label || 'คิวไม่มีชื่อ'} · ${scene.cue.duration_seconds} วินาที · ${scene.cue.transition}`;
  $('#obsProduct').textContent = scene.product.title;
  $('#obsPrice').textContent = price;
  $('#obsPosition').textContent = `ฉาก ${scene.position + 1} / ${playback.sceneCount}`;
  $('#previousScene').disabled = scene.position === 0;
  $('#nextScene').disabled = scene.position === playback.sceneCount - 1;
  applyTransition(transition);
  syncModeControls();
}

function renderCountdown({ remainingMs, durationSeconds }) {
  $('#openCountdown').textContent = countdownText(remainingMs);
  $('#openCountdown').setAttribute('aria-label', `เหลือ ${Math.ceil(remainingMs / 1000)} วินาที จาก ${durationSeconds} วินาที`);
}

function renderPlayerState({ phase }) {
  offlinePhase = phase;
  const start = $('#startPlayback');
  const stop = $('#stopPlayback');
  const label = $('#openPlaybackStatus');
  start.disabled = phase === 'playing';
  stop.disabled = phase !== 'playing';
  $('#restartPlayback').disabled = false;
  $('#obsMode').disabled = false;
  if (phase === 'playing') {
    start.textContent = 'กำลังเล่น';
    label.textContent = 'กำลังเล่นตามเวลาที่บันทึกไว้';
  } else if (phase === 'paused') {
    start.textContent = 'เล่นต่อ';
    label.textContent = 'หยุดชั่วคราว ใช้ก่อนหน้า/ถัดไปได้';
  } else if (phase === 'ended') {
    start.textContent = 'เล่นซ้ำ';
    label.textContent = 'จบฉากสุดท้ายแล้ว กดเล่นซ้ำเพื่อเริ่มฉาก 1';
    $('#openNarrationStatus').textContent = 'เสียงหยุดแล้วเมื่อจบฉากสุดท้าย';
  } else {
    start.textContent = 'เริ่มเล่น';
    label.textContent = 'พร้อมเล่น ระบบจะไม่เริ่มอัตโนมัติ';
    $('#openNarrationStatus').textContent = 'เสียงจะเริ่มหลังผู้ใช้กดเล่นเท่านั้น';
  }
  syncModeControls();
}

function renderNarration({ status }) {
  const narration = $('#openNarrationStatus');
  if (status === 'voice-loading') narration.textContent = 'กำลังค้นหาเสียงภาษาไทย (th-TH) ในอุปกรณ์นี้…';
  else if (status === 'thai') narration.textContent = 'กำลังใช้เสียงภาษาไทย (th-TH) จากอุปกรณ์นี้';
  else if (status === 'thai-unavailable') narration.textContent = THAI_VOICE_MISSING_MESSAGE;
  else if (status === 'unavailable') narration.textContent = 'อุปกรณ์นี้ไม่มี Web Speech จึงเล่นต่อแบบไม่มีเสียง';
  else if (status === 'empty') narration.textContent = 'ฉากนี้ไม่มีบทพูด จึงไม่มีเสียงบรรยาย';
  else if (status === 'cancelled') narration.textContent = 'เสียงหยุดแล้ว';
}

function renderAiProduct({ scene, productPosition, productCount, reason }) {
  if (!scene) return;
  $('#aiHostProduct').textContent = `สินค้า ${productPosition + 1} / ${productCount} · ${scene.product.title}`;
  if (!aiModeActive || reason === 'load') return;
  const asset = openedPackage?.assets?.get(scene.assets?.[0]?.id);
  if (asset) renderScene({ scene, asset, transition: scene.cue?.transition || 'cut' });
}

function renderAiTurn({ text, product, productPosition }) {
  const price = `${money(product.price_minor, product.currency)} · ราคาปัจจุบันจาก VisionD · stock ${product.stock}`;
  $('#aiLiveCaption').textContent = text;
  $('#aiHostProduct').textContent = `สินค้า ${productPosition + 1} / ${openedPackage?.manifest?.scenes?.length || 0} · ${product.title}`;
  $('#openProduct').textContent = product.title;
  $('#openPrice').textContent = price;
  $('#obsProduct').textContent = product.title;
  $('#obsPrice').textContent = price;
  $('#obsPosition').textContent = `AI สด · สินค้า ${productPosition + 1} / ${openedPackage?.manifest?.scenes?.length || 0}`;
  $('#obsLiveCaption').textContent = text;
}

function renderAiNarration({ status, text, productPosition }) {
  if (status !== 'thai' || photoAvatarRequested) return;
  presenter?.startSpeaking(`${openTicket}:${productPosition}:${text}`);
}

function restoreOfflineScene() {
  const scene = playback?.currentScene?.();
  const asset = playback?.currentAsset?.();
  if (scene && asset) renderScene({ scene, asset, transition: 'cut' });
}

function renderAiState(state) {
  const { phase, productPosition = 0, productCount = 0, requestPending, hasPrefetch, loopProducts, error, speechStatus, reason } = state;
  const active = ['generating', 'speaking', 'paused', 'error'].includes(phase);
  const running = phase === 'generating' || phase === 'speaking';
  aiModeActive = active;
  $('#aiHostPanel').dataset.aiHostState = phase;
  $('#startAiHost').disabled = !aiHost || running || phase === 'error' || photoAvatarRequested;
  $('#startAiHost').textContent = phase === 'paused' ? 'เล่น AI ต่อด้วยบทใหม่' : 'เริ่ม AI พิธีกรสด';
  $('#pauseAiHost').disabled = !running;
  $('#stopAiHost').disabled = !active;
  $('#retryAiHost').hidden = phase !== 'error';
  $('#aiHostCue').disabled = !aiHost;
  $('#aiLoopProducts').disabled = !aiHost;
  $('#skipAiProduct').disabled = !active || productCount < 2 || (productPosition === productCount - 1 && !loopProducts);
  let status = 'พร้อมสร้างบทสดเมื่อกดเริ่ม';
  let obsState = 'พร้อมเริ่ม';
  let visualState = 'idle';
  if (phase === 'generating') {
    status = 'AI กำลังสร้างบทใหม่จากข้อมูลสินค้าปัจจุบัน…';
    obsState = 'กำลังคิดบทสด';
    visualState = 'thinking';
  } else if (phase === 'speaking') {
    const speechStarted = speechStatus === 'thai';
    status = speechStarted
      ? requestPending ? 'กำลังพูดบทสด · กำลังเตรียมบทถัดไป 1 รายการ' : hasPrefetch ? 'กำลังพูดบทสด · บทถัดไปพร้อมแล้ว' : 'กำลังพูดบทสด'
      : speechStatus === 'voice-loading' ? 'บทสดพร้อมแล้ว กำลังค้นหาเสียงภาษาไทย (th-TH)…' : 'บทสดพร้อมแล้ว กำลังรออุปกรณ์เริ่มเสียง…';
    obsState = speechStarted ? 'กำลังพูดสด' : speechStatus === 'voice-loading' ? 'กำลังค้นหาเสียงไทย' : 'รอเสียงเริ่ม';
    visualState = speechStarted ? 'speaking' : 'thinking';
  } else if (phase === 'paused') {
    status = 'พัก AI แล้ว สินค้าปัจจุบันยังคงอยู่ กดเล่นต่อเพื่อสร้างบทใหม่';
    obsState = 'พักการพูด';
  } else if (phase === 'stopped') {
    status = 'หยุด AI แล้ว ไม่มีคำขอหรือเสียงที่กำลังทำงาน';
    obsState = 'หยุดแล้ว';
  } else if (phase === 'error') {
    status = error?.message || 'AI พิธีกรสดหยุดทำงาน กรุณากดลองใหม่';
    obsState = 'AI หยุดทำงาน';
    visualState = 'error';
  }
  $('#aiHostStatus').textContent = status;
  $('#aiHostStatus').className = `ai-host-status${phase === 'error' ? ' error' : ''}`;
  $('#obsAiHost').hidden = !active && !photoAvatarRequested;
  $('#obsAiHost').dataset.aiHostState = visualState;
  $('#obsAiState').textContent = obsState;
  if (phase === 'generating') presenter?.setState('thinking', reason || 'generating');
  else if (phase === 'speaking' && speechStatus !== 'thai') presenter?.setState('thinking', speechStatus === 'voice-loading' ? 'voice-loading' : 'speech-starting');
  else if (phase === 'paused') presenter?.setState('paused', 'paused');
  else if (phase === 'error') presenter?.setState('error', 'error');
  else if (phase === 'stopped') presenter?.setState('idle', 'stopped');
  else if (phase === 'ready') presenter?.setState('idle', 'ready');
  if (phase === 'stopped') restoreOfflineScene();
  if (photoAvatarRequested) renderPhotoAvatarState(photoAvatar?.snapshot());
  syncModeControls();
}

function deactivateObsSurface(epoch = obsEpoch) {
  if (epoch !== obsEpoch) return;
  obsActive = false;
  document.body.classList.remove('obs-mode');
  $('#obsStage').hidden = true;
  $('#obsMode').textContent = 'โหมด OBS เต็มจอ';
}

function ensureFullscreenExit() {
  const stage = $('#obsStage');
  if (pendingFullscreenExit) return pendingFullscreenExit;
  if (document.fullscreenElement !== stage || typeof document.exitFullscreen !== 'function') return Promise.resolve();
  const pending = Promise.resolve(document.exitFullscreen()).catch(() => {});
  pendingFullscreenExit = pending;
  void pending.finally(() => {
    if (pendingFullscreenExit === pending) pendingFullscreenExit = null;
  });
  return pending;
}

async function exitObsMode({ exitFullscreen = true } = {}) {
  const epoch = ++obsEpoch;
  const stage = $('#obsStage');
  obsActive = false;
  deactivateObsSurface(epoch);
  if (exitFullscreen && document.fullscreenElement === stage) await ensureFullscreenExit();
}

async function enterObsMode() {
  if (!player) return;
  if (obsActive) {
    await exitObsMode();
    return;
  }
  const stage = $('#obsStage');
  const epoch = ++obsEpoch;
  if (pendingFullscreenExit) await pendingFullscreenExit;
  if (document.fullscreenElement === stage) await ensureFullscreenExit();
  if (epoch !== obsEpoch || !player) return;
  obsActive = true;
  stage.hidden = false;
  document.body.classList.add('obs-mode');
  $('#obsMode').textContent = 'ออกโหมด OBS';
  try {
    if (typeof stage.requestFullscreen === 'function') await stage.requestFullscreen({ navigationUI: 'hide' });
    if (epoch !== obsEpoch && !obsActive && document.fullscreenElement === stage) await ensureFullscreenExit();
  } catch {
    if (epoch === obsEpoch) $('#openPlaybackStatus').textContent = 'เบราว์เซอร์ไม่อนุญาตเต็มจอ ใช้พื้นผิว OBS แบบเต็มหน้าต่างแทน และกด Esc เพื่อออก';
  }
}

function disposeCurrentPackage() {
  photoAvatarRequest?.controller.abort();
  photoAvatarRequest = null;
  stopPhotoSessionInBackground();
  photoAvatarSession = null;
  photoAvatarAttempt = null;
  photoAvatarMessage = '';
  photoAvatarRequested = false;
  photoAvatar?.destroy();
  photoAvatar = null;
  aiHost?.destroy();
  aiHost = null;
  presenter?.destroy();
  presenter = null;
  aiModeActive = false;
  player?.destroy();
  player = null;
  playback = null;
  openedPackage = null;
  offlinePhase = 'ready';
  clearAssetUrl();
  $('#aiHostCue').value = '';
  $('#aiLoopProducts').checked = false;
  resetAiSurface();
  void exitObsMode();
}

async function openPackage(file) {
  const ticket = ++openTicket;
  disposeCurrentPackage();
  $('#packageWorkspace').hidden = true;
  setStatus('กำลังตรวจแพ็กเกจ…');
  try {
    const parsed = await parseVisionDLivePackage(file);
    if (ticket !== openTicket) return;
    openedPackage = parsed;
    playback = createLocalLivePlayback(parsed);
    const { manifest } = parsed;
    $('#packageTitle').textContent = manifest.show.title;
    $('#packageVersion').textContent = `VERSION ${manifest.version.number} · revision ${manifest.show.revision}`;
    $('#packageDigest').textContent = `SHA-256 ${parsed.package_sha256.slice(0, 12)}…`;
    $('#packageMeta').textContent = `${manifest.scenes.length} ฉาก · สร้าง ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(manifest.created.at))} · ${manifest.show.output.profile}`;
    $('#obsShow').textContent = manifest.show.title;
    $('#obsStage').dataset.profile = manifest.show.output.profile;
    createPresenter(resolveLiveAiPresenterPreset(manifest.show.avatar.preset));
    createPhotoAvatarSurface();
    player = createLocalLivePlayer(playback, {
      narrator: createLocalSpeechNarrator(window),
      onScene: renderScene,
      onCountdown: renderCountdown,
      onState: renderPlayerState,
      onNarration: renderNarration,
    });
    aiHost = createLiveAiHostController(manifest.scenes, {
      requestTurn: requestLiveHostTurn,
      narrator: createLiveAiSpeechNarrator(window),
      onProduct: renderAiProduct,
      onTurn: renderAiTurn,
      onState: renderAiState,
      onNarration: renderAiNarration,
    });
    renderAiState({ ...aiHost.snapshot(), reason: 'open' });
    $('#packageWorkspace').hidden = false;
    setStatus('แพ็กเกจถูกต้อง รูปทั้งหมดผ่านการตรวจ MIME และ SHA-256 แล้ว พร้อมเล่นในเครื่องนี้', 'success');
  } catch (error) {
    if (ticket !== openTicket) return;
    disposeCurrentPackage();
    setStatus(`${error.code || 'LIVE_PACKAGE_INVALID'}: ${error.message}`, 'error');
  }
}

function stopAiBeforeOfflineAction() {
  const phase = aiHost?.snapshot().phase;
  if (phase && !['ready', 'stopped'].includes(phase)) aiHost.stop();
  if (photoAvatarRequested) stopPhotoAvatar('offline-playback', { keepMode: true });
}

function startAiMode() {
  if (!aiHost || !playback) return;
  if (photoAvatarRequested) {
    photoAvatarMessage = 'Photo Avatar ยังไม่ได้เชื่อม exact-audio session จึงไม่เริ่มเสียงหรือใช้การ์ตูนแทน';
    photoAvatar?.fail('exact-audio-not-connected');
    return;
  }
  const state = aiHost.snapshot();
  if (state.phase === 'generating' || state.phase === 'speaking') return;
  if (offlinePhase === 'playing') player?.stop();
  aiModeActive = true;
  const position = state.phase === 'paused' ? state.productPosition : playback.currentScene()?.position || 0;
  const scene = openedPackage?.manifest?.scenes?.[position];
  const asset = scene ? openedPackage?.assets?.get(scene.assets?.[0]?.id) : null;
  if (scene && asset) renderScene({ scene, asset, transition: scene.cue?.transition || 'cut' });
  aiHost.setOperatorCue($('#aiHostCue').value);
  aiHost.start(state.phase === 'paused' ? undefined : { position });
}

if (typeof document !== 'undefined') {
  mountPresenterSurfaces();
  $('#packageFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) openPackage(file);
  });
  $('#startPlayback').addEventListener('click', () => { stopAiBeforeOfflineAction(); player?.start(); });
  $('#stopPlayback').addEventListener('click', () => player?.stop());
  $('#restartPlayback').addEventListener('click', () => { stopAiBeforeOfflineAction(); player?.restart(); });
  $('#previousScene').addEventListener('click', () => { stopAiBeforeOfflineAction(); player?.navigate(-1); });
  $('#nextScene').addEventListener('click', () => { stopAiBeforeOfflineAction(); player?.navigate(1); });
  $('#startAiHost').addEventListener('click', startAiMode);
  $('#pauseAiHost').addEventListener('click', () => aiHost?.pause());
  $('#stopAiHost').addEventListener('click', () => aiHost?.stop());
  $('#skipAiProduct').addEventListener('click', () => aiHost?.skip());
  $('#retryAiHost').addEventListener('click', () => aiHost?.retry());
  $('#aiHostCue').addEventListener('input', event => aiHost?.setOperatorCue(event.target.value));
  $('#aiLoopProducts').addEventListener('change', event => aiHost?.setLoopProducts(event.target.checked));
  $('#activatePhotoAvatar').addEventListener('click', () => { void activatePhotoAvatar(); });
  $('#useLegacyPresenter').addEventListener('click', useLegacyPresenter);
  $('#obsMode').addEventListener('click', () => { void enterObsMode(); });
  document.addEventListener('fullscreenchange', () => {
    const stage = $('#obsStage');
    if (!obsActive && document.fullscreenElement === stage) {
      void ensureFullscreenExit();
      return;
    }
    if (obsActive && document.fullscreenElement !== stage) {
      const epoch = ++obsEpoch;
      deactivateObsSurface(epoch);
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && obsActive) void exitObsMode();
  });
  addEventListener('beforeunload', disposeCurrentPackage);
}
