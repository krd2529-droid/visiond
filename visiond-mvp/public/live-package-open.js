import { createLocalLivePlayback, parseVisionDLivePackage } from './live-center-package.js';

const $ = selector => document.querySelector(selector);
let playback = null;
let assetUrl = '';
let openTicket = 0;

const setStatus = (message, type = '') => {
  $('#openStatus').textContent = message;
  $('#openStatus').className = `status-line${type ? ` ${type}` : ''}`;
};
const money = (minor, currency) => new Intl.NumberFormat('th-TH', { style: 'currency', currency }).format(Number(minor) / 100);

function renderScene() {
  const scene = playback.currentScene();
  const asset = playback.currentAsset();
  if (!scene || !asset) return;
  if (assetUrl) URL.revokeObjectURL(assetUrl);
  assetUrl = URL.createObjectURL(new Blob([asset.bytes], { type: asset.mime_type }));
  $('#openImage').src = assetUrl;
  $('#openPosition').textContent = String(scene.position + 1);
  $('#openProduct').textContent = scene.product.title;
  $('#openPrice').textContent = `${money(scene.product.price_minor, scene.product.currency)} · snapshot stock ${scene.product.stock}`;
  $('#openScript').textContent = scene.script || 'ไม่มีบทพูดในฉากนี้';
  $('#openCue').textContent = `${scene.cue.label || 'คิวไม่มีชื่อ'} · ${scene.cue.duration_seconds} วินาที · ${scene.cue.transition}`;
  $('#previousScene').disabled = scene.position === 0;
  $('#nextScene').disabled = scene.position === playback.sceneCount - 1;
}

async function openPackage(file) {
  const ticket = ++openTicket;
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
    renderScene();
    $('#packageWorkspace').hidden = false;
    setStatus('แพ็กเกจถูกต้อง รูปทั้งหมดผ่านการตรวจ MIME และ SHA-256 แล้ว', 'success');
  } catch (error) {
    if (ticket !== openTicket) return;
    playback = null;
    setStatus(`${error.code || 'LIVE_PACKAGE_INVALID'}: ${error.message}`, 'error');
  }
}

if (typeof document !== 'undefined') {
  $('#packageFile').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (file) openPackage(file);
  });
  $('#previousScene').addEventListener('click', () => { playback?.previous(); renderScene(); });
  $('#nextScene').addEventListener('click', () => { playback?.next(); renderScene(); });
  addEventListener('beforeunload', () => { if (assetUrl) URL.revokeObjectURL(assetUrl); });
}
