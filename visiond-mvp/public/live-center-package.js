export const LIVE_PACKAGE_FORMAT = 'visiond.live-package';
export const LIVE_PACKAGE_SCHEMA_VERSION = 1;
export const LIVE_PACKAGE_MAGIC_TEXT = 'VISIONDLIVE/1\n';
export const LIVE_PACKAGE_MAX_BYTES = 32 * 1024 * 1024;
export const LIVE_PACKAGE_MAX_ENVELOPE_BYTES = 1024 * 1024;
export const LIVE_PACKAGE_MAX_ASSET_BYTES = 5 * 1024 * 1024;
export const LIVE_PACKAGE_MAX_SCENES = 24;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const magic = encoder.encode(LIVE_PACKAGE_MAGIC_TEXT);
const showIdPattern = /^live_[a-f0-9]{32}$/;
const versionIdPattern = /^livev_[a-f0-9]{32}$/;
const assetIdPattern = /^livea_[a-f0-9]{32}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const mimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const avatarPresets = new Set(['visiond-default', 'presenter-placeholder', 'none']);
const outputProfiles = new Set(['landscape-1080p', 'portrait-1080p', 'square-1080p']);
const transitions = new Set(['cut', 'fade']);
const forbiddenKey = /(?:^|_)(?:password|passcode|cookie|authorization|access_?token|refresh_?token|stream_?key|client_?secret|api_?key|session)(?:$|_)/i;
const secretAssignment = /(?:password|passcode|cookie|authorization|access[\s_-]*token|refresh[\s_-]*token|stream[\s_-]*key|client[\s_-]*secret|api[\s_-]*key)\s*["']?\s*[:=]\s*["']?[^\s"',;]{4,}/i;
const bearerSecret = /\bbearer\s+[a-z0-9._~+\/-]{12,}/i;

export class LivePackageError extends Error {
  constructor(message, code = 'LIVE_PACKAGE_INVALID') {
    super(message);
    this.name = 'LivePackageError';
    this.code = code;
  }
}

