const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MIN_EDGE = 256;
const MAX_SOURCE_EDGE = 4096;
const MAX_SOURCE_PIXELS = 24_000_000;
const OUTPUT_EDGE = 1024;
const VPAGE_MAX_SOURCE_PIXELS = 16_777_216;
const VPAGE_OUTPUT_FORMAT = 'image/webp';
const PRIVATE_HEADERS = Object.freeze({
  'cache-control': 'no-store, private',
  'content-security-policy': "default-src 'none'",
  'x-content-type-options': 'nosniff',
});

class SanitizerError extends Error {
  constructor(code, status) {
    super(code);
    this.name = 'SanitizerError';
    this.code = code;
    this.status = status;
  }
}

const jsonError = error => new Response(JSON.stringify({ error: error.code || 'PORTRAIT_SANITIZER_FAILED' }), {
  status: error.status || 503,
  headers: { ...PRIVATE_HEADERS, 'content-type': 'application/json; charset=utf-8' },
});

const sha256Hex = async bytes => {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
};

async function readBoundedStream(stream, maximum, code) {
  const reader = stream?.getReader?.();
  if (!reader) throw new SanitizerError(code, 422);
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > maximum) throw new SanitizerError(code, 413);
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

const validImageInfo = info => {
  const format = String(info?.format || '').toLowerCase();
  const width = Number(info?.width);
  const height = Number(info?.height);
  const pixels = width * height;
  const scale = Math.min(1, OUTPUT_EDGE / Math.max(width, height));
  const projectedShortEdge = Math.round(Math.min(width, height) * scale);
  return ['jpeg', 'jpg', 'image/jpeg'].includes(format)
    && Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width >= MIN_EDGE && height >= MIN_EDGE
    && width <= MAX_SOURCE_EDGE && height <= MAX_SOURCE_EDGE
    && Number.isSafeInteger(pixels) && pixels <= MAX_SOURCE_PIXELS
    && projectedShortEdge >= MIN_EDGE;
};

const normalizedImageFormat = value => {
  const format = String(value || '').toLowerCase();
  if (['jpeg', 'jpg', 'image/jpeg'].includes(format)) return 'image/jpeg';
  if (['png', 'image/png'].includes(format)) return 'image/png';
  if (['webp', 'image/webp'].includes(format)) return 'image/webp';
  return '';
};

const validVpageImageInfo = (info, declaredType) => {
  const width = Number(info?.width);
  const height = Number(info?.height);
  const pixels = width * height;
  return normalizedImageFormat(info?.format) === declaredType
    && Number.isSafeInteger(width) && Number.isSafeInteger(height)
    && width >= 1 && height >= 1
    && width <= MAX_SOURCE_EDGE && height <= MAX_SOURCE_EDGE
    && Number.isSafeInteger(pixels) && pixels <= VPAGE_MAX_SOURCE_PIXELS;
};

export async function sanitizeVpageImage(request, env) {
  const url = new URL(request.url);
  if (url.origin !== 'https://portrait-sanitizer.internal' || url.pathname !== '/v1/vpage-reencode' || request.method !== 'POST') {
    throw new SanitizerError('VPAGE_SANITIZER_NOT_FOUND', 404);
  }
  const declaredType = String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (request.headers.get('x-visiond-sanitizer-protocol') !== '2'
    || !['image/jpeg', 'image/png', 'image/webp'].includes(declaredType)) {
    throw new SanitizerError('VPAGE_SANITIZER_PROTOCOL_INVALID', 415);
  }
  if (!env?.IMAGES || typeof env.IMAGES.info !== 'function' || typeof env.IMAGES.input !== 'function') {
    throw new SanitizerError('VPAGE_SANITIZER_IMAGES_UNAVAILABLE', 503);
  }
  const advertised = Number(request.headers.get('x-visiond-input-bytes') || 0);
  if (!Number.isSafeInteger(advertised) || advertised < 1 || advertised > MAX_INPUT_BYTES) {
    throw new SanitizerError('VPAGE_SANITIZER_INPUT_SIZE_INVALID', 413);
  }
  const input = await readBoundedStream(request.body, MAX_INPUT_BYTES, 'VPAGE_SANITIZER_INPUT_TOO_LARGE');
  if (input.byteLength !== advertised) {
    input.fill(0);
    throw new SanitizerError('VPAGE_SANITIZER_INPUT_INVALID', 422);
  }
  let info;
  let output;
  let outputInfo;
  try { info = await env.IMAGES.info(new Blob([input]).stream()); }
  catch {
    input.fill(0);
    throw new SanitizerError('VPAGE_SANITIZER_INPUT_INVALID', 422);
  }
  if (!validVpageImageInfo(info, declaredType)) {
    input.fill(0);
    throw new SanitizerError('VPAGE_SANITIZER_INPUT_INVALID', 422);
  }
  try {
    const result = await env.IMAGES
      .input(new Blob([input]).stream())
      .transform({ width: MAX_SOURCE_EDGE, height: MAX_SOURCE_EDGE, fit: 'scale-down' })
      .output({ format: VPAGE_OUTPUT_FORMAT, quality: 88, anim: false });
    const response = result.response();
    if (!response?.ok || String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase() !== VPAGE_OUTPUT_FORMAT) {
      throw new SanitizerError('VPAGE_SANITIZER_OUTPUT_INVALID', 503);
    }
    output = await readBoundedStream(response.body, MAX_OUTPUT_BYTES, 'VPAGE_SANITIZER_OUTPUT_TOO_LARGE');
    if (output.byteLength < 26) throw new SanitizerError('VPAGE_SANITIZER_OUTPUT_INVALID', 503);
    try { outputInfo = await env.IMAGES.info(new Blob([output]).stream()); }
    catch { throw new SanitizerError('VPAGE_SANITIZER_OUTPUT_INVALID', 503); }
    if (!validVpageImageInfo(outputInfo, VPAGE_OUTPUT_FORMAT)
      || Number(outputInfo.width) !== Number(info.width)
      || Number(outputInfo.height) !== Number(info.height)) {
      throw new SanitizerError('VPAGE_SANITIZER_OUTPUT_INVALID', 503);
    }
  } catch (error) {
    if (error instanceof SanitizerError) throw error;
    throw new SanitizerError('VPAGE_SANITIZER_IMAGES_FAILED', 503);
  } finally {
    input.fill(0);
  }
  return new Response(output, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      'content-type': VPAGE_OUTPUT_FORMAT,
      'content-length': String(output.byteLength),
      'x-visiond-sanitizer': 'cloudflare-images-v1',
      'x-visiond-output-bytes': String(output.byteLength),
      'x-visiond-output-width': String(outputInfo.width),
      'x-visiond-output-height': String(outputInfo.height),
      'x-visiond-output-sha256': await sha256Hex(output),
    },
  });
}

