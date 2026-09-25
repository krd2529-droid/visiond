import { LiveAvatarProviderError, liveExternalIntegrationHealth } from './_live_avatar_provider.js';

const MAX_TEXT = 700;
const MAX_PCM_BYTES = 8 * 1024 * 1024;
const VOICES = new Set(['th-TH-PremwadeeNeural', 'th-TH-NiwatNeural', 'th-TH-AcharaNeural']);
const RESOURCE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const PCM_CONTENT_TYPES = new Set(['application/octet-stream', 'audio/basic', 'audio/l16', 'audio/wav', 'audio/x-wav']);
const xml = value => String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));

async function readBoundedBody(response, maximum) {
  const length = Number(response.headers?.get?.('content-length') || 0);
  if (length > maximum) throw new LiveAvatarProviderError('AZURE_AUDIO_TOO_LARGE', 'เสียงภาษาไทยยาวเกินกำหนด', 502);
  const reader = response.body?.getReader?.();
  if (!reader) throw new LiveAvatarProviderError('AZURE_AUDIO_INVALID', 'รูปแบบเสียงภาษาไทยไม่ถูกต้อง', 502);
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > maximum) throw new LiveAvatarProviderError('AZURE_AUDIO_TOO_LARGE', 'เสียงภาษาไทยยาวเกินกำหนด', 502);
      chunks.push(chunk);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function synthesizeLiveThaiPcm(env, text, { fetchImpl = fetch, signal } = {}) {
  if (!liveExternalIntegrationHealth(env).thai_voice.connected) {
    throw new LiveAvatarProviderError('AZURE_SPEECH_NOT_CONFIGURED', 'ยังไม่ได้เชื่อมต่อเสียงภาษาไทย');
  }
  const normalized = String(text || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > MAX_TEXT) throw new LiveAvatarProviderError('AZURE_TEXT_INVALID', 'ข้อความเสียงภาษาไทยไม่ถูกต้อง', 400);
  const resource = String(env.AZURE_SPEECH_RESOURCE_NAME || '');
  const voice = String(env.AZURE_SPEECH_VOICE || '');
  if (!RESOURCE.test(resource) || !VOICES.has(voice)) throw new LiveAvatarProviderError('AZURE_SPEECH_NOT_CONFIGURED', 'ยังไม่ได้เชื่อมต่อเสียงภาษาไทย');
  const ssml = `<speak version="1.0" xml:lang="th-TH"><voice name="${voice}">${xml(normalized)}</voice></speak>`;
  let response;
  try {
    response = await fetchImpl(`https://${resource}.cognitiveservices.azure.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'content-type': 'application/ssml+xml',
        'x-microsoft-outputformat': 'raw-24khz-16bit-mono-pcm',
        'user-agent': 'VisionD-LiveCenter',
        'ocp-apim-subscription-key': String(env.AZURE_SPEECH_KEY || ''),
      },
      body: ssml,
      signal,
    });
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    throw new LiveAvatarProviderError('AZURE_SPEECH_FAILED', 'สร้างเสียงภาษาไทยไม่สำเร็จ');
  }
  if (!response.ok) {
    const code = response.status === 429 ? 'AZURE_SPEECH_RATE_LIMITED' : 'AZURE_SPEECH_FAILED';
    throw new LiveAvatarProviderError(code, 'สร้างเสียงภาษาไทยไม่สำเร็จ');
  }
  const contentType = String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!PCM_CONTENT_TYPES.has(contentType)) throw new LiveAvatarProviderError('AZURE_AUDIO_INVALID', 'รูปแบบเสียงภาษาไทยไม่ถูกต้อง', 502);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_PCM_BYTES) throw new LiveAvatarProviderError('AZURE_AUDIO_TOO_LARGE', 'เสียงภาษาไทยยาวเกินกำหนด', 502);
  const bytes = await readBoundedBody(response, MAX_PCM_BYTES);
  if (!bytes.byteLength || bytes.byteLength > MAX_PCM_BYTES || bytes.byteLength % 2 !== 0) {
    throw new LiveAvatarProviderError('AZURE_AUDIO_INVALID', 'รูปแบบเสียงภาษาไทยไม่ถูกต้อง', 502);
  }
  return Object.freeze({ bytes, format: 'pcm_s16le', sampleRate: 24000, channels: 1, voice, locale: 'th-TH' });
}
