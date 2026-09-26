import { requireAdmin } from './_lib.js';
import {
  canonicalLiveJson,
  decodeLiveCursor,
  encodeLiveCursor,
  liveJson,
  liveSha256,
  privateLiveResponse,
} from './_live_center.js';
import { rateLimitIdentityAtomic } from './_security.js';

export const LIVE_AUDIENCE_CAPACITY = 24;
export const LIVE_LOCAL_TEST_LABEL = 'LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม';
export const LIVE_AUDIENCE_UNKNOWN_ANSWER = 'ขออภัยค่ะ ตอนนี้ยังไม่มีข้อมูลยืนยันสำหรับคำถามนี้ กรุณาให้ผู้ดูแลตอบเพิ่มเติมค่ะ';
export const LIVE_AUDIENCE_REDACTED_VIEWER_HASH = '0'.repeat(64);
const LIVE_RUNTIME_MODE_LIMIT = 3;
export const LIVE_AUDIENCE_PRODUCT_SQL = `SELECT p.id,p.title,p.price_cents,p.currency,p.quantity,p.status,p.availability,p.brand,p.product_line,p.series,p.updated_at
  FROM toys_center_products p WHERE p.id=?
    AND EXISTS(SELECT 1 FROM live_show_scenes s WHERE s.show_id=? AND s.product_id=p.id)`;
export const LIVE_AUDIENCE_CAPACITY_DISCARD_SQL = `INSERT INTO live_audience_events(id,session_id,show_id,owner_id,source,external_event_hash,kind,viewer_ref_hash,viewer_label,question_text,product_id,priority,answer_kind,answer_text,status,attempts,created_at,updated_at,expires_at)
  SELECT ?,?,?,?,'local_test',?,?,'0000000000000000000000000000000000000000000000000000000000000000','','',?,?,?,'','discarded',0,?,?,?
  WHERE EXISTS(SELECT 1 FROM live_runtime_sessions WHERE id=? AND owner_id=? AND show_id=? AND mode='local_test' AND status='active')
    AND EXISTS(SELECT 1 FROM live_shows WHERE id=? AND created_by=? AND deleted_at IS NULL)`;
export const LIVE_AUDIENCE_STOP_REDACT_SQL = `UPDATE live_audience_events SET status='discarded',viewer_ref_hash='0000000000000000000000000000000000000000000000000000000000000000',viewer_label='',question_text='',answer_text='',claim_token=NULL,claimed_at=NULL,updated_at=?
  WHERE id IN (
    SELECT e.id FROM live_audience_events e INDEXED BY idx_live_audience_ready_queue
    WHERE e.session_id=? AND e.owner_id=? AND e.show_id=? AND e.status IN ('ready','claimed')
      AND EXISTS(SELECT 1 FROM live_runtime_sessions s
        WHERE s.id=e.session_id AND s.owner_id=e.owner_id AND s.show_id=e.show_id AND s.mode='local_test'
          AND s.status='stopped' AND s.stop_idempotency_key=? AND s.stop_request_hash=?)
    ORDER BY e.status,e.priority DESC,e.created_at,e.id LIMIT 24
  )`;
export const LIVE_AUDIENCE_STOP_DELETE_SQL = `DELETE FROM live_audience_events WHERE id IN (
  SELECT e.id FROM live_audience_events e INDEXED BY idx_live_audience_session_retention
  WHERE e.session_id=? AND e.owner_id=? AND e.show_id=?
    AND EXISTS(SELECT 1 FROM live_runtime_sessions s
      WHERE s.id=e.session_id AND s.owner_id=e.owner_id AND s.show_id=e.show_id AND s.mode='local_test'
        AND s.status='stopped' AND s.stop_idempotency_key=? AND s.stop_request_hash=?)
  ORDER BY e.created_at,e.id LIMIT 24
)`;

const SHOW_ID = /^live_[a-f0-9]{32}$/;
const SESSION_ID = /^livert_[a-f0-9]{32}$/;
const EVENT_ID = /^[a-z0-9][a-z0-9._:-]{7,127}$/i;
const INTERNAL_EVENT_ID = /^livee_[a-f0-9]{32}$/;
const CLAIM_TOKEN = /^claim_[a-f0-9]{32}$/;
const IDEMPOTENCY = /^[a-z0-9][a-z0-9._:-]{7,127}$/i;
const EVENT_KINDS = new Set(['viewer_join', 'comment']);
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

class LiveAudienceError extends Error {
  constructor(message, status = 400, code = 'LIVE_AUDIENCE_INVALID') {
    super(message);
    this.name = 'LiveAudienceError';
    this.status = status;
    this.code = code;
  }
}

