const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MIN_EDGE = 256;
const MAX_SOURCE_EDGE = 4096;
const MAX_SOURCE_PIXELS = 24_000_000;
const OUTPUT_EDGE = 1024;
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
    try { return await sanitizeLivePortrait(request, env); }
    catch (error) { return jsonError(error); }
  },
};
