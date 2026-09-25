import { requireAdmin } from './_lib.js';
import {
  LIVE_PRIVATE_HEADERS,
  canonicalLiveJson,
  decodeLiveCursor,
  encodeLiveCursor,
  liveJson,
  liveSha256,
  privateLiveResponse,
} from './_live_center.js';
import { rateLimitIdentityAtomic } from './_security.js';
import { createLiveAvatarAdapter, liveExternalIntegrationHealth } from './_live_avatar_provider.js';

export const LIVE_PORTRAIT_CONSENT_POLICY = 'visiond-live-portrait-consent-v1';
export const LIVE_PORTRAIT_SANITIZER_VERSION = 'visiond-cloudflare-images-service-v1';
export const LIVE_PORTRAIT_MAX_BYTES = 5 * 1024 * 1024;
export const LIVE_PORTRAIT_MIN_EDGE = 256;
export const LIVE_PORTRAIT_MAX_EDGE = 4096;
export const LIVE_PORTRAIT_MAX_PIXELS = 24_000_000;
export const LIVE_PORTRAIT_OUTPUT_MAX_EDGE = 1024;
export const LIVE_PORTRAIT_OUTPUT_MAX_PIXELS = 1_048_576;

const SHOW_ID = /^live_[a-f0-9]{32}$/;
const ASSET_ID = /^livep_[a-f0-9]{32}$/;
const SESSION_ID = /^livert_[a-f0-9]{32}$/;
const IDEMPOTENCY = /^[a-z0-9][a-z0-9._:-]{7,127}$/i;
const SAFE_JPEG_CONTENT_TYPE = 'image/jpeg';
const REDACTED_VIEWER_HASH = '0'.repeat(64);
// Migration 0113 permits one active session for each of avatar/local_test/facebook.
// Replacement/delete therefore need at most three max-24 redaction statements.
const LIVE_RUNTIME_MODE_LIMIT = 3;

class LivePortraitError extends Error {
  constructor(message, status = 400, code = 'LIVE_PORTRAIT_INVALID') {
    super(message);
    this.name = 'LivePortraitError';
    this.status = status;
    this.code = code;
  }
}

const errorResponse = error => error instanceof LivePortraitError
  ? liveJson({ error: error.message, code: error.code }, error.status)
  : null;
const schemaMissing = error => /no such table:\s*(?:live_presenter|live_runtime|live_provider|live_audience)/i.test(String(error?.message || ''));
const uniqueError = error => /unique constraint/i.test(String(error?.message || ''));
const serverFailure = error => {
  if (schemaMissing(error)) return liveJson({ error: 'ต้องติดตั้ง migration 0113 ก่อนใช้ Photo Avatar', code: 'LIVE_PHOTO_SCHEMA_REQUIRED' }, 503);
  console.error('LIVE_PHOTO_FOUNDATION_FAILURE');
  return liveJson({ error: 'Photo Avatar ทำงานไม่สำเร็จ', code: 'LIVE_PHOTO_FOUNDATION_FAILED' }, 500);
};
const routeId = (value, pattern, label) => {
  const output = String(value || '');
  if (!pattern.test(output)) throw new LivePortraitError(`${label} ไม่ถูกต้อง`);
  return output;
};
const positiveInt = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const nonNegativeInt = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LivePortraitError(`${label} ไม่ถูกต้อง`);
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new LivePortraitError(`${label}.${key} ไม่ใช่ฟิลด์ที่รองรับ`);
};
const idempotencyKey = request => {
  const value = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY.test(value)) throw new LivePortraitError('ต้องส่ง Idempotency-Key ความยาว 8–128 ตัวอักษร', 400, 'LIVE_IDEMPOTENCY_REQUIRED');
  return value;
};
const privateAuth = async ctx => {
  const auth = await requireAdmin(ctx, { includeCourseOwner: false });
  return auth.error ? { error: privateLiveResponse(auth.error) } : auth;
};
const showContext = async (env, rawId) => {
  const id = routeId(rawId, SHOW_ID, 'show id');
  const show = await env.DB.prepare('SELECT id,created_by,revision FROM live_shows WHERE id=?').bind(id).first();
  if (!show) throw new LivePortraitError('ไม่พบรายการไลฟ์', 404, 'LIVE_SHOW_NOT_FOUND');
  return { id, ownerId: Number(show.created_by), revision: Number(show.revision) };
};
const requestJson = async (request, max = 8192) => {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > max) throw new LivePortraitError('ข้อมูลใหญ่เกินกำหนด', 413, 'LIVE_BODY_TOO_LARGE');
  const raw = await request.text();
  if (raw.length > max) throw new LivePortraitError('ข้อมูลใหญ่เกินกำหนด', 413, 'LIVE_BODY_TOO_LARGE');
  try { return JSON.parse(raw || '{}'); } catch { throw new LivePortraitError('JSON ไม่ถูกต้อง'); }
};
const cleanupRetryAt = attempts => new Date(Date.now() + Math.min(60, 2 ** Math.min(6, attempts)) * 60_000).toISOString();
async function runObjectCleanupJob(env, job) {
  if (!job || job.status === 'done') return true;
  if (!env.FILES || typeof env.FILES.delete !== 'function' || typeof env.FILES.head !== 'function') return false;
  try {
    await env.FILES.delete(job.object_key);
    if (await env.FILES.head(job.object_key)) throw new Error('R2_OBJECT_STILL_PRESENT');
    const now = new Date().toISOString();
    await env.DB.prepare(`UPDATE live_portrait_object_cleanup_jobs
      SET status='done',attempts=MIN(attempts+1,8),next_attempt_at=NULL,last_error_code='',updated_at=?,completed_at=?
      WHERE id=? AND owner_id=? AND show_id=?`).bind(now, now, job.id, job.owner_id, job.show_id).run();
    return true;
  } catch {
    const attempts = Math.min(8, Number(job.attempts || 0) + 1);
    await env.DB.prepare(`UPDATE live_portrait_object_cleanup_jobs
      SET status='error',attempts=?,next_attempt_at=?,last_error_code='R2_DELETE_FAILED',updated_at=?
      WHERE id=? AND owner_id=? AND show_id=?`).bind(attempts, cleanupRetryAt(attempts), new Date().toISOString(), job.id, job.owner_id, job.show_id).run().catch(() => undefined);
    return false;
  }
}
async function processObjectCleanup(env, show, limit = 24) {
  const rows = (await env.DB.prepare(`SELECT id,owner_id,show_id,object_key,status,attempts
    FROM live_portrait_object_cleanup_jobs INDEXED BY idx_live_portrait_cleanup_due
    WHERE owner_id=? AND show_id=? AND status IN ('reserved','pending','error') AND attempts<8
      AND (next_attempt_at IS NULL OR next_attempt_at<=?)
    ORDER BY next_attempt_at ASC,id ASC LIMIT ?`).bind(show.ownerId, show.id, new Date().toISOString(), Math.min(24, Math.max(1, limit))).all()).results || [];
  let completed = 0;
  for (const row of rows) if (await runObjectCleanupJob(env, row)) completed += 1;
  return { attempted: rows.length, completed, pending: rows.length - completed };
}
const publicAsset = (row, origin) => ({
  id: row.id,
  show_id: row.show_id,
  portrait_version: Number(row.portrait_version),
  mime_type: row.mime_type,
  file_size: Number(row.file_size),
  width: Number(row.width),
  height: Number(row.height),
  sha256: row.sha256,
  status: row.status,
  consent_policy: row.consent_policy,
  consent_attested_at: row.consent_attested_at,
  created_at: row.created_at,
  image_url: row.status === 'active' ? `${origin}/api/admin/live-center/shows/${row.show_id}/presenter/image?v=${row.portrait_version}` : '',
});