const privateAuth = async ctx => {
  const auth = await requireAdmin(ctx, { includeCourseOwner: false });
  return auth.error ? { error: privateLiveResponse(auth.error) } : auth;
};
const exactKeys = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LiveAudienceError(`${label} ไม่ถูกต้อง`);
  for (const key of Object.keys(value)) if (!keys.has(key)) throw new LiveAudienceError(`${label}.${key} ไม่ใช่ฟิลด์ที่รองรับ`);
};
const routeId = (value, pattern, label) => {
  const id = String(value || '');
  if (!pattern.test(id)) throw new LiveAudienceError(`${label} ไม่ถูกต้อง`);
  return id;
};
const positiveInt = value => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const cleanText = (value, maximum, { required = true } = {}) => {
  if (typeof value !== 'string') throw new LiveAudienceError('ข้อมูลข้อความไม่ถูกต้อง');
  const output = value.normalize('NFKC').replace(CONTROL, '').replace(/\s+/g, ' ').trim();
  if (output.length > maximum || required && !output) throw new LiveAudienceError('ข้อมูลข้อความยาวหรือสั้นเกินกำหนด');
  return output;
};
const idempotencyKey = request => {
  const value = String(request.headers.get('idempotency-key') || '').trim();
  if (!IDEMPOTENCY.test(value)) throw new LiveAudienceError('ต้องส่ง Idempotency-Key ความยาว 8–128 ตัวอักษร', 400, 'LIVE_IDEMPOTENCY_REQUIRED');
  return value;
};
const requestJson = async (request, maximum = 8192) => {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > maximum) throw new LiveAudienceError('ข้อมูลใหญ่เกินกำหนด', 413, 'LIVE_BODY_TOO_LARGE');
  const raw = await request.text();
  if (raw.length > maximum) throw new LiveAudienceError('ข้อมูลใหญ่เกินกำหนด', 413, 'LIVE_BODY_TOO_LARGE');
  try { return JSON.parse(raw || '{}'); } catch { throw new LiveAudienceError('JSON ไม่ถูกต้อง'); }
};
const showContext = async (env, rawId) => {
  const id = routeId(rawId, SHOW_ID, 'show id');
  const show = await env.DB.prepare('SELECT id,created_by FROM live_shows WHERE id=? AND deleted_at IS NULL').bind(id).first();
  if (!show) throw new LiveAudienceError('ไม่พบรายการไลฟ์', 404, 'LIVE_SHOW_NOT_FOUND');
  return { id, ownerId: Number(show.created_by) };
};
const enabled = env => String(env.LIVE_CENTER_LOCAL_TEST_ENABLED || '') === '1';
const requireLocalTest = env => {
  if (!enabled(env)) throw new LiveAudienceError('Local Test ยังไม่ได้เปิดใช้งาน', 503, 'LIVE_LOCAL_TEST_DISABLED');
};
const inputResponse = error => error instanceof LiveAudienceError ? liveJson({ error: error.message, code: error.code }, error.status) : null;
const schemaMissing = error => /no such table:\s*(?:live_runtime|live_audience)/i.test(String(error?.message || ''));
const uniqueError = error => /unique constraint/i.test(String(error?.message || ''));
const capacityError = error => /LIVE_AUDIENCE_CAPACITY/i.test(String(error?.message || ''));
const serverFailure = error => {
  if (schemaMissing(error)) return liveJson({ error: 'ต้องติดตั้ง migration 0113 ก่อนใช้ Audience Test', code: 'LIVE_PHOTO_SCHEMA_REQUIRED' }, 503);
  console.error('LIVE_AUDIENCE_FOUNDATION_FAILURE');
  return liveJson({ error: 'Audience Test ทำงานไม่สำเร็จ', code: 'LIVE_AUDIENCE_FAILED' }, 500);
};
const sessionExpiry = now => new Date(Date.parse(now) + 2 * 60 * 60 * 1000).toISOString();
const eventExpiry = now => new Date(Date.parse(now) + 2 * 60 * 60 * 1000).toISOString();