export async function sanitizeLivePortrait(request, env) {
  const url = new URL(request.url);
  if (url.origin !== 'https://portrait-sanitizer.internal' || url.pathname !== '/v1/reencode' || request.method !== 'POST') {
    throw new SanitizerError('PORTRAIT_SANITIZER_NOT_FOUND', 404);
  }
  if (request.headers.get('x-visiond-sanitizer-protocol') !== '1'
    || String(request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'image/jpeg') {
    throw new SanitizerError('PORTRAIT_SANITIZER_PROTOCOL_INVALID', 415);
  }
  if (!env?.IMAGES || typeof env.IMAGES.info !== 'function' || typeof env.IMAGES.input !== 'function') {
    throw new SanitizerError('PORTRAIT_SANITIZER_IMAGES_UNAVAILABLE', 503);
  }
  const advertised = Number(request.headers.get('x-visiond-input-bytes') || 0);
  if (!Number.isSafeInteger(advertised) || advertised < 64 || advertised > MAX_INPUT_BYTES) {
    throw new SanitizerError('PORTRAIT_SANITIZER_INPUT_SIZE_INVALID', 413);
  }
  const input = await readBoundedStream(request.body, MAX_INPUT_BYTES, 'PORTRAIT_SANITIZER_INPUT_TOO_LARGE');
  if (input.byteLength !== advertised || input[0] !== 0xff || input[1] !== 0xd8) {
    input.fill(0);
    throw new SanitizerError('PORTRAIT_SANITIZER_INPUT_INVALID', 422);
  }
  let output;
  let info;
  try { info = await env.IMAGES.info(new Blob([input]).stream()); }
  catch {
    input.fill(0);
    throw new SanitizerError('PORTRAIT_SANITIZER_INPUT_INVALID', 422);
  }
  if (!validImageInfo(info)) {
    input.fill(0);
    throw new SanitizerError('PORTRAIT_SANITIZER_DIMENSIONS_INVALID', 422);
  }
  try {
    const result = await env.IMAGES
      .input(new Blob([input]).stream())
      .transform({ width: OUTPUT_EDGE, height: OUTPUT_EDGE, fit: 'scale-down' })
      .output({ format: 'image/jpeg', quality: 85, anim: false });
    const response = result.response();
    if (!response?.ok || String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase() !== 'image/jpeg') {
      throw new SanitizerError('PORTRAIT_SANITIZER_OUTPUT_INVALID', 503);
    }
    output = await readBoundedStream(response.body, MAX_OUTPUT_BYTES, 'PORTRAIT_SANITIZER_OUTPUT_TOO_LARGE');
    if (output.byteLength < 64 || output[0] !== 0xff || output[1] !== 0xd8) {
      throw new SanitizerError('PORTRAIT_SANITIZER_OUTPUT_INVALID', 503);
    }
  } catch (error) {
    if (error instanceof SanitizerError) throw error;
    throw new SanitizerError('PORTRAIT_SANITIZER_IMAGES_FAILED', 503);
  } finally {
    input.fill(0);
  }
  return new Response(output, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      'content-type': 'image/jpeg',
      'content-length': String(output.byteLength),
      'x-visiond-sanitizer': 'cloudflare-images-v1',
    },
  });
}

export default {
  async fetch(request, env) {
    try {
      if (new URL(request.url).pathname === '/v1/vpage-reencode') return await sanitizeVpageImage(request, env);
      return await sanitizeLivePortrait(request, env);
    }
    catch (error) { return jsonError(error); }
  },
};
