import { liveProviderEncryptionReady } from './_live_center_crypto.js';

export const LIVE_AVATAR_PROVIDER = 'd-id';
export const LIVE_AVATAR_PROVIDER_CAPABILITIES = Object.freeze({
  dynamicPortraitCreate: false,
  sanitizedImageUpload: true,
  rawPcmInput: false,
  audioUrlInput: true,
  remoteInterrupt: false,
  webrtc: true,
  consentProof: false,
  deleteRemote: false,
});

const DID_IMAGE_ENDPOINT = 'https://api.d-id.com/images';
const DID_BASIC = /^Basic [A-Za-z0-9+/]+={0,2}$/;
const AZURE_RESOURCE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const AZURE_VOICES = new Set([
  'th-TH-PremwadeeNeural',
  'th-TH-NiwatNeural',
  'th-TH-AcharaNeural',
]);
const FACEBOOK_ID = /^\d{5,32}$/;

const present = (value, minimum = 20) => String(value || '').length >= minimum;
const didImageConfigured = env => DID_BASIC.test(String(env.DID_BASIC_AUTHORIZATION || ''));
const azureConfigured = env => AZURE_RESOURCE.test(String(env.AZURE_SPEECH_RESOURCE_NAME || ''))
  && present(env.AZURE_SPEECH_KEY)
  && AZURE_VOICES.has(String(env.AZURE_SPEECH_VOICE || ''));
const facebookConfigured = env => FACEBOOK_ID.test(String(env.FACEBOOK_PAGE_ID || ''))
  && FACEBOOK_ID.test(String(env.FACEBOOK_APP_ID || ''))
  && present(env.FACEBOOK_PAGE_ACCESS_TOKEN)
  && present(env.FACEBOOK_APP_SECRET)
  && present(env.FACEBOOK_WEBHOOK_VERIFY_TOKEN);

export function liveExternalIntegrationHealth(env) {
  const normalizer = Boolean(env.PORTRAIT_SANITIZER && typeof env.PORTRAIT_SANITIZER.fetch === 'function');
  const storage = Boolean(env.FILES && typeof env.FILES.put === 'function' && typeof env.FILES.get === 'function');
  const encryptedRefs = liveProviderEncryptionReady(env);
  const didImage = didImageConfigured(env);
  const azure = azureConfigured(env);
  const facebook = facebookConfigured(env);
  return Object.freeze({
    portrait_storage: storage,
    server_pixel_reencode: normalizer,
    avatar: Object.freeze({
      provider: LIVE_AVATAR_PROVIDER,
      connected: false,
      image_upload_configured: didImage && encryptedRefs,
      provisioning_contract_verified: false,
      session_contract_verified: false,
      capabilities: LIVE_AVATAR_PROVIDER_CAPABILITIES,
    }),
    thai_voice: Object.freeze({
      provider: 'azure-speech',
      connected: azure,
      locale: 'th-TH',
      format: 'raw-24khz-16bit-mono-pcm',
    }),
    facebook: Object.freeze({
      connected: facebook,
      comments_read_only: facebook,
      named_viewer_join: false,
      live_start: false,
      graph_version: 'v26.0',
    }),
    local_test: String(env.LIVE_CENTER_LOCAL_TEST_ENABLED || '') === '1',
  });
}

export class LiveAvatarProviderError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'LiveAvatarProviderError';
    this.code = code;
    this.status = status;
  }
}

const providerError = status => {
  if (status === 400 || status === 415) return new LiveAvatarProviderError('DID_IMAGE_REJECTED', 'ผู้ให้บริการไม่รับรูปอนุพันธ์นี้', 422);
  if (status === 402) return new LiveAvatarProviderError('DID_CREDIT_REQUIRED', 'บัญชีผู้ให้บริการไม่มีเครดิตพร้อมใช้งาน', 503);
  if (status === 451) return new LiveAvatarProviderError('DID_MODERATION_REJECTED', 'รูปไม่ผ่านนโยบายของผู้ให้บริการ', 422);
  if (status === 429) return new LiveAvatarProviderError('DID_RATE_LIMITED', 'ผู้ให้บริการจำกัดคำขอชั่วคราว กรุณาลองใหม่ภายหลัง', 503);
  return new LiveAvatarProviderError('DID_IMAGE_UPLOAD_FAILED', 'เชื่อมต่อผู้ให้บริการรูปไม่สำเร็จ', 503);
};