const money = product => `${(Number(product.price_cents) / 100).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(product.currency || '').toUpperCase()}`;
export function groundLiveAudienceAnswer(product, { kind, viewerLabel = '', question = '' }) {
  if (!product || !positiveInt(product.id)) throw new LiveAudienceError('ไม่พบข้อมูลสินค้าปัจจุบัน', 409, 'LIVE_PRODUCT_UNAVAILABLE');
  if (product.status !== 'published' || product.availability !== 'in stock' || Number(product.quantity) < 1) {
    return Object.freeze({ kind: 'unknown', text: 'ขออภัยค่ะ สินค้านี้ไม่พร้อมขายในขณะนี้ กรุณาให้ผู้ดูแลตรวจสอบอีกครั้งค่ะ' });
  }
  if (kind === 'viewer_join') {
    const label = cleanText(viewerLabel, 60, { required: false });
    return Object.freeze({ kind: 'greeting', text: label ? `สวัสดีคุณ${label} ยินดีต้อนรับสู่ไลฟ์ทดสอบค่ะ` : 'สวัสดีค่ะ ยินดีต้อนรับสู่ไลฟ์ทดสอบค่ะ' });
  }
  const normalized = cleanText(question, 400).toLocaleLowerCase('th-TH');
  if (/(?:ราคา|กี่บาท|เท่าไหร่)/u.test(normalized)) return Object.freeze({ kind: 'grounded', text: `${product.title} ราคาปัจจุบัน ${money(product)} ค่ะ` });
  if (/(?:สต็อก|เหลือ|มีของ|พร้อมส่ง)/u.test(normalized)) return Object.freeze({ kind: 'grounded', text: `${product.title} มีสต็อกปัจจุบัน ${Number(product.quantity)} ชิ้นค่ะ` });
  if (/(?:ชื่อ|สินค้าอะไร|เรียกว่า)/u.test(normalized)) return Object.freeze({ kind: 'grounded', text: `สินค้าปัจจุบันชื่อ ${product.title} ค่ะ` });
  if (/(?:แบรนด์|ยี่ห้อ)/u.test(normalized) && product.brand) return Object.freeze({ kind: 'grounded', text: `${product.title} เป็นแบรนด์ ${product.brand} ค่ะ` });
  if (/(?:ไลน์สินค้า|กลุ่มสินค้า)/u.test(normalized) && product.product_line) return Object.freeze({ kind: 'grounded', text: `${product.title} อยู่ในไลน์ ${product.product_line} ค่ะ` });
  if (/(?:รุ่น|ซีรีส์)/u.test(normalized) && product.series) return Object.freeze({ kind: 'grounded', text: `${product.title} อยู่ในซีรีส์ ${product.series} ค่ะ` });
  return Object.freeze({ kind: 'unknown', text: LIVE_AUDIENCE_UNKNOWN_ANSWER });
}

const publicEvent = row => ({
  id: row.id,
  source: row.source,
  source_label: LIVE_LOCAL_TEST_LABEL,
  kind: row.kind,
  product_id: Number(row.product_id),
  priority: Number(row.priority),
  answer_kind: row.answer_kind,
  answer_text: row.answer_text,
  created_at: row.created_at,
});

async function cleanupExpired(env, show, now) {
  await env.DB.batch([
    env.DB.prepare(`UPDATE live_audience_events SET status='discarded',viewer_ref_hash=?,viewer_label='',question_text='',answer_text='',claim_token=NULL,claimed_at=NULL,updated_at=?
      WHERE id IN (SELECT id FROM live_audience_events INDEXED BY idx_live_audience_owner_show_expiry
        WHERE owner_id=? AND show_id=? AND expires_at<=? ORDER BY expires_at,id LIMIT 24)`).bind(LIVE_AUDIENCE_REDACTED_VIEWER_HASH, now, show.ownerId, show.id, now),
    env.DB.prepare(`DELETE FROM live_audience_events WHERE id IN (
      SELECT id FROM live_audience_events INDEXED BY idx_live_audience_expiry
      WHERE status IN ('consumed','discarded') AND expires_at<=? ORDER BY status,expires_at,id LIMIT 24
    )`).bind(now),
    ...Array.from({ length: LIVE_RUNTIME_MODE_LIMIT }, () => env.DB.prepare(`UPDATE live_audience_events SET status='discarded',viewer_ref_hash=?,viewer_label='',question_text='',answer_text='',claim_token=NULL,claimed_at=NULL,updated_at=?
      WHERE id IN (SELECT e.id FROM live_audience_events e INDEXED BY idx_live_audience_owner_show_cursor
        WHERE e.owner_id=? AND e.show_id=? AND e.status IN ('ready','claimed')
          AND e.session_id IN (SELECT s.id FROM live_runtime_sessions s INDEXED BY idx_live_runtime_owner_show_expiry
            WHERE s.owner_id=? AND s.show_id=? AND s.expires_at<=? AND s.status IN ('starting','active'))
        ORDER BY e.created_at DESC,e.id DESC LIMIT 24)`).bind(LIVE_AUDIENCE_REDACTED_VIEWER_HASH, now, show.ownerId, show.id, show.ownerId, show.id, now)),
    env.DB.prepare(`UPDATE live_runtime_sessions SET status='expired',session_epoch=session_epoch+1,updated_at=?,stopped_at=?
      WHERE id IN (SELECT id FROM live_runtime_sessions INDEXED BY idx_live_runtime_owner_show_expiry
        WHERE owner_id=? AND show_id=? AND expires_at<=? AND status IN ('starting','active') ORDER BY expires_at,id LIMIT 24)`).bind(now, now, show.ownerId, show.id, now),
    env.DB.prepare(`DELETE FROM live_runtime_sessions WHERE id IN (
      SELECT s.id FROM live_runtime_sessions s INDEXED BY idx_live_runtime_expiry
      WHERE s.status IN ('stopped','error','expired') AND s.expires_at<=?
        AND NOT EXISTS(SELECT 1 FROM live_audience_events e WHERE e.session_id=s.id)
      ORDER BY s.status,s.expires_at,s.id LIMIT 24
    )`).bind(now),
  ]);
}