const fail = (message, code) => {
  throw new LivePackageError(message, code);
};
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const stable = value => Array.isArray(value)
  ? value.map(stable)
  : isObject(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
    : value;
export const canonicalLiveJson = value => JSON.stringify(stable(value));

export async function livePackageSha256(value) {
  const bytes = typeof value === 'string'
    ? encoder.encode(value)
    : value instanceof Uint8Array
      ? value
      : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function exactObject(value, keys, path) {
  if (!isObject(value)) fail(`${path} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${path} has missing or unsupported fields`);
  }
  return value;
}

function stringValue(value, path, { min = 0, max = 12000, pattern = null } = {}) {
  if (typeof value !== 'string' || value.length < min || value.length > max || (pattern && !pattern.test(value))) {
    fail(`${path} is invalid`);
  }
  return value;
}

function integerValue(value, path, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${path} is invalid`);
  return value;
}

function scanSecrets(value, path = 'envelope') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanSecrets(item, `${path}[${index}]`));
    return;
  }
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKey.test(key)) fail(`${path}.${key} is security-sensitive`, 'LIVE_PACKAGE_SECRET');
      scanSecrets(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && (secretAssignment.test(value) || bearerSecret.test(value))) {
    fail(`${path} contains credential-like data`, 'LIVE_PACKAGE_SECRET');
  }
}

export function scanLivePackageSecretBytes(bytes, path = 'embedded asset') {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let carry = '';
  for (let offset = 0; offset < input.byteLength; offset += 16384) {
    const end = Math.min(input.byteLength, offset + 16384);
    let text = carry;
    for (let index = offset; index < end; index += 1) {
      const byte = input[index];
      text += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ' ';
    }
    if (secretAssignment.test(text) || bearerSecret.test(text)) fail(`${path} contains credential-like data`, 'LIVE_PACKAGE_SECRET');
    carry = text.slice(-256);
  }
}

function imageMagicMatches(bytes, mimeType) {
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (mimeType === 'image/webp') {
    return bytes.length >= 12
      && String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  }
  return false;
}

async function inputBytes(input) {
  if (input instanceof Uint8Array) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    if (input.size > LIVE_PACKAGE_MAX_BYTES) fail('Package exceeds 32 MiB', 'LIVE_PACKAGE_TOO_LARGE');
    return new Uint8Array(await input.arrayBuffer());
  }
  fail('Package input must be an ArrayBuffer, Uint8Array, or Blob');
}

function validateScene(scene, index, productIds, assetIds) {
  exactObject(scene, ['position', 'product', 'script', 'cue', 'assets'], `manifest.scenes[${index}]`);
  if (integerValue(scene.position, `manifest.scenes[${index}].position`, { max: LIVE_PACKAGE_MAX_SCENES - 1 }) !== index) {
    fail('Scene positions must be contiguous and ordered');
  }
  const product = exactObject(scene.product, ['id', 'meta_id', 'title', 'price_minor', 'currency', 'stock'], `manifest.scenes[${index}].product`);
  integerValue(product.id, `manifest.scenes[${index}].product.id`, { min: 1 });
  if (productIds.has(product.id)) fail('Scene products must be unique');
  productIds.add(product.id);
  stringValue(product.meta_id, `manifest.scenes[${index}].product.meta_id`, { min: 1, max: 200 });
  stringValue(product.title, `manifest.scenes[${index}].product.title`, { min: 1, max: 500 });
  integerValue(product.price_minor, `manifest.scenes[${index}].product.price_minor`);
  stringValue(product.currency, `manifest.scenes[${index}].product.currency`, { min: 3, max: 12, pattern: /^[A-Z0-9_-]+$/ });
  integerValue(product.stock, `manifest.scenes[${index}].product.stock`);
  stringValue(scene.script, `manifest.scenes[${index}].script`, { max: 12000 });
  const cue = exactObject(scene.cue, ['label', 'duration_seconds', 'transition'], `manifest.scenes[${index}].cue`);
  stringValue(cue.label, `manifest.scenes[${index}].cue.label`, { max: 120 });
  integerValue(cue.duration_seconds, `manifest.scenes[${index}].cue.duration_seconds`, { min: 5, max: 3600 });
  if (!transitions.has(cue.transition)) fail(`manifest.scenes[${index}].cue.transition is invalid`);
  if (!Array.isArray(scene.assets) || scene.assets.length !== 1) fail('Each scene must contain exactly one primary asset');
  const asset = exactObject(scene.assets[0], ['id', 'position', 'reference', 'mime_type', 'size', 'integrity', 'primary'], `manifest.scenes[${index}].assets[0]`);
  stringValue(asset.id, `manifest.scenes[${index}].assets[0].id`, { pattern: assetIdPattern });
  if (assetIds.has(asset.id)) fail('Asset IDs must be unique');
  assetIds.add(asset.id);
  integerValue(asset.position, `manifest.scenes[${index}].assets[0].position`, { max: 9 });
  if (asset.reference !== `visiondlive://assets/${asset.id}`) fail('Asset reference is invalid');
  if (!mimeTypes.has(asset.mime_type)) fail('Asset MIME type is invalid');
  integerValue(asset.size, `manifest.scenes[${index}].assets[0].size`, { min: 1, max: LIVE_PACKAGE_MAX_ASSET_BYTES });
  if (asset.primary !== true) fail('Scene asset must be primary');
  const integrity = exactObject(asset.integrity, ['sha256', 'etag'], `manifest.scenes[${index}].assets[0].integrity`);
  stringValue(integrity.sha256, `manifest.scenes[${index}].assets[0].integrity.sha256`, { pattern: digestPattern });
  if (integrity.etag !== null) stringValue(integrity.etag, `manifest.scenes[${index}].assets[0].integrity.etag`, { min: 1, max: 256 });
  return asset;
}

function validateManifestShape(manifest) {
  exactObject(manifest, ['show', 'version', 'scenes', 'embedded_assets', 'runtime', 'created'], 'manifest');
  const show = exactObject(manifest.show, ['id', 'title', 'description', 'revision', 'avatar', 'output'], 'manifest.show');
  stringValue(show.id, 'manifest.show.id', { pattern: showIdPattern });
  stringValue(show.title, 'manifest.show.title', { min: 1, max: 160 });
  stringValue(show.description, 'manifest.show.description', { max: 2000 });
  integerValue(show.revision, 'manifest.show.revision', { min: 1 });
  const avatar = exactObject(show.avatar, ['preset'], 'manifest.show.avatar');
  if (!avatarPresets.has(avatar.preset)) fail('manifest.show.avatar.preset is invalid');
  const output = exactObject(show.output, ['profile'], 'manifest.show.output');
  if (!outputProfiles.has(output.profile)) fail('manifest.show.output.profile is invalid');

  const version = exactObject(manifest.version, ['id', 'number'], 'manifest.version');
  stringValue(version.id, 'manifest.version.id', { pattern: versionIdPattern });
  integerValue(version.number, 'manifest.version.number', { min: 1 });

  if (!Array.isArray(manifest.scenes) || manifest.scenes.length < 1 || manifest.scenes.length > LIVE_PACKAGE_MAX_SCENES) {
    fail(`manifest.scenes must contain 1-${LIVE_PACKAGE_MAX_SCENES} scenes`);
  }
  const productIds = new Set();
  const assetIds = new Set();
  const sceneAssets = manifest.scenes.map((scene, index) => validateScene(scene, index, productIds, assetIds));

  if (!Array.isArray(manifest.embedded_assets) || manifest.embedded_assets.length !== sceneAssets.length) {
    fail('Embedded assets must match scenes one-to-one');
  }
  const descriptorIds = new Set();
  let expectedOffset = 0;
  const descriptors = manifest.embedded_assets.map((descriptor, index) => {
    exactObject(descriptor, ['id', 'reference', 'offset', 'length', 'mime_type', 'sha256'], `manifest.embedded_assets[${index}]`);
    stringValue(descriptor.id, `manifest.embedded_assets[${index}].id`, { pattern: assetIdPattern });
    if (descriptorIds.has(descriptor.id)) fail('Embedded asset IDs must be unique');
    descriptorIds.add(descriptor.id);
    if (descriptor.reference !== `visiondlive://assets/${descriptor.id}`) fail('Embedded asset reference is invalid');
    integerValue(descriptor.offset, `manifest.embedded_assets[${index}].offset`, { max: LIVE_PACKAGE_MAX_BYTES });
    if (descriptor.offset !== expectedOffset) fail('Embedded asset offsets must be contiguous and payload-relative');
    integerValue(descriptor.length, `manifest.embedded_assets[${index}].length`, { min: 1, max: LIVE_PACKAGE_MAX_ASSET_BYTES });
    expectedOffset += descriptor.length;
    if (!Number.isSafeInteger(expectedOffset) || expectedOffset > LIVE_PACKAGE_MAX_BYTES) fail('Embedded asset bounds are invalid');
    if (!mimeTypes.has(descriptor.mime_type)) fail('Embedded asset MIME type is invalid');
    stringValue(descriptor.sha256, `manifest.embedded_assets[${index}].sha256`, { pattern: digestPattern });
    const sceneAsset = sceneAssets[index];
    if (descriptor.id !== sceneAsset.id
      || descriptor.reference !== sceneAsset.reference
      || descriptor.mime_type !== sceneAsset.mime_type
      || descriptor.length !== sceneAsset.size
      || descriptor.sha256 !== sceneAsset.integrity.sha256) {
      fail('Scene asset and embedded descriptor do not match exactly');
    }
    return descriptor;
  });

  const runtime = exactObject(manifest.runtime, ['local_cache', 'adapters', 'livestream_launch'], 'manifest.runtime');
  const localCache = exactObject(runtime.local_cache, ['required', 'cache_key', 'preload_assets'], 'manifest.runtime.local_cache');
  if (localCache.required !== true || localCache.preload_assets !== true) fail('Runtime must preload the local asset cache');
  if (localCache.cache_key !== `${show.id}:v${version.number}`) fail('Runtime cache key is invalid');
  const adapters = exactObject(runtime.adapters, ['facebook', 'tiktok', 'shopee'], 'manifest.runtime.adapters');
  if (adapters.facebook !== 'placeholder' || adapters.tiktok !== 'later' || adapters.shopee !== 'later') fail('Runtime adapters are invalid');
  if (runtime.livestream_launch !== false) fail('Phase 1 packages cannot launch a livestream');

  const created = exactObject(manifest.created, ['at'], 'manifest.created');
  stringValue(created.at, 'manifest.created.at', { min: 20, max: 40 });
  if (!Number.isFinite(Date.parse(created.at))) fail('manifest.created.at is invalid');
  return { descriptors, expectedPayloadBytes: expectedOffset };
}

export async function parseVisionDLivePackage(input) {
  const bytes = await inputBytes(input);
  if (bytes.byteLength > LIVE_PACKAGE_MAX_BYTES) fail('Package exceeds 32 MiB', 'LIVE_PACKAGE_TOO_LARGE');
  if (bytes.byteLength < magic.byteLength + 4 + 2) fail('Package is truncated');
  if (!magic.every((byte, index) => bytes[index] === byte)) fail('Package magic is invalid');
  const envelopeLength = new DataView(bytes.buffer, bytes.byteOffset + magic.byteLength, 4).getUint32(0, false);
  if (envelopeLength < 2 || envelopeLength > LIVE_PACKAGE_MAX_ENVELOPE_BYTES) fail('Envelope length is invalid');
  const envelopeStart = magic.byteLength + 4;
  const payloadStart = envelopeStart + envelopeLength;
  if (payloadStart > bytes.byteLength) fail('Package envelope is truncated');
  let envelopeText;
  try {
    envelopeText = decoder.decode(bytes.subarray(envelopeStart, payloadStart));
  } catch {
    fail('Envelope is not valid UTF-8');
  }
  let envelope;
  try {
    envelope = JSON.parse(envelopeText);
  } catch {
    fail('Envelope JSON is invalid');
  }
  if (canonicalLiveJson(envelope) !== envelopeText) fail('Envelope JSON is not canonical');
  scanSecrets(envelope);
  exactObject(envelope, ['format', 'schema_version', 'manifest', 'integrity'], 'envelope');
  if (envelope.format !== LIVE_PACKAGE_FORMAT) fail('Package format is unsupported');
  if (envelope.schema_version !== LIVE_PACKAGE_SCHEMA_VERSION) fail('Package schema is unsupported');
  const integrity = exactObject(envelope.integrity, ['algorithm', 'manifest_sha256'], 'envelope.integrity');
  if (integrity.algorithm !== 'sha256') fail('Package integrity algorithm is unsupported');
  stringValue(integrity.manifest_sha256, 'envelope.integrity.manifest_sha256', { pattern: digestPattern });
  const manifestSha256 = await livePackageSha256(canonicalLiveJson(envelope.manifest));
  if (manifestSha256 !== integrity.manifest_sha256) fail('Manifest digest does not match');
  const { descriptors, expectedPayloadBytes } = validateManifestShape(envelope.manifest);
  if (payloadStart + expectedPayloadBytes !== bytes.byteLength) fail('Asset payload is truncated or has trailing bytes');

  const assets = new Map();
  for (const descriptor of descriptors) {
    const start = payloadStart + descriptor.offset;
    const end = start + descriptor.length;
    if (start < payloadStart || end < start || end > bytes.byteLength) fail('Embedded asset bounds are invalid');
    const assetBytes = bytes.slice(start, end);
    if (!imageMagicMatches(assetBytes, descriptor.mime_type)) fail('Embedded asset MIME signature is invalid');
    scanLivePackageSecretBytes(assetBytes, `embedded asset ${descriptor.id}`);
    if (await livePackageSha256(assetBytes) !== descriptor.sha256) fail('Embedded asset digest does not match');
    assets.set(descriptor.id, Object.freeze({ ...descriptor, bytes: assetBytes }));
  }
  return Object.freeze({
    envelope,
    manifest: envelope.manifest,
    assets,
    package_bytes: bytes,
    package_sha256: await livePackageSha256(bytes),
  });
}

export function createLocalLivePlayback(parsed) {
  if (!parsed || !isObject(parsed.manifest) || !(parsed.assets instanceof Map)) fail('Parsed package is invalid');
  const scenes = parsed.manifest.scenes;
  const localAssets = new Map(parsed.assets);
  let sceneIndex = 0;
  const current = () => scenes[sceneIndex] || null;
  const assetForScene = scene => scene ? localAssets.get(scene.assets[0].id) || null : null;
  return Object.freeze({
    manifest: parsed.manifest,
    sceneCount: scenes.length,
    currentScene: current,
    currentAsset: () => assetForScene(current()),
    getAsset: idOrReference => {
      const value = String(idOrReference || '');
      const id = value.startsWith('visiondlive://assets/') ? value.slice('visiondlive://assets/'.length) : value;
      return localAssets.get(id) || null;
    },
    next: () => {
      if (sceneIndex < scenes.length - 1) sceneIndex += 1;
      return current();
    },
    previous: () => {
      if (sceneIndex > 0) sceneIndex -= 1;
      return current();
    },
    reset: () => {
      sceneIndex = 0;
      return current();
    },
  });
}
