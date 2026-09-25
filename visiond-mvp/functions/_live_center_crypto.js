const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PREFIX = 'vdlc1:';

const base64 = bytes => btoa(String.fromCharCode(...bytes));
const unbase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
const contextAad = context => encoder.encode(`visiond-live-center-provider-v1\n${String(context || '')}`);

async function encryptionKey(env) {
  const secret = String(env.LIVE_CENTER_PROVIDER_ENCRYPTION_KEY || '');
  if (secret.length < 32) throw new Error('LIVE_CENTER_PROVIDER_ENCRYPTION_NOT_CONFIGURED');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export const liveProviderEncryptionReady = env => String(env.LIVE_CENTER_PROVIDER_ENCRYPTION_KEY || '').length >= 32;

export async function encryptLiveProviderRef(env, value, context) {
  const plain = String(value || '');
  if (!plain || plain.length > 2048) throw new Error('LIVE_CENTER_PROVIDER_REF_INVALID');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv,
    additionalData: contextAad(context),
  }, await encryptionKey(env), encoder.encode(plain));
  return `${PREFIX}${base64(iv)}:${base64(new Uint8Array(encrypted))}`;
}

export async function decryptLiveProviderRef(env, ciphertext, context) {
  const value = String(ciphertext || '');
  if (!value.startsWith(PREFIX)) throw new Error('LIVE_CENTER_PROVIDER_CIPHERTEXT_INVALID');
  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 2) throw new Error('LIVE_CENTER_PROVIDER_CIPHERTEXT_INVALID');
  const decrypted = await crypto.subtle.decrypt({
    name: 'AES-GCM',
    iv: unbase64(parts[0]),
    additionalData: contextAad(context),
  }, await encryptionKey(env), unbase64(parts[1]));
  return decoder.decode(decrypted);
}