export async function startLocalAudienceSession(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    requireLocalTest(ctx.env);
    const show = await showContext(ctx.env, ctx.params.id);
    const key = idempotencyKey(ctx.request);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['action']), 'local_session');
    if (body.action !== 'start') throw new LiveAudienceError('local_session.action ไม่ถูกต้อง');
    const requestHash = await liveSha256(canonicalLiveJson({ action: 'start' }));
    const now = new Date().toISOString();
    await cleanupExpired(ctx.env, show, now);
    const replay = await ctx.env.DB.prepare(`SELECT id,status,expires_at,create_idempotency_key,request_hash FROM live_runtime_sessions
      WHERE owner_id=? AND show_id=? AND created_by=? AND create_idempotency_key=?
        AND EXISTS(SELECT 1 FROM live_shows WHERE id=? AND created_by=? AND deleted_at IS NULL)`).bind(show.ownerId, show.id, auth.user.id, key, show.id, show.ownerId).first();
    if (replay) {
      if (replay.request_hash !== requestHash) throw new LiveAudienceError('Idempotency-Key นี้ถูกใช้กับข้อมูลอื่นแล้ว', 409, 'LIVE_IDEMPOTENCY_CONFLICT');
      return liveJson({ viewer_id: auth.user.id, ok: replay.status === 'active', replayed: true, session: { id: replay.id, source: 'local_test', source_label: LIVE_LOCAL_TEST_LABEL, status: replay.status, expires_at: replay.expires_at } });
    }
    const active = await ctx.env.DB.prepare(`SELECT id FROM live_runtime_sessions INDEXED BY idx_live_runtime_active_owner_show_mode
      WHERE owner_id=? AND show_id=? AND mode='local_test' AND status IN ('starting','active')
        AND EXISTS(SELECT 1 FROM live_shows WHERE id=? AND created_by=? AND deleted_at IS NULL)`).bind(show.ownerId, show.id, show.id, show.ownerId).first();
    if (active) throw new LiveAudienceError('Local Test เปิดอยู่แล้ว กรุณาหยุด session เดิมก่อน', 409, 'LIVE_LOCAL_TEST_ALREADY_ACTIVE');
    const limited = await rateLimitIdentityAtomic(ctx.env, 'live_local_session', `${auth.user.id}:${show.id}`, { limit: 20, windowMinutes: 15, blockMinutes: 15 });
    if (limited.error) return liveJson({ error: 'เปิด Local Test บ่อยเกินไป กรุณาลองใหม่ภายหลัง', code: 'LIVE_LOCAL_TEST_RATE_LIMITED' }, 429, { 'retry-after': String(limited.retryAfter) });
    const id = `livert_${crypto.randomUUID().replaceAll('-', '')}`;
    const expiresAt = sessionExpiry(now);
    try {
      const inserted = await ctx.env.DB.prepare(`INSERT INTO live_runtime_sessions(id,show_id,owner_id,presenter_asset_id,presenter_sha256,mode,provider_adapter,provider_session_resource_id,status,session_epoch,create_idempotency_key,request_hash,created_by,created_at,updated_at,expires_at)
        SELECT ?,?,?,NULL,NULL,'local_test','local-test',NULL,'active',1,?,?,?,?,?,?
        WHERE EXISTS(SELECT 1 FROM live_shows WHERE id=? AND created_by=? AND deleted_at IS NULL)`).bind(id, show.id, show.ownerId, key, requestHash, auth.user.id, now, now, expiresAt, show.id, show.ownerId).run();
      if (!Number(inserted.meta?.changes)) throw new LiveAudienceError('รายการไลฟ์ถูกลบระหว่างเปิด Local Test', 409, 'LIVE_SHOW_DELETED');
    } catch (error) {
      if (!uniqueError(error)) throw error;
      const raced = await ctx.env.DB.prepare(`SELECT id,status,expires_at,request_hash FROM live_runtime_sessions
        WHERE owner_id=? AND show_id=? AND created_by=? AND create_idempotency_key=?`).bind(show.ownerId, show.id, auth.user.id, key).first();
      if (!raced || raced.request_hash !== requestHash) throw new LiveAudienceError('Local Test เปิดจากอีกหน้าต่างแล้ว', 409, 'LIVE_LOCAL_TEST_ALREADY_ACTIVE');
      return liveJson({ viewer_id: auth.user.id, ok: raced.status === 'active', replayed: true, session: { id: raced.id, source: 'local_test', source_label: LIVE_LOCAL_TEST_LABEL, status: raced.status, expires_at: raced.expires_at } });
    }
    return liveJson({ viewer_id: auth.user.id, ok: true, session: { id, source: 'local_test', source_label: LIVE_LOCAL_TEST_LABEL, status: 'active', expires_at: expiresAt } }, 201);
  } catch (error) { return inputResponse(error) || serverFailure(error); }
}