const readU16 = (bytes, offset) => (bytes[offset] << 8) | bytes[offset + 1];
// Validate the exact byte sequence that may reach private R2 or a provider.
// Cloudflare Images normally emits progressive JPEG, so both SOF0 baseline and
// SOF2 progressive scans are accepted. Metadata, thumbnails, malformed table
// references, unknown markers and trailing bytes remain closed.
export function inspectLivePortraitJpeg(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
  if (bytes.byteLength < 64 || bytes.byteLength > LIVE_PORTRAIT_MAX_BYTES || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new LivePortraitError('รูปอนุพันธ์ต้องเป็น JPEG ที่สมบูรณ์', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
  }
  let offset = 2;
  let width = 0;
  let height = 0;
  let frameMode = '';
  let scanCount = 0;
  let sawEoi = false;
  let sawJfif = false;
  const quantizationTables = new Set();
  const dcTables = new Set();
  const acTables = new Set();
  const components = new Map();
  const scannedComponents = new Set();
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) throw new LivePortraitError('โครงสร้าง JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (!scanCount || offset !== bytes.length) throw new LivePortraitError('JPEG มีข้อมูลต่อท้ายที่ไม่อนุญาต', 422, 'LIVE_PORTRAIT_TRAILING_DATA');
      sawEoi = true;
      break;
    }
    if (marker === 0xd8 || marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      throw new LivePortraitError('โครงสร้าง JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
    }
    if (offset + 2 > bytes.length) throw new LivePortraitError('JPEG ถูกตัดไม่ครบ', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
    const length = readU16(bytes, offset);
    const start = offset + 2;
    const end = offset + length;
    if (length < 2 || end > bytes.length) throw new LivePortraitError('JPEG ถูกตัดไม่ครบ', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
    if (marker === 0xfe || marker >= 0xe1 && marker <= 0xef) {
      throw new LivePortraitError('รูปยังมี EXIF/XMP/ICC/comment หรือ metadata ที่ไม่อนุญาต', 422, 'LIVE_PORTRAIT_METADATA_PRESENT');
    }
    if (marker === 0xe0) {
      const isJfif = length === 16
        && String.fromCharCode(...bytes.slice(start, start + 5)) === 'JFIF\0'
        && bytes[end - 2] === 0 && bytes[end - 1] === 0;
      if (!isJfif || sawJfif) throw new LivePortraitError('JPEG APP0 ต้องเป็น JFIF ที่ไม่มี thumbnail', 422, 'LIVE_PORTRAIT_METADATA_PRESENT');
      sawJfif = true;
    }
    if (marker === 0xdb) {
      let cursor = start;
      while (cursor < end) {
        const descriptor = bytes[cursor++];
        const precision = descriptor >> 4;
        const table = descriptor & 0x0f;
        const tableBytes = precision === 0 ? 64 : precision === 1 ? 128 : 0;
        if (!tableBytes || table > 3 || cursor + tableBytes > end) throw new LivePortraitError('ตาราง quantization JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
        quantizationTables.add(table);
        cursor += tableBytes;
      }
      if (cursor !== end) throw new LivePortraitError('ตาราง quantization JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
    } else if (marker === 0xc4) {
      let cursor = start;
      while (cursor < end) {
        const descriptor = bytes[cursor++];
        const tableClass = descriptor >> 4;
        const table = descriptor & 0x0f;
        if (tableClass > 1 || table > 3 || cursor + 16 > end) throw new LivePortraitError('ตาราง Huffman JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
        let symbols = 0;
        for (let index = 0; index < 16; index += 1) symbols += bytes[cursor + index];
        cursor += 16;
        if (symbols < 1 || symbols > 256 || cursor + symbols > end) throw new LivePortraitError('ตาราง Huffman JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
        (tableClass === 0 ? dcTables : acTables).add(table);
        cursor += symbols;
      }
      if (cursor !== end) throw new LivePortraitError('ตาราง Huffman JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
    } else if (marker === 0xc0 || marker === 0xc2) {
      const componentCount = bytes[start + 5];
      if (frameMode || bytes[start] !== 8 || ![1, 3].includes(componentCount) || length !== 8 + 3 * componentCount) {
        throw new LivePortraitError('โครงสร้าง frame JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
      }
      frameMode = marker === 0xc0 ? 'baseline' : 'progressive';
      height = readU16(bytes, start + 1);
      width = readU16(bytes, start + 3);
      for (let index = 0; index < componentCount; index += 1) {
        const componentOffset = start + 6 + index * 3;
        const component = bytes[componentOffset];
        const sampling = bytes[componentOffset + 1];
        const table = bytes[componentOffset + 2];
        if (!component || components.has(component) || !(sampling >> 4) || !(sampling & 0x0f) || table > 3) {
          throw new LivePortraitError('องค์ประกอบภาพ JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
        }
        components.set(component, table);
      }
    } else if (marker === 0xda) {
      const scanComponents = bytes[start];
      if (!frameMode || scanComponents < 1 || scanComponents > components.size || length !== 6 + 2 * scanComponents) {
        throw new LivePortraitError('โครงสร้าง scan JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
      }
      const seenComponents = new Set();
      const spectralStart = bytes[end - 3];
      const spectralEnd = bytes[end - 2];
      const approximationHigh = bytes[end - 1] >> 4;
      const approximationLow = bytes[end - 1] & 0x0f;
      if (frameMode === 'baseline') {
        if (scanCount || scanComponents !== components.size || spectralStart !== 0 || spectralEnd !== 63 || approximationHigh || approximationLow) {
          throw new LivePortraitError('โครงสร้าง scan JPEG baseline ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
        }
      } else if (spectralStart > spectralEnd || spectralEnd > 63
        || spectralStart === 0 && spectralEnd !== 0
        || spectralStart > 0 && scanComponents !== 1
        || approximationHigh > 13 || approximationLow > 13
        || approximationHigh && approximationHigh !== approximationLow + 1) {
        throw new LivePortraitError('โครงสร้าง scan JPEG progressive ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
      }
      for (let index = 0; index < scanComponents; index += 1) {
        const componentOffset = start + 1 + index * 2;
        const component = bytes[componentOffset];
        const tables = bytes[componentOffset + 1];
        const dc = tables >> 4;
        const ac = tables & 0x0f;
        const tablesExist = frameMode === 'baseline'
          ? dcTables.has(dc) && acTables.has(ac)
          : spectralStart === 0 ? dcTables.has(dc) : acTables.has(ac);
        if (!components.has(component) || seenComponents.has(component) || !tablesExist) {
          throw new LivePortraitError('scan JPEG อ้างตารางที่ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
        }
        seenComponents.add(component);
        scannedComponents.add(component);
      }
      for (const table of components.values()) if (!quantizationTables.has(table)) {
        throw new LivePortraitError('JPEG ขาดตาราง quantization', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
      }
      scanCount += 1;
      offset = end;
      let foundMarker = false;
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { offset += 1; continue; }
        const markerStart = offset;
        while (bytes[offset] === 0xff) offset += 1;
        if (offset >= bytes.length) break;
        const next = bytes[offset++];
        if (next === 0x00 || next >= 0xd0 && next <= 0xd7) continue;
        offset = markerStart;
        foundMarker = true;
        break;
      }
      if (!foundMarker) throw new LivePortraitError('JPEG ไม่มี marker หลัง scan ที่ถูกต้อง', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
      continue;
    } else {
      const allowed = marker === 0xe0 || marker === 0xdb || marker === 0xc4 || marker === 0xdd;
      if (!allowed || marker === 0xdd && length !== 4) throw new LivePortraitError('JPEG มี marker ที่ไม่รองรับ', 422, 'LIVE_PORTRAIT_JPEG_INVALID');
    }
    if (marker !== 0xda) offset = end;
  }
  const pixels = width * height;
  if (!sawEoi || !frameMode || !scanCount || scannedComponents.size !== components.size
    || width < LIVE_PORTRAIT_MIN_EDGE || width > LIVE_PORTRAIT_OUTPUT_MAX_EDGE
    || height < LIVE_PORTRAIT_MIN_EDGE || height > LIVE_PORTRAIT_OUTPUT_MAX_EDGE
    || !Number.isSafeInteger(pixels) || pixels > LIVE_PORTRAIT_OUTPUT_MAX_PIXELS) {
    throw new LivePortraitError('รูปอนุพันธ์ต้องมีด้านละ 256–1024 พิกเซล และไม่เกิน 1.05 ล้านพิกเซล', 422, 'LIVE_PORTRAIT_DIMENSIONS_INVALID');
  }
  return Object.freeze({ width, height, frameMode, bytes });
}

function stripServerJpegMetadata(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new LivePortraitError('ผล re-encode ไม่ใช่ JPEG', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
  const parts = [bytes.slice(0, 2)];
  let offset = 2;
  let sawEoi = false;
  while (offset < bytes.length) {
    const markerStart = offset;
    if (bytes[offset] !== 0xff) throw new LivePortraitError('ผล re-encode มีโครงสร้าง JPEG ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
    while (bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) throw new LivePortraitError('ผล re-encode ถูกตัดไม่ครบ', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (offset !== bytes.length) throw new LivePortraitError('ผล re-encode มีข้อมูลต่อท้าย', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
      parts.push(bytes.slice(markerStart, offset));
      sawEoi = true;
      break;
    }
    if (marker === 0xd8 || marker === 0x00 || marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) {
      throw new LivePortraitError('ผล re-encode มี marker ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
    }
    if (offset + 2 > bytes.length) throw new LivePortraitError('ผล re-encode ถูกตัดไม่ครบ', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
    const length = readU16(bytes, offset);
    const end = offset + length;
    if (length < 2 || end > bytes.length) throw new LivePortraitError('ผล re-encode ถูกตัดไม่ครบ', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
    if (marker !== 0xfe && !(marker >= 0xe1 && marker <= 0xef)) parts.push(bytes.slice(markerStart, end));
    offset = end;
    if (marker !== 0xda) continue;
    const entropyStart = offset;
    let foundMarker = false;
    while (offset < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const nextMarkerStart = offset;
      while (bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length) break;
      const next = bytes[offset++];
      if (next === 0x00 || next >= 0xd0 && next <= 0xd7) continue;
      parts.push(bytes.slice(entropyStart, nextMarkerStart));
      offset = nextMarkerStart;
      foundMarker = true;
      break;
    }
    if (!foundMarker) throw new LivePortraitError('ผล re-encode ไม่มี marker หลัง scan', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
  }
  if (!sawEoi) throw new LivePortraitError('ผล re-encode ไม่มีจุดสิ้นสุด', 422, 'LIVE_PORTRAIT_DECODE_FAILED');
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const stripped = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) { stripped.set(part, cursor); cursor += part.byteLength; }
  return stripped;
}

async function readBoundedPortraitBytes(response) {
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > LIVE_PORTRAIT_MAX_BYTES) throw new LivePortraitError('ผล re-encode ใหญ่เกิน 5 MB', 422, 'LIVE_PORTRAIT_TOO_LARGE');
  const reader = response.body?.getReader?.();
  if (!reader) throw new LivePortraitError('บริการทำความสะอาดรูปไม่ส่งข้อมูลภาพ', 503, 'LIVE_PORTRAIT_SANITIZER_FAILED');
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > LIVE_PORTRAIT_MAX_BYTES) throw new LivePortraitError('ผล re-encode ใหญ่เกิน 5 MB', 422, 'LIVE_PORTRAIT_TOO_LARGE');
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

export async function reencodeLivePortraitPixels(env, clientDerivative, { signal } = {}) {
  const input = clientDerivative.bytes instanceof Uint8Array ? clientDerivative.bytes : new Uint8Array(clientDerivative.bytes || 0);
  if (clientDerivative.sourceMime !== SAFE_JPEG_CONTENT_TYPE) throw new LivePortraitError('เซิร์ฟเวอร์รับ JPEG derivative จากตัวเตรียมรูปเท่านั้น', 422, 'LIVE_PORTRAIT_DERIVATIVE_REQUIRED');
  if (input.byteLength < 64 || input.byteLength > LIVE_PORTRAIT_MAX_BYTES || input[0] !== 0xff || input[1] !== 0xd8) {
    throw new LivePortraitError('JPEG derivative ไม่ถูกต้อง', 422, 'LIVE_PORTRAIT_DERIVATIVE_REQUIRED');
  }
  const sanitizer = env?.PORTRAIT_SANITIZER;
  if (!sanitizer || typeof sanitizer.fetch !== 'function') {
    throw new LivePortraitError('ยังไม่ได้เชื่อมต่อบริการทำความสะอาดรูป', 503, 'LIVE_PORTRAIT_SANITIZER_NOT_CONFIGURED');
  }
  const controller = new AbortController();
  const abortFromRequest = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromRequest();
  else signal?.addEventListener?.('abort', abortFromRequest, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException('Portrait sanitizer timeout', 'TimeoutError')), 15_000);
  const finishSignal = () => {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', abortFromRequest);
  };
  let response;
  try {
    response = await sanitizer.fetch('https://portrait-sanitizer.internal/v1/reencode', {
      method: 'POST',
      headers: {
        'content-type': SAFE_JPEG_CONTENT_TYPE,
        'x-visiond-sanitizer-protocol': '1',
        'x-visiond-input-bytes': String(input.byteLength),
      },
      body: input,
      signal: controller.signal,
    });
  } catch (error) {
    finishSignal();
    if (signal?.aborted) throw error;
    throw new LivePortraitError('เชื่อมต่อบริการทำความสะอาดรูปไม่สำเร็จ', 503, 'LIVE_PORTRAIT_SANITIZER_FAILED');
  }
  try {
    if (!response?.ok) {
      const invalid = response?.status === 400 || response?.status === 413 || response?.status === 415 || response?.status === 422;
      throw new LivePortraitError(invalid ? 'บริการทำความสะอาดรูปปฏิเสธไฟล์นี้' : 'บริการทำความสะอาดรูปยังไม่พร้อมใช้งาน', invalid ? 422 : 503, invalid ? 'LIVE_PORTRAIT_DECODE_FAILED' : 'LIVE_PORTRAIT_SANITIZER_FAILED');
    }
    if (String(response.headers?.get?.('content-type') || '').split(';')[0].trim().toLowerCase() !== SAFE_JPEG_CONTENT_TYPE
      || response.headers?.get?.('x-visiond-sanitizer') !== 'cloudflare-images-v1') {
      throw new LivePortraitError('บริการทำความสะอาดรูปส่งชนิดไฟล์ไม่ถูกต้อง', 503, 'LIVE_PORTRAIT_SANITIZER_FAILED');
    }
    const serviceBytes = await readBoundedPortraitBytes(response);
    const bytes = stripServerJpegMetadata(serviceBytes);
    const inspected = inspectLivePortraitJpeg(bytes);
    if (inspected.width > LIVE_PORTRAIT_OUTPUT_MAX_EDGE || inspected.height > LIVE_PORTRAIT_OUTPUT_MAX_EDGE) {
      throw new LivePortraitError('บริการทำความสะอาดรูปส่งขนาดเกิน 1024 พิกเซล', 503, 'LIVE_PORTRAIT_SANITIZER_FAILED');
    }
    return inspected;
  } finally {
    finishSignal();
  }
}

async function portraitForm(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (!Number.isSafeInteger(length) || length < 1) throw new LivePortraitError('ต้องระบุ Content-Length ของรูปก่อนอัปโหลด', 411, 'LIVE_PORTRAIT_LENGTH_REQUIRED');
  if (length > LIVE_PORTRAIT_MAX_BYTES + 32768) throw new LivePortraitError('รูปใหญ่เกิน 5 MB', 413, 'LIVE_PORTRAIT_TOO_LARGE');
  if (!/^multipart\/form-data(?:;|$)/i.test(String(request.headers.get('content-type') || ''))) {
    throw new LivePortraitError('ต้องส่งรูปแบบ multipart/form-data');
  }
  const form = await request.formData();
  const allowed = new Set(['portrait', 'rights_consent', 'animation_consent', 'identity_scope', 'consent_policy', 'expected_binding_revision']);
  for (const key of form.keys()) if (!allowed.has(key)) throw new LivePortraitError(`portrait.${key} ไม่ใช่ฟิลด์ที่รองรับ`);
  for (const key of allowed) if (form.getAll(key).length !== 1) throw new LivePortraitError(`portrait.${key} ต้องมีหนึ่งค่า`);
  if (form.get('rights_consent') !== 'accepted' || form.get('animation_consent') !== 'accepted') {
    throw new LivePortraitError('ต้องยืนยันสิทธิ์ในรูปและยินยอมให้สร้างภาพเคลื่อนไหว', 422, 'LIVE_PORTRAIT_CONSENT_REQUIRED');
  }
  if (form.get('identity_scope') !== 'authorized_adult') {
    throw new LivePortraitError('รองรับเฉพาะบุคคลผู้ใหญ่ที่ได้รับอนุญาต ห้ามเลียนแบบบุคคลสาธารณะ', 422, 'LIVE_PORTRAIT_IDENTITY_REJECTED');
  }
  if (form.get('consent_policy') !== LIVE_PORTRAIT_CONSENT_POLICY) {
    throw new LivePortraitError('กรุณาอ่านและยืนยันนโยบายสิทธิ์ฉบับปัจจุบัน', 409, 'LIVE_PORTRAIT_CONSENT_STALE');
  }
  const expectedRevision = nonNegativeInt(form.get('expected_binding_revision'));
  if (expectedRevision === null) throw new LivePortraitError('expected_binding_revision ไม่ถูกต้อง');
  const file = form.get('portrait');
  const sourceMime = String(file?.type || '').toLowerCase();
  if (!(file instanceof Blob) || sourceMime !== SAFE_JPEG_CONTENT_TYPE || !file.size || file.size > LIVE_PORTRAIT_MAX_BYTES) {
    throw new LivePortraitError('เซิร์ฟเวอร์รับเฉพาะ JPEG derivative ไม่เกิน 5 MB (หน้าเว็บรองรับต้นฉบับ JPG/PNG)', 422, 'LIVE_PORTRAIT_DERIVATIVE_REQUIRED');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const magicMatches = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!magicMatches) throw new LivePortraitError('ชนิดไฟล์กับข้อมูลรูปไม่ตรงกัน', 422, 'LIVE_PORTRAIT_DERIVATIVE_REQUIRED');
  return { bytes, sourceMime, expectedRevision };
}

async function cleanupExpiredPortraitUploadClaims(env, show, now) {
  const due = await env.DB.prepare(`SELECT id FROM live_portrait_upload_claims INDEXED BY idx_live_portrait_upload_claim_retention
    WHERE owner_id=? AND show_id=? AND status IN ('completed','error','processing') AND expires_at<=?
      AND (status<>'processing' OR lease_expires_at<=?)
    ORDER BY status,expires_at,id LIMIT 1`).bind(show.ownerId, show.id, now, now).first();
  if (!due) return 0;
  const result = await env.DB.prepare(`DELETE FROM live_portrait_upload_claims WHERE id IN (
    SELECT id FROM live_portrait_upload_claims INDEXED BY idx_live_portrait_upload_claim_retention
    WHERE owner_id=? AND show_id=? AND status IN ('completed','error','processing') AND expires_at<=?
      AND (status<>'processing' OR lease_expires_at<=?)
    ORDER BY status,expires_at,id LIMIT 24
  )`).bind(show.ownerId, show.id, now, now).run();
  return Number(result.meta?.changes || 0);
}

const currentBinding = (env, show) => env.DB.prepare(`SELECT b.binding_revision,b.portrait_version,b.presenter_asset_id,
    p.id,p.object_key,p.mime_type,p.file_size,p.width,p.height,p.sha256,p.status,p.consent_policy,p.consent_attested_at,p.created_at
  FROM live_presenter_bindings b
  LEFT JOIN live_presenter_assets p ON p.id=b.presenter_asset_id
  WHERE b.show_id=? AND b.owner_id=?`).bind(show.id, show.ownerId).first();

export async function listLivePortraits(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const url = new URL(ctx.request.url);
    const limitValue = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 24;
    if (!Number.isInteger(limitValue) || limitValue < 1) throw new LivePortraitError('limit ไม่ถูกต้อง');
    const limit = Math.min(24, limitValue);
    const rawCursor = url.searchParams.get('cursor');
    const decoded = rawCursor ? decodeLiveCursor(rawCursor) : null;
    if (rawCursor && (!Array.isArray(decoded) || decoded.length !== 2 || typeof decoded[0] !== 'string' || !ASSET_ID.test(String(decoded[1])))) {
      throw new LivePortraitError('cursor ไม่ถูกต้อง');
    }
    const anchor = decoded || ['9999-12-31T23:59:59.999Z', '~'];
    const rows = (await ctx.env.DB.prepare(`SELECT id,show_id,portrait_version,mime_type,file_size,width,height,sha256,status,consent_policy,consent_attested_at,created_at
      FROM live_presenter_assets INDEXED BY idx_live_presenter_show_owner_created
      WHERE show_id=? AND owner_id=? AND (created_at,id)<(?,?)
      ORDER BY created_at DESC,id DESC LIMIT ?`).bind(show.id, show.ownerId, anchor[0], anchor[1], limit + 1).all()).results || [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const binding = await currentBinding(ctx.env, show);
    if (binding && typeof ctx.waitUntil === 'function') ctx.waitUntil(processObjectCleanup(ctx.env, show, 2).catch(() => undefined));
    return liveJson({
      viewer_id: auth.user.id,
      binding: { revision: Number(binding?.binding_revision || 0), portrait_version: Number(binding?.portrait_version || 0), active_id: binding?.presenter_asset_id || null },
      items: page.map(row => publicAsset(row, url.origin)),
      pagination: { limit, has_more: hasMore, next_cursor: hasMore && last ? encodeLiveCursor([last.created_at, last.id]) : null },
    });
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}

export async function uploadLivePortrait(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  let objectKey = '', guardId = '', uploadClaimId = '', uploadLease = '';
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const key = idempotencyKey(ctx.request);
    const clientDerivative = await portraitForm(ctx.request);
    const inputSha256 = await liveSha256(clientDerivative.bytes);
    const requestHash = await liveSha256(canonicalLiveJson({
      input_sha256: inputSha256,
      input_size: clientDerivative.bytes.byteLength,
      expected_binding_revision: clientDerivative.expectedRevision,
      consent_policy: LIVE_PORTRAIT_CONSENT_POLICY,
      identity_scope: 'authorized_adult',
      sanitizer_version: LIVE_PORTRAIT_SANITIZER_VERSION,
    }));
    const assetReplay = await ctx.env.DB.prepare(`SELECT id,show_id,portrait_version,mime_type,file_size,width,height,sha256,status,consent_policy,consent_attested_at,created_at,request_hash
      FROM live_presenter_assets WHERE show_id=? AND uploaded_by=? AND create_idempotency_key=?`).bind(show.id, auth.user.id, key).first();
    if (assetReplay) {
      if (assetReplay.request_hash !== requestHash) throw new LivePortraitError('Idempotency-Key นี้ถูกใช้กับรูปอื่นแล้ว', 409, 'LIVE_IDEMPOTENCY_CONFLICT');
      return liveJson({ viewer_id: auth.user.id, ok: true, replayed: true, item: publicAsset(assetReplay, new URL(ctx.request.url).origin) });
    }
    const claimReplay = await ctx.env.DB.prepare(`SELECT id,request_hash,status,lease_expires_at,attempts,result_asset_id
      FROM live_portrait_upload_claims WHERE show_id=? AND uploaded_by=? AND idempotency_key=?`).bind(show.id, auth.user.id, key).first();
    if (claimReplay?.request_hash !== undefined && claimReplay.request_hash !== requestHash) {
      throw new LivePortraitError('Idempotency-Key นี้ถูกใช้กับรูปอื่นแล้ว', 409, 'LIVE_IDEMPOTENCY_CONFLICT');
    }
    if (claimReplay?.status === 'completed') {
      const replay = await ctx.env.DB.prepare(`SELECT id,show_id,portrait_version,mime_type,file_size,width,height,sha256,status,consent_policy,consent_attested_at,created_at,request_hash
        FROM live_presenter_assets WHERE id=? AND show_id=? AND owner_id=?`).bind(claimReplay.result_asset_id, show.id, show.ownerId).first();
      if (!replay || replay.request_hash !== requestHash) throw new LivePortraitError('ผลอัปโหลดเดิมไม่พร้อมใช้งาน', 409, 'LIVE_PORTRAIT_REPLAY_UNAVAILABLE');
      return liveJson({ viewer_id: auth.user.id, ok: true, replayed: true, item: publicAsset(replay, new URL(ctx.request.url).origin) });
    }
    const now = new Date().toISOString();
    if (claimReplay?.status === 'processing' && String(claimReplay.lease_expires_at || '') > now) {
      return liveJson({ error: 'รูปนี้กำลังประมวลผลจากคำขอเดิม กรุณารอสักครู่', code: 'LIVE_PORTRAIT_UPLOAD_IN_PROGRESS' }, 409, { 'retry-after': '2' });
    }
    if (claimReplay && Number(claimReplay.attempts) >= 8) {
      throw new LivePortraitError('อัปโหลดรูปนี้ลองซ้ำครบกำหนดแล้ว กรุณาใช้ Idempotency-Key ใหม่', 503, 'LIVE_PORTRAIT_UPLOAD_RETRY_EXHAUSTED');
    }
    const binding = await currentBinding(ctx.env, show);
    const currentRevision = Number(binding?.binding_revision || 0);
    if (currentRevision !== clientDerivative.expectedRevision) {
      throw new LivePortraitError('รูปผู้นำเสนอถูกเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดใหม่', 409, 'LIVE_PORTRAIT_STALE_BINDING');
    }
    if (!ctx.env.FILES || typeof ctx.env.FILES.put !== 'function') throw new LivePortraitError('ยังไม่ได้เชื่อมพื้นที่เก็บรูปส่วนตัว', 503, 'LIVE_PORTRAIT_STORAGE_NOT_CONFIGURED');
    if (!ctx.env.PORTRAIT_SANITIZER || typeof ctx.env.PORTRAIT_SANITIZER.fetch !== 'function') {
      throw new LivePortraitError('ยังไม่ได้เชื่อมต่อบริการทำความสะอาดรูป', 503, 'LIVE_PORTRAIT_SANITIZER_NOT_CONFIGURED');
    }
    uploadClaimId = `liveuc_${crypto.randomUUID().replaceAll('-', '')}`;
    uploadLease = `lease_${crypto.randomUUID().replaceAll('-', '')}`;
    const leaseExpiresAt = new Date(Date.parse(now) + 2 * 60 * 1000).toISOString();
    const claimExpiresAt = new Date(Date.parse(now) + 24 * 60 * 60 * 1000).toISOString();
    if (claimReplay) {
      uploadClaimId = claimReplay.id;
      const retried = await ctx.env.DB.prepare(`UPDATE live_portrait_upload_claims SET status='processing',lease_token=?,lease_expires_at=?,attempts=attempts+1,last_error_code='',updated_at=?
        WHERE id=? AND request_hash=? AND attempts<8
          AND (status='error' OR (status='processing' AND lease_expires_at<=?))
        RETURNING id`).bind(uploadLease, leaseExpiresAt, now, claimReplay.id, requestHash, now).first();
      if (!retried) {
        if (Number(claimReplay.attempts) >= 8) throw new LivePortraitError('อัปโหลดรูปนี้ลองซ้ำครบกำหนดแล้ว กรุณาใช้ Idempotency-Key ใหม่', 503, 'LIVE_PORTRAIT_UPLOAD_RETRY_EXHAUSTED');
        return liveJson({ error: 'รูปนี้กำลังประมวลผลจากคำขอเดิม กรุณารอสักครู่', code: 'LIVE_PORTRAIT_UPLOAD_IN_PROGRESS' }, 409, { 'retry-after': '2' });
      }
    } else {
      const inserted = await ctx.env.DB.prepare(`INSERT OR IGNORE INTO live_portrait_upload_claims(id,show_id,owner_id,uploaded_by,idempotency_key,request_hash,status,lease_token,lease_expires_at,attempts,result_asset_id,last_error_code,created_at,updated_at,expires_at)
        VALUES(?,?,?,?,?,?,'processing',?,?,1,NULL,'',?,?,?)`).bind(uploadClaimId, show.id, show.ownerId, auth.user.id, key, requestHash, uploadLease, leaseExpiresAt, now, now, claimExpiresAt).run();
      if (!Number(inserted.meta?.changes)) {
      const existing = await ctx.env.DB.prepare(`SELECT id,request_hash,status,lease_expires_at,attempts,result_asset_id
        FROM live_portrait_upload_claims WHERE show_id=? AND uploaded_by=? AND idempotency_key=?`).bind(show.id, auth.user.id, key).first();
      if (!existing || existing.request_hash !== requestHash) throw new LivePortraitError('Idempotency-Key นี้ถูกใช้กับรูปอื่นแล้ว', 409, 'LIVE_IDEMPOTENCY_CONFLICT');
      if (existing.status === 'completed') {
        const replay = await ctx.env.DB.prepare(`SELECT id,show_id,portrait_version,mime_type,file_size,width,height,sha256,status,consent_policy,consent_attested_at,created_at,request_hash
          FROM live_presenter_assets WHERE id=? AND show_id=? AND owner_id=?`).bind(existing.result_asset_id, show.id, show.ownerId).first();
        if (!replay || replay.request_hash !== requestHash) throw new LivePortraitError('ผลอัปโหลดเดิมไม่พร้อมใช้งาน', 409, 'LIVE_PORTRAIT_REPLAY_UNAVAILABLE');
        return liveJson({ viewer_id: auth.user.id, ok: true, replayed: true, item: publicAsset(replay, new URL(ctx.request.url).origin) });
      }
        return liveJson({ error: 'รูปนี้กำลังประมวลผลจากคำขอเดิม กรุณารอสักครู่', code: 'LIVE_PORTRAIT_UPLOAD_IN_PROGRESS' }, 409, { 'retry-after': '2' });
      }
    }
    const limited = await rateLimitIdentityAtomic(ctx.env, 'live_portrait_upload', `${auth.user.id}:${show.id}`, { limit: 12, windowMinutes: 15, blockMinutes: 15 });
    if (limited.error) throw new LivePortraitError('อัปโหลดรูปบ่อยเกินไป กรุณาลองใหม่ภายหลัง', 429, 'LIVE_PORTRAIT_RATE_LIMITED');
    await cleanupExpiredPortraitUploadClaims(ctx.env, show, now);
    const derivative = await reencodeLivePortraitPixels(ctx.env, clientDerivative, { signal: ctx.request.signal });
    const sha256 = await liveSha256(derivative.bytes);
    const id = `livep_${crypto.randomUUID().replaceAll('-', '')}`;
    const portraitVersion = Number(binding?.portrait_version || 0) + 1;
    const nextBindingRevision = currentRevision + 1;
    objectKey = `live-center/presenters/${show.ownerId}/${show.id}/${id}.jpg`;
    guardId = `liveoc_${crypto.randomUUID().replaceAll('-', '')}`;
    await ctx.env.DB.prepare(`INSERT INTO live_portrait_object_cleanup_jobs(id,owner_id,show_id,presenter_asset_id,object_key,reason,status,idempotency_key,attempts,next_attempt_at,last_error_code,created_at,updated_at)
      VALUES(?,?,?,NULL,?,'orphan_guard','reserved',?,0,NULL,'',?,?)`).bind(guardId, show.ownerId, show.id, objectKey, `guard_${id}`, now, now).run();
    try {
      await ctx.env.FILES.put(objectKey, derivative.bytes, {
        httpMetadata: { contentType: SAFE_JPEG_CONTENT_TYPE, cacheControl: 'private, no-store' },
        customMetadata: {
          ownerId: String(show.ownerId), showId: show.id, assetId: id, sha256,
          sanitizerVersion: LIVE_PORTRAIT_SANITIZER_VERSION,
        },
      });
    } catch (error) {
      const guard = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE id=?').bind(guardId).first();
      await runObjectCleanupJob(ctx.env, guard);
      throw error;
    }
    const replacementCleanupId = binding?.object_key ? `liveoc_${crypto.randomUUID().replaceAll('-', '')}` : '';
    const statements = [
      ctx.env.DB.prepare(`INSERT INTO live_presenter_assets(id,show_id,owner_id,object_key,mime_type,file_size,width,height,sha256,portrait_version,sanitizer_version,status,consent_policy,consent_attested_by,consent_attested_at,create_idempotency_key,request_hash,uploaded_by,created_at,updated_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?,?,?
        WHERE EXISTS(SELECT 1 FROM live_portrait_upload_claims WHERE id=? AND request_hash=? AND status='processing' AND lease_token=?)`).bind(id, show.id, show.ownerId, objectKey, SAFE_JPEG_CONTENT_TYPE, derivative.bytes.byteLength, derivative.width, derivative.height, sha256, portraitVersion, LIVE_PORTRAIT_SANITIZER_VERSION, LIVE_PORTRAIT_CONSENT_POLICY, auth.user.id, now, key, requestHash, auth.user.id, now, now, uploadClaimId, requestHash, uploadLease),
      ctx.env.DB.prepare(`INSERT INTO live_presenter_bindings(show_id,owner_id,presenter_asset_id,portrait_version,binding_revision,updated_by,updated_at)
        VALUES(?,?,?,?,1,?,?)
        ON CONFLICT(show_id) DO UPDATE SET owner_id=excluded.owner_id,presenter_asset_id=excluded.presenter_asset_id,portrait_version=excluded.portrait_version,binding_revision=live_presenter_bindings.binding_revision+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at
        WHERE live_presenter_bindings.owner_id=? AND live_presenter_bindings.binding_revision=?`).bind(show.id, show.ownerId, id, portraitVersion, auth.user.id, now, show.ownerId, currentRevision),
      ctx.env.DB.prepare(`UPDATE live_presenter_assets SET status='replaced',updated_at=?
        WHERE show_id=? AND owner_id=? AND status='active' AND id<>?
          AND EXISTS(SELECT 1 FROM live_presenter_bindings WHERE show_id=? AND owner_id=? AND presenter_asset_id=? AND binding_revision=?)`).bind(now, show.id, show.ownerId, id, show.id, show.ownerId, id, nextBindingRevision),
      ctx.env.DB.prepare(`UPDATE live_presenter_assets SET status='active',updated_at=?
        WHERE id=? AND status='pending'
          AND EXISTS(SELECT 1 FROM live_presenter_bindings WHERE show_id=? AND owner_id=? AND presenter_asset_id=? AND binding_revision=?)`).bind(now, id, show.id, show.ownerId, id, nextBindingRevision),
      ...Array.from({ length: LIVE_RUNTIME_MODE_LIMIT }, () => ctx.env.DB.prepare(`UPDATE live_audience_events SET status='discarded',viewer_ref_hash=?,viewer_label='',question_text='',answer_text='',claim_token=NULL,claimed_at=NULL,updated_at=?
        WHERE id IN (SELECT e.id FROM live_audience_events e INDEXED BY idx_live_audience_owner_show_cursor
          WHERE e.owner_id=? AND e.show_id=? AND e.status IN ('ready','claimed')
            AND e.session_id IN (SELECT id FROM live_runtime_sessions
              WHERE owner_id=? AND show_id=? AND presenter_asset_id<>? AND status IN ('starting','active'))
            AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='active')
          ORDER BY e.created_at DESC,e.id DESC LIMIT 24)`).bind(REDACTED_VIEWER_HASH, now, show.ownerId, show.id, show.ownerId, show.id, id, id)),
      ctx.env.DB.prepare(`UPDATE live_runtime_sessions SET status='stopped',session_epoch=session_epoch+1,updated_at=?,stopped_at=?
        WHERE owner_id=? AND show_id=? AND presenter_asset_id<>? AND status IN ('starting','active')
          AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='active')`).bind(now, now, show.ownerId, show.id, id, id),
      ctx.env.DB.prepare(`UPDATE live_provider_resources SET status='delete_pending',cleanup_idempotency_key=COALESCE(cleanup_idempotency_key,?),next_cleanup_at=?,updated_at=?
        WHERE owner_id=? AND show_id=? AND presenter_asset_id<>? AND status IN ('creating','active','error')
          AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='active')`).bind(`cleanup_${id}`, now, now, show.ownerId, show.id, id, id),
      ...(binding?.object_key ? [ctx.env.DB.prepare(`INSERT OR IGNORE INTO live_portrait_object_cleanup_jobs(id,owner_id,show_id,presenter_asset_id,object_key,reason,status,idempotency_key,attempts,next_attempt_at,last_error_code,created_at,updated_at)
        SELECT ?,?,?,?,?, 'replaced','pending',?,0,?,'',?,? FROM live_presenter_assets
        WHERE id=? AND status='active'`).bind(replacementCleanupId, show.ownerId, show.id, binding.id, binding.object_key, `replace_${binding.id}`, now, now, now, id)] : []),
      ctx.env.DB.prepare(`UPDATE live_portrait_upload_claims SET status='completed',lease_token=NULL,lease_expires_at=NULL,result_asset_id=?,last_error_code='',updated_at=?,completed_at=?
        WHERE id=? AND request_hash=? AND status='processing' AND lease_token=?
          AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='active')`).bind(id, now, now, uploadClaimId, requestHash, uploadLease, id),
      ctx.env.DB.prepare(`DELETE FROM live_portrait_object_cleanup_jobs WHERE id=?
        AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='active')`).bind(guardId, id),
      ctx.env.DB.prepare(`DELETE FROM live_presenter_assets WHERE id=? AND status='pending'
        AND NOT EXISTS(SELECT 1 FROM live_presenter_bindings WHERE show_id=? AND owner_id=? AND presenter_asset_id=? AND binding_revision=?)`).bind(id, show.id, show.ownerId, id, nextBindingRevision),
    ];
    const claimCompletionIndex = 9 + (binding?.object_key ? 1 : 0);
    try {
      const results = await ctx.env.DB.batch(statements);
      if (!Number(results[claimCompletionIndex]?.meta?.changes)) {
        throw new LivePortraitError('สิทธิ์ประมวลผลรูปหมดอายุ กรุณาลองใหม่', 409, 'LIVE_PORTRAIT_UPLOAD_LEASE_STALE');
      }
    } catch (error) {
      const guard = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE id=?').bind(guardId).first();
      await runObjectCleanupJob(ctx.env, guard); objectKey = '';
      const raced = await ctx.env.DB.prepare(`SELECT id,show_id,portrait_version,mime_type,file_size,width,height,sha256,status,consent_policy,consent_attested_at,created_at,request_hash
        FROM live_presenter_assets WHERE show_id=? AND uploaded_by=? AND create_idempotency_key=?`).bind(show.id, auth.user.id, key).first();
      if (raced?.request_hash === requestHash) return liveJson({ viewer_id: auth.user.id, ok: true, replayed: true, item: publicAsset(raced, new URL(ctx.request.url).origin) });
      throw error;
    }
    const created = await ctx.env.DB.prepare(`SELECT id,show_id,portrait_version,mime_type,file_size,width,height,sha256,status,consent_policy,consent_attested_at,created_at
      FROM live_presenter_assets WHERE id=? AND show_id=? AND owner_id=? AND status='active'`).bind(id, show.id, show.ownerId).first();
    if (!created) {
      const guard = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE id=?').bind(guardId).first();
      await runObjectCleanupJob(ctx.env, guard); objectKey = '';
      throw new LivePortraitError('รูปผู้นำเสนอถูกเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดใหม่', 409, 'LIVE_PORTRAIT_STALE_BINDING');
    }
    objectKey = '';
    let cleanupPending = false;
    if (binding?.object_key) {
      const cleanup = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE object_key=?').bind(binding.object_key).first();
      cleanupPending = !await runObjectCleanupJob(ctx.env, cleanup);
    }
    return liveJson({ viewer_id: auth.user.id, ok: true, item: publicAsset(created, new URL(ctx.request.url).origin), binding_revision: nextBindingRevision, cleanup_pending: cleanupPending }, 201);
  } catch (error) {
    if (uploadClaimId && uploadLease) {
      const code = String(error?.code || (error?.name === 'AbortError' ? 'LIVE_PORTRAIT_UPLOAD_ABORTED' : 'LIVE_PORTRAIT_UPLOAD_FAILED')).slice(0, 96);
      await ctx.env.DB.prepare(`UPDATE live_portrait_upload_claims SET status='error',lease_token=NULL,lease_expires_at=NULL,last_error_code=?,updated_at=?
        WHERE id=? AND status='processing' AND lease_token=?`).bind(code, new Date().toISOString(), uploadClaimId, uploadLease).run().catch(() => undefined);
    }
    if (objectKey && guardId) {
      const guard = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE id=?').bind(guardId).first().catch(() => null);
      await runObjectCleanupJob(ctx.env, guard);
    }
    return errorResponse(error) || serverFailure(error);
  }
}

export async function deleteLivePortrait(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const key = idempotencyKey(ctx.request);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['portrait_id', 'expected_binding_revision']), 'portrait');
    const assetId = routeId(body.portrait_id, ASSET_ID, 'portrait_id');
    const expectedRevision = positiveInt(body.expected_binding_revision);
    if (!expectedRevision) throw new LivePortraitError('expected_binding_revision ไม่ถูกต้อง');
    const asset = await ctx.env.DB.prepare('SELECT id,object_key,status,delete_idempotency_key,delete_request_hash FROM live_presenter_assets WHERE id=? AND show_id=? AND owner_id=?').bind(assetId, show.id, show.ownerId).first();
    if (!asset) throw new LivePortraitError('ไม่พบรูปผู้นำเสนอ', 404, 'LIVE_PORTRAIT_NOT_FOUND');
    const requestHash = await liveSha256(canonicalLiveJson({ portrait_id: assetId, expected_binding_revision: expectedRevision }));
    if (asset.status === 'deleted' && asset.delete_idempotency_key === key) {
      if (asset.delete_request_hash !== requestHash) throw new LivePortraitError('Idempotency-Key นี้ถูกใช้กับข้อมูลอื่นแล้ว', 409, 'LIVE_IDEMPOTENCY_CONFLICT');
      let cleanup = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE object_key=?').bind(asset.object_key).first();
      if (!cleanup) {
        const cleanupId = `liveoc_${crypto.randomUUID().replaceAll('-', '')}`, now = new Date().toISOString();
        await ctx.env.DB.prepare(`INSERT OR IGNORE INTO live_portrait_object_cleanup_jobs(id,owner_id,show_id,presenter_asset_id,object_key,reason,status,idempotency_key,attempts,next_attempt_at,last_error_code,created_at,updated_at)
          VALUES(?,?,?,?,?,'deleted','pending',?,0,?,'',?,?)`).bind(cleanupId, show.ownerId, show.id, assetId, asset.object_key, `delete_${assetId}`, now, now, now).run();
        cleanup = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE object_key=?').bind(asset.object_key).first();
      }
      const removed = await runObjectCleanupJob(ctx.env, cleanup);
      return liveJson({ viewer_id: auth.user.id, ok: removed, replayed: true, portrait_id: assetId, cleanup_pending: !removed }, removed ? 200 : 202);
    }
    const now = new Date().toISOString();
    const nextRevision = expectedRevision + 1;
    const cleanupId = `liveoc_${crypto.randomUUID().replaceAll('-', '')}`;
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(`UPDATE live_presenter_bindings SET presenter_asset_id=NULL,binding_revision=binding_revision+1,updated_by=?,updated_at=?
        WHERE show_id=? AND owner_id=? AND presenter_asset_id=? AND binding_revision=?`).bind(auth.user.id, now, show.id, show.ownerId, assetId, expectedRevision),
      ctx.env.DB.prepare(`UPDATE live_presenter_assets SET status='deleted',deleted_at=?,deleted_by=?,delete_idempotency_key=?,delete_request_hash=?,updated_at=?
        WHERE id=? AND show_id=? AND owner_id=? AND status='active'
          AND EXISTS(SELECT 1 FROM live_presenter_bindings WHERE show_id=? AND owner_id=? AND presenter_asset_id IS NULL AND binding_revision=?)`).bind(now, auth.user.id, key, requestHash, now, assetId, show.id, show.ownerId, show.id, show.ownerId, nextRevision),
      ...Array.from({ length: LIVE_RUNTIME_MODE_LIMIT }, () => ctx.env.DB.prepare(`UPDATE live_audience_events SET status='discarded',viewer_ref_hash=?,viewer_label='',question_text='',answer_text='',claim_token=NULL,claimed_at=NULL,updated_at=?
        WHERE id IN (SELECT e.id FROM live_audience_events e INDEXED BY idx_live_audience_owner_show_cursor
          WHERE e.owner_id=? AND e.show_id=? AND e.status IN ('ready','claimed')
            AND e.session_id IN (SELECT id FROM live_runtime_sessions
              WHERE owner_id=? AND show_id=? AND presenter_asset_id=? AND status IN ('starting','active'))
            AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='deleted' AND delete_idempotency_key=?)
          ORDER BY e.created_at DESC,e.id DESC LIMIT 24)`).bind(REDACTED_VIEWER_HASH, now, show.ownerId, show.id, show.ownerId, show.id, assetId, assetId, key)),
      ctx.env.DB.prepare(`UPDATE live_runtime_sessions SET status='stopped',session_epoch=session_epoch+1,updated_at=?,stopped_at=?
        WHERE owner_id=? AND show_id=? AND presenter_asset_id=? AND status IN ('starting','active')
          AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='deleted' AND delete_idempotency_key=?)`).bind(now, now, show.ownerId, show.id, assetId, assetId, key),
      ctx.env.DB.prepare(`UPDATE live_provider_resources SET status='delete_pending',cleanup_idempotency_key=COALESCE(cleanup_idempotency_key,?),next_cleanup_at=?,updated_at=?
        WHERE owner_id=? AND show_id=? AND presenter_asset_id=? AND status IN ('creating','active','error')
          AND EXISTS(SELECT 1 FROM live_presenter_assets WHERE id=? AND status='deleted' AND delete_idempotency_key=?)`).bind(`cleanup_${assetId}`, now, now, show.ownerId, show.id, assetId, assetId, key),
      ctx.env.DB.prepare(`INSERT OR IGNORE INTO live_portrait_object_cleanup_jobs(id,owner_id,show_id,presenter_asset_id,object_key,reason,status,idempotency_key,attempts,next_attempt_at,last_error_code,created_at,updated_at)
        SELECT ?,owner_id,show_id,id,object_key,'deleted','pending',?,0,?,'',?,? FROM live_presenter_assets
        WHERE id=? AND owner_id=? AND show_id=? AND status='deleted'`).bind(cleanupId, `delete_${assetId}`, now, now, now, assetId, show.ownerId, show.id),
    ]);
    if (!Number(results[0]?.meta?.changes) || !Number(results[1]?.meta?.changes)) {
      throw new LivePortraitError('รูปผู้นำเสนอถูกเปลี่ยนจากอีกหน้าต่าง กรุณาโหลดใหม่', 409, 'LIVE_PORTRAIT_STALE_BINDING');
    }
    const cleanup = await ctx.env.DB.prepare('SELECT id,owner_id,show_id,object_key,status,attempts FROM live_portrait_object_cleanup_jobs WHERE object_key=?').bind(asset.object_key).first();
    const removed = await runObjectCleanupJob(ctx.env, cleanup);
    return liveJson({ viewer_id: auth.user.id, ok: removed, portrait_id: assetId, binding_revision: nextRevision, cleanup_pending: !removed }, removed ? 200 : 202);
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}

export async function getLivePortraitImage(ctx, { head = false } = {}) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const row = await ctx.env.DB.prepare(`SELECT p.id,p.object_key,p.file_size,p.sha256,p.mime_type,p.portrait_version
      FROM live_presenter_bindings b INDEXED BY idx_live_presenter_binding_owner_show
      JOIN live_presenter_assets p ON p.id=b.presenter_asset_id
      WHERE b.owner_id=? AND b.show_id=? AND p.owner_id=? AND p.show_id=? AND p.status='active'`).bind(show.ownerId, show.id, show.ownerId, show.id).first();
    if (!row) throw new LivePortraitError('ไม่พบรูปผู้นำเสนอที่ใช้งาน', 404, 'LIVE_PORTRAIT_NOT_FOUND');
    if (!ctx.env.FILES) throw new LivePortraitError('ยังไม่ได้เชื่อมพื้นที่เก็บรูปส่วนตัว', 503, 'LIVE_PORTRAIT_STORAGE_NOT_CONFIGURED');
    const object = head ? await ctx.env.FILES.head(row.object_key) : await ctx.env.FILES.get(row.object_key);
    if (!object || Number(object.size) !== Number(row.file_size)
      || object.customMetadata?.ownerId !== String(show.ownerId)
      || object.customMetadata?.showId !== show.id
      || object.customMetadata?.assetId !== row.id
      || object.customMetadata?.sha256 !== row.sha256
      || object.customMetadata?.sanitizerVersion !== LIVE_PORTRAIT_SANITIZER_VERSION) {
      throw new LivePortraitError('รูปส่วนตัวไม่ตรงกับ metadata', 409, 'LIVE_PORTRAIT_INTEGRITY');
    }
    return new Response(head ? null : object.body, {
      headers: {
        ...LIVE_PRIVATE_HEADERS,
        'content-type': SAFE_JPEG_CONTENT_TYPE,
        'content-length': String(row.file_size),
        'content-security-policy': "default-src 'none'; sandbox",
        'content-disposition': 'inline; filename="visiond-presenter.jpg"',
        etag: `"sha256-${row.sha256}"`,
      },
    });
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}

export async function getLiveIntegrationHealth(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const health = liveExternalIntegrationHealth(ctx.env);
    return liveJson({
      viewer_id: auth.user.id,
      status: health.avatar.connected && health.thai_voice.connected ? 'connected' : 'not_connected',
      label: health.avatar.connected && health.thai_voice.connected ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ',
      portrait_storage: health.portrait_storage,
      metadata_proof: 'cloudflare-images-pixel-decode-reencode+strict-jpeg',
      server_pixel_reencode: health.server_pixel_reencode,
      avatar: health.avatar,
      thai_voice: health.thai_voice,
      facebook: health.facebook,
      local_test: health.local_test,
      package_schema_version: 1,
      platform_live_start: false,
    });
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}

export async function cleanupLivePortraitObjects(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const result = await processObjectCleanup(ctx.env, show, 24);
    return liveJson({ viewer_id: auth.user.id, ok: result.pending === 0, ...result });
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}

export async function startLiveAvatarSession(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    idempotencyKey(ctx.request);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['portrait_id', 'expected_binding_revision']), 'avatar_session');
    const portraitId = routeId(body.portrait_id, ASSET_ID, 'portrait_id');
    const expectedRevision = positiveInt(body.expected_binding_revision);
    if (!expectedRevision) throw new LivePortraitError('expected_binding_revision ไม่ถูกต้อง');
    const selected = await ctx.env.DB.prepare(`SELECT p.id,p.sha256,p.consent_policy,p.status,b.binding_revision
      FROM live_presenter_bindings b JOIN live_presenter_assets p ON p.id=b.presenter_asset_id
      WHERE b.owner_id=? AND b.show_id=? AND b.presenter_asset_id=? AND b.binding_revision=?
        AND p.owner_id=? AND p.show_id=? AND p.status='active' AND p.consent_policy=?`).bind(show.ownerId, show.id, portraitId, expectedRevision, show.ownerId, show.id, LIVE_PORTRAIT_CONSENT_POLICY).first();
    if (!selected) throw new LivePortraitError('ต้องเลือกรูปที่ยังมี consent ก่อนเริ่ม Avatar', 409, 'LIVE_PORTRAIT_SELECTION_REQUIRED');
    const adapter = createLiveAvatarAdapter({ env: ctx.env });
    const health = adapter.health();
    if (!health.connected || !health.provisioning_contract_verified || !health.session_contract_verified) {
      throw new LivePortraitError('ยังไม่ได้เชื่อมต่อ Avatar: ต้องยืนยัน D-ID Agent/session กับบัญชีผู้ให้บริการก่อน', 503, 'LIVE_AVATAR_NOT_CONNECTED');
    }
    throw new LivePortraitError('ยังไม่ได้เชื่อมต่อ Avatar', 503, 'LIVE_AVATAR_NOT_CONNECTED');
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}

export async function stopLiveAvatarSession(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const key = idempotencyKey(ctx.request);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['session_id']), 'avatar_session');
    const sessionId = routeId(body.session_id, SESSION_ID, 'session_id');
    const requestHash = await liveSha256(canonicalLiveJson({ session_id: sessionId }));
    const now = new Date().toISOString();
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(`UPDATE live_audience_events SET status='discarded',viewer_ref_hash=?,viewer_label='',question_text='',answer_text='',claim_token=NULL,claimed_at=NULL,updated_at=?
        WHERE id IN (SELECT e.id FROM live_audience_events e INDEXED BY idx_live_audience_ready_queue
          WHERE e.session_id=? AND e.owner_id=? AND e.show_id=? AND e.status IN ('ready','claimed')
            AND EXISTS(SELECT 1 FROM live_runtime_sessions s
              WHERE s.id=e.session_id AND s.owner_id=e.owner_id AND s.show_id=e.show_id AND s.mode='avatar' AND s.status IN ('starting','active'))
          ORDER BY e.priority DESC,e.created_at,e.id LIMIT 24)`).bind(REDACTED_VIEWER_HASH, now, sessionId, show.ownerId, show.id),
      ctx.env.DB.prepare(`UPDATE live_runtime_sessions
        SET status='stopped',session_epoch=session_epoch+1,updated_at=?,stopped_at=?,stop_idempotency_key=?,stop_request_hash=?
        WHERE id=? AND owner_id=? AND show_id=? AND mode='avatar' AND status IN ('starting','active')`).bind(now, now, key, requestHash, sessionId, show.ownerId, show.id),
    ]);
    if (!Number(results[1]?.meta?.changes)) {
      const replay = await ctx.env.DB.prepare('SELECT status,stop_idempotency_key,stop_request_hash FROM live_runtime_sessions WHERE id=? AND owner_id=? AND show_id=? AND mode=\'avatar\'').bind(sessionId, show.ownerId, show.id).first();
      if (!replay) throw new LivePortraitError('ไม่พบ Avatar session', 404, 'LIVE_AVATAR_SESSION_NOT_FOUND');
      if (replay.stop_idempotency_key !== key || replay.stop_request_hash !== requestHash) throw new LivePortraitError('Session หยุดแล้วหรือ Idempotency-Key ไม่ตรง', 409, 'LIVE_AVATAR_SESSION_STOPPED');
      return liveJson({ viewer_id: auth.user.id, ok: true, replayed: true, session_id: sessionId });
    }
    return liveJson({ viewer_id: auth.user.id, ok: true, session_id: sessionId, disconnect_required: true, remote_interrupt_supported: false });
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}

export async function getLiveFacebookBoundary(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const facebook = liveExternalIntegrationHealth(ctx.env).facebook;
    return liveJson({
      viewer_id: auth.user.id,
      show_id: show.id,
      status: facebook.connected ? 'configured_unverified' : 'not_connected',
      label: facebook.connected ? 'ตั้งค่าฝั่งเซิร์ฟเวอร์แล้ว · ยังไม่ได้ยืนยัน Test Live' : 'ยังไม่ได้เชื่อมต่อ',
      capabilities: facebook,
      event_source: 'facebook_page_live_comments',
      named_viewer_join: false,
      start_live: false,
      mutate_platform: false,
    });
  } catch (error) { return errorResponse(error) || serverFailure(error); }
}
