import { createLocalLivePlayback, parseVisionDLivePackage } from './live-center-package.js';
import { createLocalLivePlayer, createLocalSpeechNarrator } from './live-package-player.js';

const $ = selector => document.querySelector(selector);
let playback = null;
let player = null;
let assetUrl = '';
let openTicket = 0;
let obsActive = false;
let obsEpoch = 0;
let pendingFullscreenExit = null;

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
}

function renderCountdown({ remainingMs, durationSeconds }) {
  $('#openCountdown').textContent = countdownText(remainingMs);
  $('#openCountdown').setAttribute('aria-label', `เหลือ ${Math.ceil(remainingMs / 1000)} วินาที จาก ${durationSeconds} วินาที`);
}

function renderPlayerState({ phase }) {
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
}

function renderNarration({ status }) {
  const narration = $('#openNarrationStatus');
  if (status === 'thai') narration.textContent = 'กำลังใช้เสียงภาษาไทยจากอุปกรณ์นี้';
  else if (status === 'default') narration.textContent = 'ไม่พบเสียงไทย จึงใช้เสียงเริ่มต้นของอุปกรณ์';
  else if (status === 'unavailable') narration.textContent = 'อุปกรณ์นี้ไม่มี Web Speech จึงเล่นต่อแบบไม่มีเสียง';
  else if (status === 'empty') narration.textContent = 'ฉากนี้ไม่มีบทพูด จึงไม่มีเสียงบรรยาย';
  else if (status === 'cancelled') narration.textContent = 'เสียงหยุดแล้ว';
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
  player?.destroy();
  player = null;
  playback = null;
  clearAssetUrl();
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
    playback = createLocalLivePlayback(parsed);
    const { manifest } = parsed;
    $('#packageTitle').textContent = manifest.show.title;
    $('#packageVersion').textContent = `VERSION ${manifest.version.number} · revision ${manifest.show.revision}`;
    $('#packageDigest').textContent = `SHA-256 ${parsed.package_sha256.slice(0, 12)}…`;
    $('#packageMeta').textContent = `${manifest.scenes.length} ฉาก · สร้าง ${new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(manifest.created.at))} · ${manifest.show.output.profile}`;
    $('#obsShow').textContent = manifest.show.title;
    $('#obsStage').dataset.profile = manifest.show.output.profile;
    player = createLocalLivePlayer(playback, {
      narrator: createLocalSpeechNarrator(window),
      onScene: renderScene,
      onCountdown: renderCountdown,
      onState: renderPlayerState,
      onNarration: renderNarration,
    });
    $('#packageWorkspace').hidden = false;
    setStatus('แพ็กเกจถูกต้อง รูปทั้งหมดผ่านการตรวจ MIME และ SHA-256 แล้ว พร้อมเล่นในเครื่องนี้', 'success');
  } catch (error) {
    if (ticket !== openTicket) return;
    disposeCurrentPackage();
    setStatus(`${error.code || 'LIVE_PACKAGE_INVALID'}: ${error.message}`, 'error');
  }
}

if (typeof document !== 'undefined') {
  $('#packageFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) openPackage(file);
  });
  $('#startPlayback').addEventListener('click', () => player?.start());
  $('#stopPlayback').addEventListener('click', () => player?.stop());
  $('#restartPlayback').addEventListener('click', () => player?.restart());
  $('#previousScene').addEventListener('click', () => player?.navigate(-1));
  $('#nextScene').addEventListener('click', () => player?.navigate(1));
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