export async function stopLocalAudienceSession(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const key = idempotencyKey(ctx.request);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['session_id']), 'local_session');
    const sessionId = routeId(body.session_id, SESSION_ID, 'session_id');
    const requestHash = await liveSha256(canonicalLiveJson({ session_id: sessionId }));
    const now = new Date().toISOString();
    const results = await ctx.env.DB.batch([
      ctx.env.DB.prepare(`UPDATE live_runtime_sessions SET status='stopped',session_epoch=session_epoch+1,stop_idempotency_key=?,stop_request_hash=?,updated_at=?,stopped_at=?
        WHERE id=? AND owner_id=? AND show_id=? AND mode='local_test' AND status IN ('starting','active')`).bind(key, requestHash, now, now, sessionId, show.ownerId, show.id),
      ctx.env.DB.prepare(LIVE_AUDIENCE_STOP_REDACT_SQL).bind(now, sessionId, show.ownerId, show.id, key, requestHash),
      ctx.env.DB.prepare(LIVE_AUDIENCE_STOP_DELETE_SQL).bind(sessionId, show.ownerId, show.id, key, requestHash),
    ]);
    let replayed = false;
    if (!Number(results[0]?.meta?.changes)) {
      const replay = await ctx.env.DB.prepare(`SELECT status,stop_idempotency_key,stop_request_hash FROM live_runtime_sessions
        WHERE id=? AND owner_id=? AND show_id=? AND mode='local_test'`).bind(sessionId, show.ownerId, show.id).first();
      if (!replay) throw new LiveAudienceError('ไม่พบ Local Test session', 404, 'LIVE_LOCAL_SESSION_NOT_FOUND');
      if (replay.stop_idempotency_key !== key || replay.stop_request_hash !== requestHash) throw new LiveAudienceError('Session หยุดแล้วหรือ Idempotency-Key ไม่ตรง', 409, 'LIVE_LOCAL_SESSION_STOPPED');
      replayed = true;
    }
    const remaining = await ctx.env.DB.prepare(`SELECT id FROM live_audience_events INDEXED BY idx_live_audience_session_retention
      WHERE session_id=? ORDER BY created_at,id LIMIT 1`).bind(sessionId).first();
    const cleanupPending = Boolean(remaining);
    return liveJson({ viewer_id: auth.user.id, ok: !cleanupPending, replayed, cleanup_pending: cleanupPending, session_id: sessionId }, cleanupPending ? 202 : 200);
  } catch (error) { return inputResponse(error) || serverFailure(error); }
}

async function existingEvent(env, sessionId, externalHash) {
  return env.DB.prepare(`SELECT id,source,kind,product_id,priority,answer_kind,answer_text,status,created_at
    FROM live_audience_events WHERE session_id=? AND source='local_test' AND external_event_hash=?`).bind(sessionId, externalHash).first();
}