async function readBoundedText(response, maximum) {
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > maximum) throw providerError(502);
  const reader = response.body?.getReader?.();
  if (!reader) throw providerError(502);
  const decoder = new TextDecoder();
  let text = '';
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > maximum) throw providerError(502);
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  if (text.length > maximum) throw providerError(502);
  return text;
}

export async function uploadSanitizedDidImage(env, jpegBytes, { fetchImpl = fetch, signal } = {}) {
  const authorization = String(env.DID_BASIC_AUTHORIZATION || '');
  if (!DID_BASIC.test(authorization)) throw new LiveAvatarProviderError('DID_NOT_CONFIGURED', 'ยังไม่ได้เชื่อมต่อผู้ให้บริการ Avatar');
  const bytes = jpegBytes instanceof Uint8Array ? jpegBytes : new Uint8Array(jpegBytes || 0);
  if (bytes.byteLength < 4 || bytes.byteLength > 5 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new LiveAvatarProviderError('DID_SANITIZED_IMAGE_REQUIRED', 'ต้องใช้รูปอนุพันธ์ JPEG ที่ผ่านการทำความสะอาดแล้ว', 400);
  }
  const form = new FormData();
  form.set('image', new Blob([bytes], { type: 'image/jpeg' }), 'visiond-presenter.jpg');
  let response;
  try {
    response = await fetchImpl(DID_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: { authorization, accept: 'application/json' },
      body: form,
      signal,
    });
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    throw providerError(503);
  }
  if (!response.ok) throw providerError(response.status);
  const raw = await readBoundedText(response, 8192);
  let payload;
  try { payload = JSON.parse(raw); } catch { throw providerError(502); }
  const providerId = typeof payload?.id === 'string' ? payload.id : typeof payload?.image_id === 'string' ? payload.image_id : '';
  const temporaryUrl = typeof payload?.url === 'string' ? payload.url : typeof payload?.image_url === 'string' ? payload.image_url : '';
  if (!providerId || providerId.length > 512 || !temporaryUrl || temporaryUrl.length > 2048) throw providerError(502);
  let parsed;
  try { parsed = new URL(temporaryUrl); } catch { throw providerError(502); }
  if (parsed.protocol !== 'https:'
    || !/(?:^|\.)d-id\.com$/i.test(parsed.hostname)
    || parsed.username || parsed.password
    || parsed.port && parsed.port !== '443'
    || parsed.hash) throw providerError(502);
  return Object.freeze({ providerId, temporaryUrl });
}

export function createLiveAvatarAdapter({ env, transport = null } = {}) {
  const health = liveExternalIntegrationHealth(env || {});
  const unavailable = () => { throw new LiveAvatarProviderError('DID_AGENT_CONTRACT_UNAVAILABLE', 'ยังไม่ได้เชื่อมต่อ Avatar: ต้องยืนยันสัญญา Agent และ session กับบัญชีผู้ให้บริการก่อน'); };
  return Object.freeze({
    provider: LIVE_AVATAR_PROVIDER,
    capabilities: LIVE_AVATAR_PROVIDER_CAPABILITIES,
    health: () => health.avatar,
    createPortrait: transport?.createPortrait || unavailable,
    startSession: transport?.startSession || unavailable,
    speakAudioUrl: transport?.speakAudioUrl || unavailable,
    interrupt: transport?.interrupt || unavailable,
    stopSession: transport?.stopSession || unavailable,
    deletePortrait: transport?.deletePortrait || unavailable,
  });
}