export async function createLocalAudienceEvent(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    requireLocalTest(ctx.env);
    const show = await showContext(ctx.env, ctx.params.id);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['session_id', 'event_id', 'kind', 'viewer_label', 'question', 'product_id']), 'local_event');
    const sessionId = routeId(body.session_id, SESSION_ID, 'session_id');
    const externalId = routeId(body.event_id, EVENT_ID, 'event_id');
    const kind = String(body.kind || '');
    if (!EVENT_KINDS.has(kind)) throw new LiveAudienceError('kind ไม่ถูกต้อง');
    const viewerLabel = cleanText(body.viewer_label, 60, { required: false });
    const question = cleanText(body.question, 400, { required: kind === 'comment' });
    if (kind === 'viewer_join' && question) throw new LiveAudienceError('viewer_join ต้องไม่มี question');
    const productId = positiveInt(body.product_id);
    if (!productId) throw new LiveAudienceError('product_id ไม่ถูกต้อง');
    const now = new Date().toISOString();
    await cleanupExpired(ctx.env, show, now);
    const session = await ctx.env.DB.prepare(`SELECT id,session_epoch,expires_at FROM live_runtime_sessions
      WHERE id=? AND owner_id=? AND show_id=? AND mode='local_test' AND provider_adapter='local-test' AND status='active' AND expires_at>?`).bind(sessionId, show.ownerId, show.id, now).first();
    if (!session) throw new LiveAudienceError('Local Test session หมดอายุหรือหยุดแล้ว', 409, 'LIVE_LOCAL_SESSION_INACTIVE');
    const externalHash = await liveSha256(`local_test\n${sessionId}\n${externalId}`);
    const duplicate = await existingEvent(ctx.env, sessionId, externalHash);
    if (duplicate) return liveJson({ viewer_id: auth.user.id, accepted: duplicate.status === 'ready' || duplicate.status === 'claimed', replayed: true, reason: duplicate.status === 'discarded' ? 'capacity' : 'duplicate', item: publicEvent(duplicate) });
    const ownerLimit = await rateLimitIdentityAtomic(ctx.env, 'live_local_audience_owner', `${show.ownerId}:${show.id}`, { limit: 120, windowMinutes: 15, blockMinutes: 15 });
    if (ownerLimit.error) return liveJson({ error: 'Local Test มีเหตุการณ์มากเกินไป', code: 'LIVE_LOCAL_EVENT_RATE_LIMITED' }, 429, { 'retry-after': String(ownerLimit.retryAfter) });
    const viewerHash = await liveSha256(`${sessionId}\n${viewerLabel || 'anonymous'}`);
    const viewerLimit = await rateLimitIdentityAtomic(ctx.env, 'live_local_audience_viewer', `${show.ownerId}:${show.id}:${viewerHash}`, { limit: 12, windowMinutes: 1, blockMinutes: 1 });
    if (viewerLimit.error) return liveJson({ error: 'ผู้ชมทดสอบส่งเหตุการณ์ถี่เกินไป', code: 'LIVE_LOCAL_VIEWER_RATE_LIMITED' }, 429, { 'retry-after': String(viewerLimit.retryAfter) });
    const product = await ctx.env.DB.prepare(LIVE_AUDIENCE_PRODUCT_SQL).bind(productId, show.id).first();
    if (!product) throw new LiveAudienceError('ไม่พบสินค้าปัจจุบัน', 409, 'LIVE_PRODUCT_UNAVAILABLE');
    const answer = groundLiveAudienceAnswer(product, { kind, viewerLabel, question });
    const priority = kind === 'comment' ? 20 : 10;
    const eventId = `livee_${crypto.randomUUID().replaceAll('-', '')}`;
    const expiresAt = eventExpiry(now);
    const insert = ctx.env.DB.prepare(`INSERT INTO live_audience_events(id,session_id,show_id,owner_id,source,external_event_hash,kind,viewer_ref_hash,viewer_label,question_text,product_id,priority,answer_kind,answer_text,status,attempts,created_at,updated_at,expires_at)
      SELECT ?,?,?,?,'local_test',?,?,?,?,?,?,?,?,?,'ready',0,?,?,?
      WHERE EXISTS(SELECT 1 FROM live_runtime_sessions WHERE id=? AND owner_id=? AND show_id=? AND mode='local_test' AND status='active' AND session_epoch=? AND expires_at>?)
        AND EXISTS(SELECT 1 FROM live_shows WHERE id=? AND created_by=? AND deleted_at IS NULL)`).bind(eventId, sessionId, show.id, show.ownerId, externalHash, kind, viewerHash, viewerLabel, question, productId, priority, answer.kind, answer.text, now, now, expiresAt, sessionId, show.ownerId, show.id, Number(session.session_epoch), now, show.id, show.ownerId);
    try {
      const result = await insert.run();
      if (!Number(result.meta?.changes)) throw new LiveAudienceError('Local Test session ถูกหยุดระหว่างรับเหตุการณ์', 409, 'LIVE_LOCAL_SESSION_INACTIVE');
    } catch (error) {
      if (uniqueError(error)) {
        const raced = await existingEvent(ctx.env, sessionId, externalHash);
        if (raced) return liveJson({ viewer_id: auth.user.id, accepted: raced.status !== 'discarded', replayed: true, reason: 'duplicate', item: publicEvent(raced) });
      }
      if (!capacityError(error)) throw error;
      const discardedId = `livee_${crypto.randomUUID().replaceAll('-', '')}`;
      try {
        await ctx.env.DB.prepare(LIVE_AUDIENCE_CAPACITY_DISCARD_SQL).bind(discardedId, sessionId, show.id, show.ownerId, externalHash, kind, productId, priority, answer.kind, now, now, expiresAt, sessionId, show.ownerId, show.id, show.id, show.ownerId).run();
      } catch (discardError) { if (!uniqueError(discardError)) throw discardError; }
      return liveJson({ viewer_id: auth.user.id, accepted: false, reason: 'capacity', source: 'local_test', source_label: LIVE_LOCAL_TEST_LABEL });
    }
    const created = await existingEvent(ctx.env, sessionId, externalHash);
    return liveJson({ viewer_id: auth.user.id, accepted: true, reason: 'queued', item: publicEvent(created) }, 201);
  } catch (error) { return inputResponse(error) || serverFailure(error); }
}

const queueCursor = raw => {
  if (!raw) return null;
  const value = decodeLiveCursor(raw);
  return Array.isArray(value) && value.length === 3 && Number.isInteger(value[0]) && typeof value[1] === 'string' && INTERNAL_EVENT_ID.test(String(value[2]))
    ? { priority: Number(value[0]), createdAt: value[1], id: String(value[2]) } : null;
};

export async function listLocalAudienceQueue(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    requireLocalTest(ctx.env);
    const show = await showContext(ctx.env, ctx.params.id);
    const url = new URL(ctx.request.url);
    const sessionId = routeId(url.searchParams.get('session_id'), SESSION_ID, 'session_id');
    const limitValue = url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : 24;
    if (!Number.isInteger(limitValue) || limitValue < 1) throw new LiveAudienceError('limit ไม่ถูกต้อง');
    const limit = Math.min(24, limitValue);
    const rawCursor = url.searchParams.get('cursor');
    const cursor = queueCursor(rawCursor);
    if (rawCursor && !cursor) throw new LiveAudienceError('cursor ไม่ถูกต้อง');
    const session = await ctx.env.DB.prepare(`SELECT id,status,expires_at FROM live_runtime_sessions
      WHERE id=? AND owner_id=? AND show_id=? AND mode='local_test'`).bind(sessionId, show.ownerId, show.id).first();
    if (!session) throw new LiveAudienceError('ไม่พบ Local Test session', 404, 'LIVE_LOCAL_SESSION_NOT_FOUND');
    const seek = cursor ? ` AND (priority<? OR (priority=? AND (created_at>? OR (created_at=? AND id>?))))` : '';
    const args = cursor
      ? [sessionId, cursor.priority, cursor.priority, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1]
      : [sessionId, limit + 1];
    const rows = (await ctx.env.DB.prepare(`SELECT id,source,kind,product_id,priority,answer_kind,answer_text,status,created_at
      FROM live_audience_events INDEXED BY idx_live_audience_ready_queue
      WHERE session_id=? AND status='ready'${seek}
      ORDER BY priority DESC,created_at ASC,id ASC LIMIT ?`).bind(...args).all()).results || [];
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    return liveJson({
      viewer_id: auth.user.id,
      source: 'local_test',
      source_label: LIVE_LOCAL_TEST_LABEL,
      session: { id: session.id, status: session.status, expires_at: session.expires_at },
      items: page.map(publicEvent),
      pagination: { limit, has_more: hasMore, next_cursor: hasMore && last ? encodeLiveCursor([Number(last.priority), last.created_at, last.id]) : null },
    });
  } catch (error) { return inputResponse(error) || serverFailure(error); }
}

export async function requeueStaleLiveAudienceClaims(env, show, sessionId, now) {
  const stale = new Date(Date.parse(now) - 60_000).toISOString();
  const due = await env.DB.prepare(`SELECT id FROM live_audience_events INDEXED BY idx_live_audience_claim_expiry
    WHERE session_id=? AND status='claimed' AND claimed_at<=? ORDER BY claimed_at,id LIMIT 1`).bind(sessionId, stale).first();
  if (!due) return;
  await env.DB.prepare(`UPDATE live_audience_events SET
    status=CASE WHEN attempts>=2 THEN 'discarded' ELSE 'ready' END,
    viewer_ref_hash=CASE WHEN attempts>=2 THEN ? ELSE viewer_ref_hash END,
    viewer_label=CASE WHEN attempts>=2 THEN '' ELSE viewer_label END,
    question_text=CASE WHEN attempts>=2 THEN '' ELSE question_text END,
    answer_text=CASE WHEN attempts>=2 THEN '' ELSE answer_text END,
    claim_token=NULL,claimed_at=NULL,updated_at=?
    WHERE id IN (SELECT id FROM live_audience_events INDEXED BY idx_live_audience_claim_expiry
      WHERE session_id=? AND status='claimed' AND claimed_at<=? ORDER BY claimed_at,id LIMIT 24)
      AND owner_id=? AND show_id=?`).bind(LIVE_AUDIENCE_REDACTED_VIEWER_HASH, now, sessionId, stale, show.ownerId, show.id).run();
}

export async function claimReadyLocalAudienceEvent(env, show, sessionId, now, claimToken) {
  const ready = await env.DB.prepare(`SELECT e.id FROM live_audience_events e INDEXED BY idx_live_audience_ready_queue
    JOIN live_runtime_sessions s ON s.id=e.session_id
    WHERE e.session_id=? AND e.status='ready' AND e.owner_id=? AND e.show_id=?
      AND s.status='active' AND s.mode='local_test' AND s.expires_at>?
    ORDER BY e.priority DESC,e.created_at ASC,e.id ASC LIMIT 1`).bind(sessionId, show.ownerId, show.id, now).first();
  if (!ready) return null;
  return env.DB.prepare(`UPDATE live_audience_events SET status='claimed',claim_token=?,claimed_at=?,attempts=attempts+1,updated_at=?
    WHERE id=? AND session_id=? AND owner_id=? AND show_id=? AND status='ready'
      AND EXISTS(SELECT 1 FROM live_runtime_sessions s WHERE s.id=live_audience_events.session_id AND s.status='active' AND s.mode='local_test' AND s.expires_at>?)
    RETURNING id,source,kind,product_id,priority,answer_kind,answer_text,status,created_at`).bind(claimToken, now, now, ready.id, sessionId, show.ownerId, show.id, now).first();
}

export async function claimLocalAudienceEvent(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    requireLocalTest(ctx.env);
    const show = await showContext(ctx.env, ctx.params.id);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['session_id']), 'queue_claim');
    const sessionId = routeId(body.session_id, SESSION_ID, 'session_id');
    const now = new Date().toISOString();
    await requeueStaleLiveAudienceClaims(ctx.env, show, sessionId, now);
    const claimToken = `claim_${crypto.randomUUID().replaceAll('-', '')}`;
    const item = await claimReadyLocalAudienceEvent(ctx.env, show, sessionId, now, claimToken);
    return liveJson({ viewer_id: auth.user.id, source: 'local_test', source_label: LIVE_LOCAL_TEST_LABEL, item: item ? { ...publicEvent(item), claim_token: claimToken } : null });
  } catch (error) { return inputResponse(error) || serverFailure(error); }
}

export async function completeLocalAudienceEvent(ctx) {
  const auth = await privateAuth(ctx); if (auth.error) return auth.error;
  try {
    const show = await showContext(ctx.env, ctx.params.id);
    const body = await requestJson(ctx.request);
    exactKeys(body, new Set(['session_id', 'event_id', 'claim_token', 'outcome']), 'queue_complete');
    const sessionId = routeId(body.session_id, SESSION_ID, 'session_id');
    const eventId = routeId(body.event_id, INTERNAL_EVENT_ID, 'event_id');
    const claimToken = routeId(body.claim_token, CLAIM_TOKEN, 'claim_token');
    const outcome = String(body.outcome || '');
    if (!['consumed', 'retry', 'discarded'].includes(outcome)) throw new LiveAudienceError('outcome ไม่ถูกต้อง');
    const now = new Date().toISOString();
    const result = await ctx.env.DB.prepare(`UPDATE live_audience_events SET
      status=CASE WHEN ?='retry' AND attempts<2 THEN 'ready' WHEN ?='consumed' THEN 'consumed' ELSE 'discarded' END,
      viewer_ref_hash=CASE WHEN ?='retry' AND attempts<2 THEN viewer_ref_hash ELSE ? END,
      viewer_label=CASE WHEN ?='retry' AND attempts<2 THEN viewer_label ELSE '' END,
      question_text=CASE WHEN ?='retry' AND attempts<2 THEN question_text ELSE '' END,
      answer_text=CASE WHEN ?='retry' AND attempts<2 THEN answer_text ELSE '' END,
      claim_token=NULL,claimed_at=NULL,updated_at=?,consumed_at=CASE WHEN ?='consumed' THEN ? ELSE consumed_at END
      WHERE id=? AND session_id=? AND owner_id=? AND show_id=? AND status='claimed' AND claim_token=?`).bind(outcome, outcome, outcome, LIVE_AUDIENCE_REDACTED_VIEWER_HASH, outcome, outcome, outcome, now, outcome, now, eventId, sessionId, show.ownerId, show.id, claimToken).run();
    if (!Number(result.meta?.changes)) throw new LiveAudienceError('เหตุการณ์ถูกใช้หรือหมดอายุแล้ว', 409, 'LIVE_AUDIENCE_CLAIM_STALE');
    return liveJson({ viewer_id: auth.user.id, ok: true, event_id: eventId, outcome });
  } catch (error) { return inputResponse(error) || serverFailure(error); }
}
