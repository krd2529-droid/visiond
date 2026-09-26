import { createLiveAudienceQueue } from './live-audience-queue.js?v=020135';
import { LIVE_PORTRAIT_SOURCE_MAX_BYTES, createLivePortraitImagePipeline } from './live-portrait-image.js?v=020135';

const API_ROOT = '/api/admin/live-center';
const CACHE_TTL_MS = 15_000;

const cloneValue = value => typeof structuredClone === 'function'
  ? structuredClone(value)
  : JSON.parse(JSON.stringify(value));

export class LiveCenterApiError extends Error {
  constructor(message, { status = 0, code = '', payload = null } = {}) {
    super(message);
    this.name = 'LiveCenterApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

export function createLiveCenterStore({ fetchImpl = globalThis.fetch?.bind(globalThis), now = () => Date.now(), ttlMs = CACHE_TTL_MS } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is required');
  let viewer = 'unverified';
  const cache = new Map();
  const inflight = new Map();
  const tagEpoch = new Map();
  const epoch = tag => tagEpoch.get(tag) || 0;
  const idempotencyHeader = options => new Headers(options.headers || {}).get('idempotency-key') || '';
  const keyFor = (url, options) => `${viewer}:${String(options.method || 'GET').toUpperCase()}:${url}:${idempotencyHeader(options)}:${options.body || ''}`;

  function setViewer(nextViewer) {
    const value = String(nextViewer || 'anonymous');
    if (value !== viewer) {
      viewer = value;
      cache.clear();
      inflight.clear();
    }
  }

  function invalidate(tags) {
    const targets = new Set(Array.isArray(tags) ? tags : [tags]);
    for (const tag of targets) tagEpoch.set(tag, epoch(tag) + 1);
    for (const [key, entry] of cache) {
      if (entry.tags.some(tag => targets.has(tag))) cache.delete(key);
    }
    for (const [key, entry] of inflight) {
      if (entry.tags.some(tag => targets.has(tag))) inflight.delete(key);
    }
  }

  async function request(url, options = {}, { cacheable = true, tags = [] } = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const canCache = cacheable && method === 'GET';
    const canDedupe = method === 'GET' || Boolean(idempotencyHeader(options));
    const key = keyFor(url, { ...options, method });
    const cached = cache.get(key);
    if (canCache && cached && cached.expiresAt > now()) return cloneValue(cached.value);
    const pending = canDedupe ? inflight.get(key) : null;
    if (pending && pending.viewer === viewer && pending.tags.every(tag => epoch(tag) === pending.epochs.get(tag))) return pending.task;
    const startedViewer = viewer;
    const startedEpochs = new Map(tags.map(tag => [tag, epoch(tag)]));
    const task = (async () => {
      const response = await fetchImpl(url, {
        credentials: 'same-origin',
        ...options,
        method,
        headers: {
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok) {
        const isAiScript = /\/api\/admin\/live-center\/script$/.test(String(url).split(/[?#]/, 1)[0]);
        const transportFailure = isAiScript && response.status >= 500 && (!payload || typeof payload.error !== 'string' || !payload.error.trim());
        throw new LiveCenterApiError(transportFailure ? 'การเชื่อมต่อ AI ขัดข้อง กรุณาลองใหม่' : payload?.error || `HTTP ${response.status}`, {
          status: response.status,
          code: transportFailure ? 'LIVE_AI_TRANSPORT_FAILED' : payload?.code || '',
          payload: payload || {},
        });
      }
      if (!payload || typeof payload !== 'object') throw new LiveCenterApiError('คำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง', { status: response.status, code: 'LIVE_RESPONSE_INVALID', payload: {} });
      const responseViewer = payload.viewer_id === undefined || payload.viewer_id === null ? '' : String(payload.viewer_id);
      if (!responseViewer) throw new LiveCenterApiError('คำตอบไม่ระบุผู้ดูที่ได้รับอนุญาต', { status: 409, code: 'LIVE_VIEWER_UNVERIFIED', payload });
      {
        const currentPrincipal = viewer.split(':', 1)[0];
        const startedPrincipal = startedViewer.split(':', 1)[0];
        if (viewer !== startedViewer && responseViewer !== currentPrincipal) {
          throw new LiveCenterApiError('เซสชันผู้ดูเปลี่ยนระหว่างโหลดข้อมูล', { status: 409, code: 'LIVE_VIEWER_CHANGED', payload });
        }
        if (viewer === startedViewer && responseViewer !== startedPrincipal) setViewer(`${responseViewer}:server`);
      }
      const responseBelongsToCurrentViewer = responseViewer === viewer.split(':', 1)[0];
      const stillFresh = responseBelongsToCurrentViewer && tags.every(tag => epoch(tag) === startedEpochs.get(tag));
      if (canCache && stillFresh) cache.set(keyFor(url, { ...options, method }), { value: cloneValue(payload), expiresAt: now() + ttlMs, tags: [...tags] });
      return payload;
    })();
    const entry = { task, viewer: startedViewer, tags: [...tags], epochs: startedEpochs };
    if (canDedupe) inflight.set(key, entry);
    try {
      return await task;
    } finally {
      if (canDedupe && inflight.get(key) === entry) inflight.delete(key);
    }
  }

  return Object.freeze({
    request,
    setViewer,
    invalidate,
    inspect: () => ({ viewer, cacheKeys: [...cache.keys()], inflightKeys: [...inflight.keys()], tagEpochs: Object.fromEntries(tagEpoch) }),
  });
}

export const liveIdempotencyKey = prefix => `${prefix}.${crypto.randomUUID().replaceAll('-', '')}`;

let sceneSequence = 0;
const withSceneUi = scene => ({
  ...scene,
  client_id: `live-scene-${++sceneSequence}`,
  aiBusy: null,
  aiGeneration: 0,
  aiStatus: 'AI รองรับฉาก 5–180 วินาที',
  aiStatusType: '',
});

const state = {
  viewer: '',
  show: null,
  shows: [],
  showCursor: null,
  scenes: [],
  versions: [],
  versionCursor: null,
  products: [],
  productCursor: null,
  productQuery: '',
  selectedProducts: new Map(),
  dirty: false,
  createAttempt: null,
  versionAttempt: null,
  openTicket: 0,
  openingShowId: null,
  productTicket: 0,
  showListTicket: 0,
  versionTicket: 0,
  saveBusy: null,
  versionBusy: null,
  showDeleteBusy: new Map(),
  showDeleteAttempts: new Map(),
  foundationTicket: 0,
  foundationController: null,
  portraitBindingRevision: 0,
  activePortrait: null,
  portraitBusy: false,
  portraitPreviewUrl: '',
  portraitUploadAttempt: null,
  portraitDeleteAttempt: null,
  integrationHealth: null,
  facebookBoundary: null,
  localSession: null,
  localSessionAttempt: null,
  localStopAttempt: null,
  audienceBusy: false,
  audienceQueued: 0,
  audienceEventAttempt: null,
};

const store = typeof fetch === 'function' ? createLiveCenterStore() : null;
const portraitPipeline = typeof document !== 'undefined' ? createLivePortraitImagePipeline() : null;
const audienceQueue = createLiveAudienceQueue();
const $ = selector => document.querySelector(selector);
const element = (tag, className = '', text = '') => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
};
const money = (minor, currency = 'THB') => new Intl.NumberFormat('th-TH', { style: 'currency', currency }).format(Number(minor || 0) / 100);
const dateTime = value => value ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value)) : '';
const setStatus = (selector, message, type = '') => {
  const node = $(selector);
  if (!node) return;
  node.textContent = message || '';
  node.className = `status-line${type ? ` ${type}` : ''}`;
};
const setBusy = (button, busy, busyLabel = 'กำลังทำงาน…') => {
  if (!button) return;
  button.disabled = busy;
  if (busy) {
    button.dataset.previousLabel = button.textContent;
    button.textContent = busyLabel;
  } else if (button.dataset.previousLabel) {
    button.textContent = button.dataset.previousLabel;
    delete button.dataset.previousLabel;
  }
};
const bodySignature = body => JSON.stringify(body);
export const LIVE_FOUNDATION_REQUEST_TIMEOUT_MS = 15_000;
const blobSha256 = async blob => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');
const mutationAttempt = (current, prefix, body) => {
  const signature = bodySignature(body);
  return current?.signature === signature ? current : { signature, key: liveIdempotencyKey(prefix) };
};

async function foundationRequest(url, options = {}, signal = undefined) {
  const headers = new Headers(options.headers || {});
  headers.set('accept', 'application/json');
  if (typeof options.body === 'string' && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const requestController = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => requestController.abort(signal?.reason);
  if (signal?.aborted) abortFromCaller();
  else signal?.addEventListener?.('abort', abortFromCaller, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    requestController.abort();
  }, LIVE_FOUNDATION_REQUEST_TIMEOUT_MS);
  let response;
  let payload;
  try {
    response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers,
      signal: requestController.signal,
    });
    try {
      payload = await response.json();
    } catch (error) {
      if (requestController.signal.aborted) throw error;
      payload = null;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new LiveCenterApiError(timedOut
      ? 'การเชื่อมต่อ Live Center ใช้เวลานานเกินไป กรุณาลองใหม่'
      : 'การเชื่อมต่อ Live Center ขัดข้อง กรุณาลองใหม่', {
      code: timedOut ? 'LIVE_FOUNDATION_TIMEOUT' : 'LIVE_FOUNDATION_NETWORK_FAILED',
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener?.('abort', abortFromCaller);
  }
  if (!response.ok) throw new LiveCenterApiError(payload?.error || `HTTP ${response.status}`, {
    status: response.status,
    code: payload?.code || 'LIVE_FOUNDATION_FAILED',
    payload: payload || {},
  });
  const viewer = Number(payload?.viewer_id);
  if (!Number.isSafeInteger(viewer) || String(viewer) !== String(state.viewer).split(':', 1)[0]) {
    throw new LiveCenterApiError('คำตอบไม่ตรงกับผู้ดูที่ได้รับอนุญาต', { status: 409, code: 'LIVE_VIEWER_CHANGED' });
  }
  return payload;
}

function clearPortraitPreviewUrl() {
  if (state.portraitPreviewUrl) URL.revokeObjectURL(state.portraitPreviewUrl);
  state.portraitPreviewUrl = '';
}

function renderIntegrationHealth() {
  const health = state.integrationHealth;
  const badge = $('#integrationHealthBadge');
  if (!health) {
    badge.textContent = 'ยังไม่ได้เชื่อมต่อ';
    $('#integrationHealthList').replaceChildren(...['Sanitizer: รอตรวจ', 'Avatar: รอตรวจ', 'เสียงไทย: รอตรวจ', 'Facebook: รอตรวจ'].map(text => element('span', '', text)));
    return;
  }
  badge.textContent = health.status === 'connected' ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ';
  const statuses = [
    ['Sanitizer', health.server_pixel_reencode],
    ['Private R2', health.portrait_storage],
    ['D-ID Avatar', health.avatar?.connected],
    ['Azure th-TH', health.thai_voice?.connected],
    ['Facebook comments', health.facebook?.connected],
  ];
  $('#integrationHealthList').replaceChildren(...statuses.map(([label, connected]) => element('span', connected ? 'connected' : 'disconnected', `${label}: ${connected ? 'พร้อม' : 'ยังไม่ได้เชื่อมต่อ'}`)));
}

function renderPortraitFoundation() {
  const saved = Boolean(state.show?.id);
  const item = state.activePortrait;
  const preview = $('#presenterPortraitPreview');
  const placeholder = $('#presenterPortraitPlaceholder');
  if (state.portraitPreviewUrl) {
    preview.src = state.portraitPreviewUrl;
    preview.hidden = false;
    placeholder.hidden = true;
  } else if (item?.image_url) {
    preview.src = item.image_url;
    preview.hidden = false;
    placeholder.hidden = true;
  } else {
    preview.removeAttribute('src');
    preview.hidden = true;
    placeholder.hidden = false;
  }
  $('#presenterPortraitMeta').textContent = item
    ? `เลือกใช้แล้ว · ${item.width}×${item.height} · รุ่นรูป ${item.portrait_version} · เก็บแบบส่วนตัว`
    : saved ? 'ยังไม่มีรูปที่เลือกใช้กับรายการนี้' : 'บันทึกรายการก่อนจึงจะอัปโหลดได้';
  renderIntegrationHealth();
  syncFoundationControls();
}

function populateAudienceProducts() {
  const select = $('#audienceProduct');
  const previous = Number(select.value || 0);
  select.replaceChildren();
  for (const scene of state.scenes) {
    const option = document.createElement('option');
    option.value = String(scene.product_id);
    option.textContent = scene.product.title;
    select.append(option);
  }
  if (state.scenes.some(scene => scene.product_id === previous)) select.value = String(previous);
}

function renderAudienceFoundation() {
  const answer = $('#audienceTestAnswer');
  $('#audienceQueueCount').textContent = `${Math.min(24, state.audienceQueued)} / 24`;
  $('#audienceTestPanel').dataset.localTestState = state.localSession ? 'active' : 'stopped';
  if (!answer.dataset.visible) answer.hidden = true;
  syncFoundationControls();
}

function syncFoundationControls() {
  const saved = Boolean(state.show?.id);
  const portraitDisabled = !saved || state.portraitBusy || state.audienceBusy;
  for (const selector of ['#presenterPortrait', '#presenterRightsConsent', '#presenterAnimationConsent', '#presenterAuthorizedAdult']) {
    const control = $(selector); if (control) control.disabled = portraitDisabled;
  }
  const consented = $('#presenterRightsConsent')?.checked && $('#presenterAnimationConsent')?.checked && $('#presenterAuthorizedAdult')?.checked;
  $('#uploadPresenterPortrait').disabled = portraitDisabled || !$('#presenterPortrait')?.files?.[0] || !consented;
  $('#deletePresenterPortrait').disabled = portraitDisabled || !state.activePortrait;

  const localEnabled = saved && Boolean(state.integrationHealth?.local_test);
  const localActive = Boolean(state.localSession);
  $('#startAudienceTest').disabled = !localEnabled || localActive || state.audienceBusy || state.portraitBusy;
  $('#stopAudienceTest').disabled = !localActive || state.audienceBusy || state.portraitBusy;
  $('#sendAudienceTest').disabled = !localActive || state.audienceBusy || state.portraitBusy || state.scenes.length === 0;
  $('#claimAudienceTest').disabled = !localActive || state.audienceBusy || state.portraitBusy;
  $('#audienceEventKind').disabled = !localActive || state.audienceBusy || state.portraitBusy;
  $('#audienceViewerLabel').disabled = !localActive || state.audienceBusy || state.portraitBusy;
  $('#audienceProduct').disabled = !localActive || state.audienceBusy || state.portraitBusy || state.scenes.length === 0;
  $('#audienceQuestion').disabled = !localActive || state.audienceBusy || state.portraitBusy || $('#audienceEventKind').value !== 'comment';
}

function stopLocalSessionInBackground(showId, session, attempt) {
  if (!showId || !session?.id) return;
  const body = JSON.stringify({ session_id: session.id });
  const key = attempt?.key || liveIdempotencyKey('local-stop');
  void fetch(`${API_ROOT}/shows/${showId}/audience/local-session`, {
    method: 'DELETE', credentials: 'same-origin', cache: 'no-store', keepalive: true,
    headers: { 'content-type': 'application/json', accept: 'application/json', 'idempotency-key': key }, body,
  }).catch(() => undefined);
}

function resetFoundationContext({ stopSession = true } = {}) {
  const oldShowId = state.show?.id;
  const oldSession = state.localSession;
  const oldStopAttempt = state.localStopAttempt;
  state.foundationTicket += 1;
  state.foundationController?.abort();
  state.foundationController = null;
  portraitPipeline?.cancel();
  if (stopSession) stopLocalSessionInBackground(oldShowId, oldSession, oldStopAttempt);
  clearPortraitPreviewUrl();
  state.portraitBindingRevision = 0;
  state.activePortrait = null;
  state.portraitBusy = false;
  state.portraitUploadAttempt = null;
  state.portraitDeleteAttempt = null;
  state.integrationHealth = null;
  state.facebookBoundary = null;
  state.localSession = null;
  state.localSessionAttempt = null;
  state.localStopAttempt = null;
  state.audienceBusy = false;
  state.audienceQueued = 0;
  state.audienceEventAttempt = null;
  audienceQueue.clear('show-change');
  const answer = $('#audienceTestAnswer');
  if (answer) { answer.hidden = true; delete answer.dataset.visible; answer.querySelector('p').textContent = ''; }
  if ($('#presenterPortrait')) $('#presenterPortrait').value = '';
  for (const selector of ['#presenterRightsConsent', '#presenterAnimationConsent', '#presenterAuthorizedAdult']) if ($(selector)) $(selector).checked = false;
  renderPortraitFoundation();
  populateAudienceProducts();
  renderAudienceFoundation();
}

async function loadFoundation(showId, { ticket = state.openTicket } = {}) {
  const foundationTicket = ++state.foundationTicket;
  state.foundationController?.abort();
  const controller = new AbortController();
  state.foundationController = controller;
  setStatus('#portraitStatus', 'กำลังตรวจสถานะ Photo Avatar…');
  setStatus('#audienceStatus', 'กำลังตรวจ Local Test…');
  try {
    const [health, portraits, facebook] = await Promise.all([
      foundationRequest(`${API_ROOT}/integration-health`, {}, controller.signal),
      foundationRequest(`${API_ROOT}/shows/${showId}/presenter?limit=24`, {}, controller.signal),
      foundationRequest(`${API_ROOT}/shows/${showId}/facebook-connector`, {}, controller.signal),
    ]);
    if (foundationTicket !== state.foundationTicket || ticket !== state.openTicket || state.show?.id !== showId) return;
    state.integrationHealth = health;
    state.facebookBoundary = facebook;
    state.portraitBindingRevision = Number(portraits.binding?.revision || 0);
    state.activePortrait = portraits.items?.find(item => item.id === portraits.binding?.active_id && item.status === 'active') || null;
    renderPortraitFoundation();
    renderAudienceFoundation();
    setStatus('#portraitStatus', state.activePortrait ? 'รูปส่วนตัวนี้ถูกเลือกใช้กับรายการแล้ว' : 'ยังไม่มี Photo Avatar ที่เลือกใช้', state.activePortrait ? 'success' : '');
    setStatus('#audienceStatus', health.local_test
      ? 'พร้อมใช้ LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม'
      : 'Local Test ยังไม่ได้เปิดในเซิร์ฟเวอร์ · Facebook ยังไม่ได้เชื่อมต่อ', health.local_test ? 'success' : '');
  } catch (error) {
    if (error?.name === 'AbortError' || foundationTicket !== state.foundationTicket) return;
    setStatus('#portraitStatus', error.message, 'error');
    setStatus('#audienceStatus', error.message, 'error');
  } finally {
    if (state.foundationController === controller) state.foundationController = null;
    syncFoundationControls();
  }
}

function updateActionState() {
  const saved = Boolean(state.show?.id);
  $('#refreshShow').disabled = !saved;
  $('#saveShow').disabled = Boolean(state.saveBusy);
  $('#createVersion').disabled = Boolean(state.versionBusy) || !saved || state.dirty || state.scenes.length === 0;
  $('#sceneCount').textContent = `${state.scenes.length} / 24 ฉาก`;
}

function markDirty() {
  state.dirty = true;
  state.versionAttempt = null;
  updateActionState();
  setStatus('#showStatus', 'มีการแก้ไขที่ยังไม่ได้บันทึก');
}

function invalidatePendingSceneAi(message = 'ยกเลิกผล AI เพราะรายการเปลี่ยนระหว่างรอ') {
  let changed = false;
  for (const scene of state.scenes) {
    if (!scene.aiBusy) continue;
    scene.aiGeneration = Number(scene.aiGeneration || 0) + 1;
    scene.aiBusy = null;
    scene.aiStatus = message;
    scene.aiStatusType = '';
    changed = true;
  }
  if (changed) renderScenes();
}

function advanceEditorEpoch() {
  state.openTicket += 1;
  invalidatePendingSceneAi();
  return state.openTicket;
}

function renderShows() {
  const list = $('#showList');
  list.replaceChildren();
  for (const show of state.shows) {
    const card = element('article', 'show-card');
    card.setAttribute('aria-current', String(show.id === state.show?.id));
    const button = element('button', 'show-row');
    button.type = 'button';
    button.setAttribute('aria-label', `เปิดรายการ ${show.title}`);
    const copy = element('div');
    copy.append(element('h3', '', show.title), element('p', '', `${show.scene_count} ฉาก · revision ${show.revision}`));
    button.append(copy, element('small', '', dateTime(show.updated_at)));
    button.addEventListener('click', () => openShow(show.id));
    const deleting = state.showDeleteBusy.has(show.id);
    const deleteButton = element('button', 'vds-btn vds-btn--danger show-delete', deleting ? 'กำลังลบ…' : 'ลบ');
    deleteButton.type = 'button';
    deleteButton.disabled = deleting;
    deleteButton.setAttribute('aria-label', `ลบรายการ ${show.title}`);
    deleteButton.addEventListener('click', () => deleteSavedShow(show));
    card.append(button, deleteButton);
    list.append(card);
  }
  if (!state.shows.length) list.append(element('p', 'empty', 'ยังไม่มีรายการไลฟ์'));
  $('#loadMoreShows').hidden = !state.showCursor;
}

async function loadShows({ append = false } = {}) {
  const ticket = ++state.showListTicket;
  $('#loadMoreShows').disabled = true;
  if (!append) {
    state.showCursor = null;
    state.shows = [];
    $('#showList').replaceChildren(element('p', 'empty', 'กำลังโหลดรายการ…'));
  }
  const params = new URLSearchParams({ limit: '24' });
  if (state.showCursor) params.set('cursor', state.showCursor);
  try {
    const data = await store.request(`${API_ROOT}/shows?${params}`, {}, { tags: ['shows:list'] });
    if (ticket !== state.showListTicket) return;
    state.shows = append ? [...state.shows, ...data.items] : data.items;
    state.showCursor = data.pagination.next_cursor;
    renderShows();
  } catch (error) {
    if (ticket === state.showListTicket) $('#showList').replaceChildren(element('p', 'empty', error.message));
  } finally {
    if (ticket === state.showListTicket) $('#loadMoreShows').disabled = false;
  }
}

function freshShow({ stopSession = true } = {}) {
  resetFoundationContext({ stopSession });
  advanceEditorEpoch();
  state.openingShowId = null;
  state.show = null;
  state.scenes = [];
  state.selectedProducts.clear();
  state.versions = [];
  state.versionCursor = null;
  state.dirty = false;
  state.createAttempt = null;
  state.versionAttempt = null;
  $('#showForm').reset();
  $('#editorTitle').textContent = 'สร้างรายการไลฟ์';
  $('#showRevision').textContent = 'รายการใหม่';
  setStatus('#showStatus', 'กรอกชื่อ เลือกสินค้า แล้วบันทึกร่าง');
  renderShows();
  renderScenes();
  renderVersions();
  updateActionState();
}

async function deleteSavedShow(show) {
  if (!show?.id || state.showDeleteBusy.has(show.id)) return;
  if (!confirm(`ต้องการลบรายการ "${show.title}" ใช่หรือไม่?`)) return;
  const body = { owner_id: Number(show.owner_id), title: show.title, expected_revision: Number(show.revision) };
  const currentAttempt = state.showDeleteAttempts.get(show.id);
  const attempt = mutationAttempt(currentAttempt, 'show.delete', body);
  state.showDeleteAttempts.set(show.id, attempt);
  const busyToken = {};
  state.showDeleteBusy.set(show.id, busyToken);
  renderShows();
  setStatus('#showStatus', `กำลังลบรายการ “${show.title}”…`);
  try {
    const data = await store.request(`${API_ROOT}/shows/${show.id}`, {
      method: 'DELETE',
      headers: { 'idempotency-key': attempt.key },
      body: JSON.stringify(body),
    }, { cacheable: false });
    if (state.showDeleteBusy.get(show.id) !== busyToken) return;
    store.invalidate(['shows:list', `show:${show.id}`, `versions:${show.id}`]);
    state.showDeleteAttempts.delete(show.id);
    state.shows = state.shows.filter(item => item.id !== show.id);
    const deletedActiveShow = state.show?.id === show.id;
    if (deletedActiveShow) freshShow({ stopSession: false });
    else {
      if (state.openingShowId === show.id) {
        advanceEditorEpoch();
        state.openingShowId = null;
      }
      renderShows();
    }
    setStatus('#showStatus', data.cleanup_pending
      ? `ลบรายการ “${show.title}” แล้ว · ระบบกำลังล้างรูปส่วนตัวที่ผูกกับรายการ`
      : `ลบรายการ “${show.title}” แล้ว`, 'success');
    await loadShows();
  } catch (error) {
    setStatus('#showStatus', `ลบรายการ “${show.title}” ไม่สำเร็จ: ${error.message}`, 'error');
  } finally {
    if (state.showDeleteBusy.get(show.id) === busyToken) state.showDeleteBusy.delete(show.id);
    renderShows();
    updateActionState();
  }
}

function hydrateShow(item) {
  state.show = item;
  state.scenes = item.scenes.map(scene => withSceneUi({
    product_id: scene.product_id,
    product: {
      id: scene.product_id,
      meta_id: scene.product.meta_id,
      title: scene.product.title,
      price_minor: scene.product.price_minor,
      currency: scene.product.currency,
      stock: scene.product.stock_saved,
      available: scene.product.available,
    },
    script: scene.script,
    cue: { ...scene.cue },
  }));
  state.selectedProducts = new Map(state.scenes.map(scene => [scene.product_id, scene.product]));
  state.dirty = false;
  state.createAttempt = null;
  state.versionAttempt = null;
  $('#showTitle').value = item.title;
  $('#showDescription').value = item.description;
  $('#avatarPreset').value = item.avatar_preset;
  $('#outputProfile').value = item.output_profile;
  $('#editorTitle').textContent = item.title;
  $('#showRevision').textContent = `revision ${item.revision} · ${item.scene_count} ฉาก`;
  renderShows();
  renderScenes();
  updateActionState();
}

async function openShow(id, { refresh = false } = {}) {
  resetFoundationContext();
  const ticket = advanceEditorEpoch();
  state.openingShowId = id;
  setStatus('#showStatus', 'กำลังเปิดรายการ…');
  try {
    if (refresh) store.invalidate([`show:${id}`]);
    const data = await store.request(`${API_ROOT}/shows/${id}`, {}, { tags: [`show:${id}`] });
    if (ticket !== state.openTicket) return;
    hydrateShow(data.item);
    setStatus('#showStatus', 'โหลดรายการแล้ว', 'success');
    await Promise.all([loadVersions({ reset: true, ticket }), loadFoundation(id, { ticket })]);
  } catch (error) {
    if (ticket === state.openTicket) setStatus('#showStatus', error.message, 'error');
  } finally {
    if (ticket === state.openTicket && state.openingShowId === id) state.openingShowId = null;
  }
}

function showPayload() {
  return {
    title: $('#showTitle').value,
    description: $('#showDescription').value,
    avatar_preset: $('#avatarPreset').value,
    output_profile: $('#outputProfile').value,
    scenes: state.scenes.map(scene => ({
      product_id: scene.product_id,
      script: scene.script,
      cue: { ...scene.cue },
    })),
  };
}

async function saveShow(event) {
  event.preventDefault();
  if (state.saveBusy) return;
  const button = $('#saveShow');
  const busyToken = {};
  state.saveBusy = busyToken;
  const originalShowId = state.show?.id || null;
  const originalRevision = state.show?.revision || null;
  const operationTicket = advanceEditorEpoch();
  const editorStillOriginal = () => state.openTicket === operationTicket
    && (originalShowId
      ? state.show?.id === originalShowId && state.show?.revision === originalRevision
      : !state.show);
  if (originalShowId) store.invalidate([`show:${originalShowId}`]);
  setBusy(button, true, 'กำลังบันทึก…');
  try {
    const base = showPayload();
    let data;
    if (originalShowId) {
      data = await store.request(`${API_ROOT}/shows/${originalShowId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...base, expected_revision: originalRevision }),
      }, { cacheable: false });
      store.invalidate([`show:${originalShowId}`, 'shows:list']);
    } else {
      state.createAttempt = mutationAttempt(state.createAttempt, 'show', base);
      const attempt = state.createAttempt;
      data = await store.request(`${API_ROOT}/shows`, {
        method: 'POST',
        headers: { 'idempotency-key': attempt.key },
        body: JSON.stringify(base),
      }, { cacheable: false });
      store.invalidate(['shows:list']);
    }
    const applied = editorStillOriginal();
    if (applied) hydrateShow(data.item);
    await loadShows();
    if (applied && state.openTicket === operationTicket && state.show?.id === data.item.id) {
      setStatus('#showStatus', data.replayed ? 'พบคำขอเดิมและโหลดผลลัพธ์เดิมแล้ว' : 'บันทึกร่างแล้ว', 'success');
      await Promise.all([
        loadVersions({ reset: true, ticket: operationTicket }),
        originalShowId ? Promise.resolve() : loadFoundation(data.item.id, { ticket: operationTicket }),
      ]);
    }
  } catch (error) {
    if (editorStillOriginal()) {
      if (error.code === 'LIVE_STALE_REVISION') setStatus('#showStatus', `${error.message} (revision ล่าสุด ${error.payload?.current_revision || '?'})`, 'error');
      else setStatus('#showStatus', error.message, 'error');
    }
  } finally {
    if (state.saveBusy === busyToken) {
      state.saveBusy = null;
      setBusy(button, false);
    }
    updateActionState();
  }
}

function renderProducts() {
  const list = $('#productList');
  list.replaceChildren();
  for (const product of state.products) {
    const card = element('article', 'product-item');
    const image = element('img');
    image.alt = product.title;
    image.loading = 'lazy';
    if (product.image_url) image.src = product.image_url;
    const body = element('div', 'product-body');
    body.append(element('h3', '', product.title), element('p', '', `${money(product.price_minor, product.currency)} · เหลือ ${product.stock}`));
    const selected = state.scenes.some(scene => scene.product_id === product.id);
    const add = element('button', 'vds-btn vds-btn--secondary', selected ? 'อยู่ในฉากแล้ว' : 'เพิ่มเข้าฉาก');
    add.type = 'button';
    add.disabled = selected || state.scenes.length >= 24;
    add.addEventListener('click', () => addProduct(product));
    body.append(add);
    card.append(image, body);
    list.append(card);
  }
  if (!state.products.length) list.append(element('p', 'empty', state.productQuery ? 'ไม่พบสินค้าที่พร้อมขายและชื่อขึ้นต้นตามคำค้น' : 'ไม่มีสินค้าที่พร้อมขาย'));
  $('#loadMoreProducts').hidden = !state.productCursor;
}

async function loadProducts({ append = false } = {}) {
  const query = append ? state.productQuery : $('#productSearch').value.trim();
  $('#loadMoreProducts').disabled = true;
  if (!append) {
    state.productCursor = null;
    state.products = [];
    state.productQuery = query;
    $('#productList').replaceChildren(element('p', 'empty', 'กำลังค้นหาสินค้า…'));
  }
  const ticket = ++state.productTicket;
  const params = new URLSearchParams({ limit: '24' });
  if (query) params.set('q', query);
  if (state.productCursor) params.set('cursor', state.productCursor);
  try {
    const data = await store.request(`${API_ROOT}/products?${params}`, {}, { tags: [`products:${query}`] });
    if (ticket !== state.productTicket || query !== state.productQuery) return;
    state.products = append ? [...state.products, ...data.items] : data.items;
    state.productCursor = data.pagination.next_cursor;
    for (const product of data.items) if (state.selectedProducts.has(product.id)) state.selectedProducts.set(product.id, product);
    renderProducts();
    setStatus('#productStatus', `${state.products.length} รายการ${data.pagination.has_more ? ' · ยังมีหน้าถัดไป' : ''}`);
  } catch (error) {
    if (ticket === state.productTicket) {
      $('#productList').replaceChildren(element('p', 'empty', error.message));
      setStatus('#productStatus', error.message, 'error');
    }
  } finally {
    if (ticket === state.productTicket) $('#loadMoreProducts').disabled = false;
  }
}

function addProduct(product) {
  if (state.scenes.length >= 24 || state.scenes.some(scene => scene.product_id === product.id)) return;
  state.selectedProducts.set(product.id, product);
  state.scenes.push(withSceneUi({
    product_id: product.id,
    product,
    script: '',
    cue: { label: '', duration_seconds: 60, transition: 'cut' },
  }));
  markDirty();
  renderScenes();
  renderProducts();
}

function moveScene(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.scenes.length) return;
  [state.scenes[index], state.scenes[target]] = [state.scenes[target], state.scenes[index]];
  markDirty();
  renderScenes();
}

function removeScene(index) {
  state.selectedProducts.delete(state.scenes[index].product_id);
  state.scenes.splice(index, 1);
  markDirty();
  renderScenes();
  renderProducts();
}

async function generateSceneScript(scene) {
  if (scene.aiBusy || !state.scenes.includes(scene)) return;
  const previousScript = scene.script;
  if (previousScript !== '' && !globalThis.confirm('AI จะเขียนทับบทพูดเดิมของฉากนี้ ต้องการดำเนินการต่อหรือไม่?')) return;
  const productId = scene.product_id;
  const durationSeconds = Number(scene.cue.duration_seconds);
  const editorTicket = state.openTicket;
  const generation = Number(scene.aiGeneration || 0) + 1;
  const busyToken = {};
  scene.aiGeneration = generation;
  scene.aiBusy = busyToken;
  scene.aiStatus = 'AI กำลังคิดบทพูด…';
  scene.aiStatusType = '';
  renderScenes();
  const ownsResult = () => state.openTicket === editorTicket
    && state.scenes.includes(scene)
    && scene.aiBusy === busyToken
    && scene.aiGeneration === generation;
  const ownsBusyToken = () => scene.aiBusy === busyToken && scene.aiGeneration === generation;
  const inputUnchanged = () => scene.product_id === productId
    && Number(scene.cue.duration_seconds) === durationSeconds
    && scene.script === previousScript;
  try {
    const data = await store.request(`${API_ROOT}/script`, {
      method: 'POST',
      headers: { 'idempotency-key': liveIdempotencyKey(`script${productId}`) },
      body: JSON.stringify({ product_id: productId, duration_seconds: durationSeconds }),
    }, { cacheable: false });
    if (!ownsResult()) return;
    if (!inputUnchanged()) {
      scene.aiStatus = 'ฉากเปลี่ยนระหว่างรอ AI จึงไม่ได้นำบทพูดมาใส่';
      scene.aiStatusType = 'error';
      return;
    }
    if (typeof data.script !== 'string' || !data.script) throw new LiveCenterApiError('AI ไม่ได้ส่งบทพูดที่ใช้งานได้', { status: 502, code: 'LIVE_AI_OUTPUT_INVALID' });
    scene.script = data.script;
    scene.aiStatus = 'AI ร่างบทพูดแล้ว กรุณาตรวจทานและกดบันทึกร่าง';
    scene.aiStatusType = 'success';
    markDirty();
  } catch (error) {
    if (ownsResult()) {
      scene.aiStatus = error.message || 'AI ยังสร้างบทพูดไม่สำเร็จ กรุณาลองใหม่';
      scene.aiStatusType = 'error';
    }
  } finally {
    if (ownsBusyToken()) {
      const staleEditor = !ownsResult() && state.scenes.includes(scene);
      if (staleEditor) {
        scene.aiStatus = 'ยกเลิกผล AI เพราะรายการเปลี่ยนระหว่างรอ';
        scene.aiStatusType = '';
      }
      scene.aiBusy = null;
      if (state.scenes.includes(scene)) renderScenes();
    }
  }
}

function renderScenes() {
  const list = $('#sceneList');
  list.replaceChildren();
  state.scenes.forEach((scene, index) => {
    const row = element('article', 'scene-item');
    row.append(element('div', 'scene-position', String(index + 1)));
    const product = element('div', 'scene-product');
    product.append(element('h3', '', scene.product.title), element('p', '', `${money(scene.product.price_minor, scene.product.currency)} · snapshot stock ${scene.product.stock}`));
    if (scene.product.available === false) product.append(element('p', 'status-line error', 'สินค้านี้ไม่พร้อมขาย ต้องเลือกใหม่ก่อนสร้างเวอร์ชัน'));
    const fields = element('div', 'scene-controls');
    const scriptField = element('div', 'vds-field script-field');
    const scriptHead = element('div', 'script-field-head');
    const scriptId = `${scene.client_id}-script`;
    const statusId = `${scene.client_id}-ai-status`;
    const scriptLabel = element('label', '', 'บทพูด');
    scriptLabel.htmlFor = scriptId;
    const aiButton = element('button', 'vds-btn vds-btn--secondary scene-ai-button', scene.aiBusy ? 'AI กำลังคิด…' : 'AI คิดบทพูด');
    aiButton.type = 'button';
    aiButton.disabled = Boolean(scene.aiBusy);
    aiButton.setAttribute('aria-busy', String(Boolean(scene.aiBusy)));
    aiButton.setAttribute('aria-describedby', statusId);
    aiButton.setAttribute('aria-label', `AI คิดบทพูดสำหรับ ${scene.product.title}`);
    aiButton.addEventListener('click', () => generateSceneScript(scene));
    scriptHead.append(scriptLabel, aiButton);
    const script = element('textarea');
    script.id = scriptId;
    script.rows = 4;
    script.maxLength = 12000;
    script.value = scene.script;
    script.addEventListener('input', () => { scene.script = script.value; markDirty(); });
    const aiStatus = element('p', `scene-ai-status${scene.aiStatusType ? ` ${scene.aiStatusType}` : ''}`, scene.aiStatus || 'AI รองรับฉาก 5–180 วินาที');
    aiStatus.id = statusId;
    aiStatus.setAttribute('role', 'status');
    aiStatus.setAttribute('aria-live', 'polite');
    scriptField.append(scriptHead, script, aiStatus);
    const cueLabel = element('label', 'vds-field', 'ชื่อคิว');
    const cueInput = element('input');
    cueInput.maxLength = 120;
    cueInput.value = scene.cue.label;
    cueInput.addEventListener('input', () => { scene.cue.label = cueInput.value; markDirty(); });
    cueLabel.append(cueInput);
    const durationLabel = element('label', 'vds-field', 'วินาที');
    const duration = element('input');
    duration.type = 'number';
    duration.min = '5';
    duration.max = '3600';
    duration.value = String(scene.cue.duration_seconds);
    duration.addEventListener('input', () => { scene.cue.duration_seconds = Number(duration.value); markDirty(); });
    durationLabel.append(duration);
    const transitionLabel = element('label', 'vds-field', 'Transition');
    const transition = element('select');
    for (const [value, label] of [['cut', 'Cut'], ['fade', 'Fade']]) {
      const option = element('option', '', label);
      option.value = value;
      option.selected = scene.cue.transition === value;
      transition.append(option);
    }
    transition.addEventListener('change', () => { scene.cue.transition = transition.value; markDirty(); });
    transitionLabel.append(transition);
    const actions = element('div', 'scene-actions');
    const up = element('button', 'vds-btn vds-btn--secondary', '↑ ขึ้น');
    const down = element('button', 'vds-btn vds-btn--secondary', '↓ ลง');
    const remove = element('button', 'vds-btn vds-btn--danger', 'เอาออก');
    for (const button of [up, down, remove]) button.type = 'button';
    up.disabled = index === 0;
    down.disabled = index === state.scenes.length - 1;
    up.addEventListener('click', () => moveScene(index, -1));
    down.addEventListener('click', () => moveScene(index, 1));
    remove.addEventListener('click', () => removeScene(index));
    actions.append(up, down, remove);
    fields.append(scriptField, cueLabel, durationLabel, transitionLabel, actions);
    row.append(product, fields);
    list.append(row);
  });
  if (!state.scenes.length) list.append(element('p', 'empty', 'ยังไม่มีฉาก เลือกสินค้าด้านบนได้เลย'));
  populateAudienceProducts();
  updateActionState();
  syncFoundationControls();
}

function renderVersions() {
  const list = $('#versionList');
  list.replaceChildren();
  for (const version of state.versions) {
    const row = element('article', 'version-row');
    const copy = element('div');
    copy.append(
      element('h3', '', `เวอร์ชัน ${version.version_number}`),
      element('p', '', `${version.package_size.toLocaleString('th-TH')} bytes · ${dateTime(version.created_at)}`),
      element('small', 'version-hash', version.package_sha256),
    );
    const download = element('a', 'vds-btn vds-btn--primary', 'ดาวน์โหลด');
    download.href = version.download_url;
    download.download = '';
    row.append(copy, download);
    list.append(row);
  }
  if (!state.show?.id) list.append(element('p', 'empty', 'บันทึกรายการก่อนจึงจะสร้างเวอร์ชันได้'));
  else if (!state.versions.length) list.append(element('p', 'empty', 'ยังไม่มีเวอร์ชันแพ็กเกจ'));
  $('#loadMoreVersions').hidden = !state.versionCursor;
}

async function loadVersions({ reset = false, ticket = state.openTicket } = {}) {
  if (!state.show?.id) return;
  const requestTicket = ++state.versionTicket;
  $('#loadMoreVersions').disabled = true;
  const showId = state.show.id;
  if (reset) {
    state.versionCursor = null;
    state.versions = [];
    $('#versionList').replaceChildren(element('p', 'empty', 'กำลังโหลดเวอร์ชัน…'));
  }
  const params = new URLSearchParams({ limit: '24' });
  if (state.versionCursor) params.set('cursor', state.versionCursor);
  try {
    const data = await store.request(`${API_ROOT}/shows/${showId}/versions?${params}`, {}, { tags: [`versions:${showId}`] });
    if (requestTicket !== state.versionTicket || ticket !== state.openTicket || showId !== state.show?.id) return;
    state.versions = reset ? data.items : [...state.versions, ...data.items];
    state.versionCursor = data.pagination.next_cursor;
    renderVersions();
  } catch (error) {
    if (requestTicket === state.versionTicket && ticket === state.openTicket) {
      $('#versionList').replaceChildren(element('p', 'empty', error.message));
      setStatus('#versionStatus', error.message, 'error');
    }
  } finally {
    if (requestTicket === state.versionTicket) $('#loadMoreVersions').disabled = false;
  }
}

async function createVersion() {
  if (state.versionBusy || !state.show?.id || state.dirty || !state.scenes.length) return;
  const button = $('#createVersion');
  const busyToken = {};
  state.versionBusy = busyToken;
  const showId = state.show.id;
  const revision = state.show.revision;
  const operationTicket = advanceEditorEpoch();
  const editorStillOriginal = () => state.openTicket === operationTicket && state.show?.id === showId && state.show?.revision === revision;
  setBusy(button, true, 'กำลังสร้างแพ็กเกจ…');
  const payload = { expected_revision: revision };
  state.versionAttempt = mutationAttempt(state.versionAttempt, `version${revision}`, payload);
  const attempt = state.versionAttempt;
  store.invalidate([`versions:${showId}`]);
  try {
    const data = await store.request(`${API_ROOT}/shows/${showId}/versions`, {
      method: 'POST',
      headers: { 'idempotency-key': attempt.key },
      body: JSON.stringify(payload),
    }, { cacheable: false });
    store.invalidate([`versions:${showId}`]);
    if (editorStillOriginal()) {
      await loadVersions({ reset: true, ticket: operationTicket });
      if (editorStillOriginal()) {
        setStatus('#versionStatus', data.replayed ? 'โหลดเวอร์ชันเดิมจากคำขอซ้ำแล้ว' : 'สร้างแพ็กเกจสำเร็จ พร้อมดาวน์โหลด', 'success');
        if (state.versionAttempt === attempt) state.versionAttempt = null;
      }
    }
  } catch (error) {
    if (editorStillOriginal()) setStatus('#versionStatus', error.message, 'error');
  } finally {
    if (state.versionBusy === busyToken) {
      state.versionBusy = null;
      setBusy(button, false);
    }
    updateActionState();
  }
}

async function uploadPresenterPortrait() {
  if (!state.show?.id || state.portraitBusy || state.audienceBusy) return;
  const file = $('#presenterPortrait').files?.[0];
  if (!file) return;
  const showId = state.show.id;
  const ticket = ++state.foundationTicket;
  state.foundationController?.abort();
  const controller = new AbortController();
  state.foundationController = controller;
  state.portraitBusy = true;
  syncFoundationControls();
  setStatus('#portraitStatus', 'กำลังสร้างรูปอนุพันธ์ที่ปลอดภัยใน Browser…');
  try {
    if (!(file instanceof Blob) || !file.size || file.size > LIVE_PORTRAIT_SOURCE_MAX_BYTES) throw new RangeError('รูปต้นฉบับต้องมีขนาดไม่เกิน 12 MB');
    const sourceHash = await blobSha256(file);
    const sourceSignature = bodySignature({ show_id: showId, name: file.name, size: file.size, last_modified: file.lastModified, source_hash: sourceHash, expected_binding_revision: state.portraitBindingRevision });
    let attempt = state.portraitUploadAttempt;
    if (!attempt || attempt.sourceSignature !== sourceSignature) {
      const prepared = await portraitPipeline.prepare(file);
      const derivativeHash = await blobSha256(prepared.file);
      attempt = {
        sourceSignature,
        signature: bodySignature({ sourceSignature, derivativeHash, consent: 'rights+animation+authorized-adult' }),
        key: liveIdempotencyKey('portrait-upload'),
        prepared,
      };
      state.portraitUploadAttempt = attempt;
    }
    const { prepared } = attempt;
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    clearPortraitPreviewUrl();
    state.portraitPreviewUrl = URL.createObjectURL(prepared.file);
    renderPortraitFoundation();
    setStatus('#portraitStatus', 'กำลังส่งรูปอนุพันธ์ไปยังบริการทำความสะอาดรูปส่วนตัว…');
    const form = new FormData();
    form.set('portrait', prepared.file, 'visiond-presenter.jpg');
    form.set('rights_consent', 'accepted');
    form.set('animation_consent', 'accepted');
    form.set('identity_scope', 'authorized_adult');
    form.set('consent_policy', 'visiond-live-portrait-consent-v1');
    form.set('expected_binding_revision', String(state.portraitBindingRevision));
    const data = await foundationRequest(`${API_ROOT}/shows/${showId}/presenter`, {
      method: 'POST',
      headers: { 'idempotency-key': attempt.key },
      body: form,
    }, controller.signal);
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    clearPortraitPreviewUrl();
    state.activePortrait = data.item;
    state.portraitBindingRevision = Number(data.binding_revision || state.portraitBindingRevision + 1);
    state.portraitUploadAttempt = null;
    state.portraitDeleteAttempt = null;
    $('#presenterPortrait').value = '';
    for (const selector of ['#presenterRightsConsent', '#presenterAnimationConsent', '#presenterAuthorizedAdult']) $(selector).checked = false;
    renderPortraitFoundation();
    setStatus('#portraitStatus', data.cleanup_pending
      ? 'เลือกใช้รูปใหม่แล้ว · การลบไฟล์เก่าจะลองซ้ำจาก checkpoint'
      : 'อัปโหลด ทำความสะอาด และเลือกใช้รูปส่วนตัวแล้ว', 'success');
  } catch (error) {
    if (error?.name !== 'AbortError' && ticket === state.foundationTicket) setStatus('#portraitStatus', error.message, 'error');
  } finally {
    if (ticket === state.foundationTicket) {
      state.portraitBusy = false;
      if (state.foundationController === controller) state.foundationController = null;
      syncFoundationControls();
    }
  }
}

async function deletePresenterPortrait() {
  if (!state.show?.id || !state.activePortrait || state.portraitBusy || state.audienceBusy) return;
  if (!globalThis.confirm('ลบรูป Photo Avatar ที่เลือกใช้จากรายการนี้ใช่หรือไม่?')) return;
  const showId = state.show.id;
  const item = state.activePortrait;
  const revision = state.portraitBindingRevision;
  const body = { portrait_id: item.id, expected_binding_revision: revision };
  state.portraitDeleteAttempt = mutationAttempt(state.portraitDeleteAttempt, 'portrait-delete', body);
  const attempt = state.portraitDeleteAttempt;
  const ticket = ++state.foundationTicket;
  state.foundationController?.abort();
  const controller = new AbortController();
  state.foundationController = controller;
  state.portraitBusy = true;
  syncFoundationControls();
  setStatus('#portraitStatus', 'กำลังถอนการเลือกและลบรูปส่วนตัว…');
  try {
    const data = await foundationRequest(`${API_ROOT}/shows/${showId}/presenter`, {
      method: 'DELETE',
      headers: { 'idempotency-key': attempt.key },
      body: JSON.stringify(body),
    }, controller.signal);
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    state.activePortrait = null;
    state.portraitBindingRevision = Number(data.binding_revision || revision + 1);
    state.portraitDeleteAttempt = null;
    state.portraitUploadAttempt = null;
    renderPortraitFoundation();
    setStatus('#portraitStatus', data.cleanup_pending
      ? 'ถอนการเลือกแล้ว · ไฟล์ส่วนตัวยังอยู่ในคิวลบแบบ retry ได้'
      : 'ถอนการเลือกและลบรูปส่วนตัวแล้ว', data.cleanup_pending ? '' : 'success');
  } catch (error) {
    if (error?.name !== 'AbortError' && ticket === state.foundationTicket) setStatus('#portraitStatus', error.message, 'error');
  } finally {
    if (ticket === state.foundationTicket) {
      state.portraitBusy = false;
      if (state.foundationController === controller) state.foundationController = null;
      syncFoundationControls();
    }
  }
}

async function startAudienceTest() {
  if (!state.show?.id || state.localSession || state.audienceBusy || state.portraitBusy || !state.integrationHealth?.local_test) return;
  const showId = state.show.id;
  const ticket = state.foundationTicket;
  const body = { action: 'start' };
  state.localSessionAttempt = mutationAttempt(state.localSessionAttempt, 'local-start', body);
  state.audienceBusy = true;
  syncFoundationControls();
  setStatus('#audienceStatus', 'กำลังเริ่ม LOCAL TEST…');
  try {
    const data = await foundationRequest(`${API_ROOT}/shows/${showId}/audience/local-session`, {
      method: 'POST', headers: { 'idempotency-key': state.localSessionAttempt.key }, body: JSON.stringify(body),
    });
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    state.localSession = data.session;
    state.localStopAttempt = null;
    state.audienceQueued = 0;
    state.audienceEventAttempt = null;
    renderAudienceFoundation();
    setStatus('#audienceStatus', `${data.session.source_label} · session พร้อมรับเหตุการณ์ทดสอบ`, 'success');
  } catch (error) {
    if (ticket === state.foundationTicket) setStatus('#audienceStatus', error.message, 'error');
  } finally {
    if (ticket === state.foundationTicket) { state.audienceBusy = false; syncFoundationControls(); }
  }
}

async function stopAudienceTest() {
  if (!state.show?.id || !state.localSession || state.audienceBusy || state.portraitBusy) return;
  const showId = state.show.id;
  const session = state.localSession;
  const ticket = state.foundationTicket;
  const body = { session_id: session.id };
  state.localStopAttempt = mutationAttempt(state.localStopAttempt, 'local-stop', body);
  state.audienceBusy = true;
  syncFoundationControls();
  setStatus('#audienceStatus', 'กำลังหยุดและล้างข้อมูล LOCAL TEST…');
  try {
    const data = await foundationRequest(`${API_ROOT}/shows/${showId}/audience/local-session`, {
      method: 'DELETE', headers: { 'idempotency-key': state.localStopAttempt.key }, body: JSON.stringify(body),
    });
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    audienceQueue.clear('session-stop');
    state.audienceQueued = 0;
    if (!data.cleanup_pending) {
      state.localSession = null;
      state.localSessionAttempt = null;
      state.localStopAttempt = null;
      state.audienceEventAttempt = null;
    }
    renderAudienceFoundation();
    setStatus('#audienceStatus', data.cleanup_pending
      ? 'หยุด session แล้ว · กดซ้ำเพื่อทำ cleanup ชุดถัดไป'
      : 'หยุดและล้างข้อมูลทดสอบแล้ว', data.cleanup_pending ? '' : 'success');
  } catch (error) {
    if (ticket === state.foundationTicket) setStatus('#audienceStatus', error.message, 'error');
  } finally {
    if (ticket === state.foundationTicket) { state.audienceBusy = false; syncFoundationControls(); }
  }
}

async function sendAudienceTest() {
  if (!state.show?.id || !state.localSession || state.audienceBusy || state.portraitBusy) return;
  const productId = Number($('#audienceProduct').value);
  if (!Number.isSafeInteger(productId) || !state.scenes.some(scene => scene.product_id === productId)) {
    setStatus('#audienceStatus', 'เลือกสินค้าที่อยู่ในรายการนี้ก่อน', 'error'); return;
  }
  const kind = $('#audienceEventKind').value;
  const question = kind === 'comment' ? $('#audienceQuestion').value.trim() : '';
  if (kind === 'comment' && !question) { setStatus('#audienceStatus', 'กรอกคำถามทดสอบก่อน', 'error'); return; }
  const showId = state.show.id;
  const ticket = state.foundationTicket;
  const eventBody = {
    session_id: state.localSession.id,
    kind,
    viewer_label: $('#audienceViewerLabel').value,
    question,
    product_id: productId,
  };
  const eventSignature = bodySignature(eventBody);
  if (state.audienceEventAttempt?.signature !== eventSignature) {
    state.audienceEventAttempt = { signature: eventSignature, eventId: `local.event.${crypto.randomUUID().replaceAll('-', '')}` };
  }
  const eventAttempt = state.audienceEventAttempt;
  state.audienceBusy = true;
  syncFoundationControls();
  try {
    const data = await foundationRequest(`${API_ROOT}/shows/${showId}/audience/local-events`, {
      method: 'POST',
      body: JSON.stringify({
        ...eventBody,
        event_id: eventAttempt.eventId,
      }),
    });
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    if (data.accepted && !data.replayed) state.audienceQueued = Math.min(24, state.audienceQueued + 1);
    state.audienceEventAttempt = null;
    renderAudienceFoundation();
    setStatus('#audienceStatus', data.accepted
      ? `${data.item.source_label} · เพิ่มเหตุการณ์เข้าคิวแล้ว`
      : 'คิวเต็ม เหตุการณ์ทดสอบนี้ถูกทิ้งและล้างข้อมูลระบุตัวตนแล้ว', data.accepted ? 'success' : '');
  } catch (error) {
    if (ticket === state.foundationTicket) setStatus('#audienceStatus', error.message, 'error');
  } finally {
    if (ticket === state.foundationTicket) { state.audienceBusy = false; syncFoundationControls(); }
  }
}

async function claimAudienceTest() {
  if (!state.show?.id || !state.localSession || state.audienceBusy || state.portraitBusy) return;
  const showId = state.show.id;
  const ticket = state.foundationTicket;
  state.audienceBusy = true;
  syncFoundationControls();
  setStatus('#audienceStatus', 'กำลังรับคำตอบทดสอบหนึ่งรายการ…');
  try {
    const data = await foundationRequest(`${API_ROOT}/shows/${showId}/audience/queue/claim`, {
      method: 'POST', body: JSON.stringify({ session_id: state.localSession.id }),
    });
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    if (!data.item) { setStatus('#audienceStatus', 'คิว LOCAL TEST ว่าง'); return; }
    const accepted = audienceQueue.enqueue(data.item);
    if (!accepted.accepted) throw new LiveCenterApiError('คำตอบจากคิวทดสอบซ้ำหรือไม่ถูกต้อง', { code: 'LIVE_AUDIENCE_RESPONSE_INVALID' });
    const event = audienceQueue.take();
    if (!event || event.id !== data.item.id) throw new LiveCenterApiError('ลำดับคิวทดสอบไม่ถูกต้อง', { code: 'LIVE_AUDIENCE_RESPONSE_INVALID' });
    const answer = $('#audienceTestAnswer');
    answer.querySelector('small').textContent = event.sourceLabel;
    answer.querySelector('p').textContent = event.text;
    answer.dataset.visible = 'true';
    answer.hidden = false;
    await foundationRequest(`${API_ROOT}/shows/${showId}/audience/queue/claim`, {
      method: 'DELETE',
      body: JSON.stringify({ session_id: state.localSession.id, event_id: event.id, claim_token: data.item.claim_token, outcome: 'consumed' }),
    });
    if (ticket !== state.foundationTicket || state.show?.id !== showId) return;
    audienceQueue.complete(event.id);
    state.audienceQueued = Math.max(0, state.audienceQueued - 1);
    renderAudienceFoundation();
    setStatus('#audienceStatus', 'แสดงคำตอบที่ grounded แล้วหนึ่งรายการ · ไม่มีการวนอัตโนมัติ', 'success');
  } catch (error) {
    if (ticket === state.foundationTicket) setStatus('#audienceStatus', error.message, 'error');
  } finally {
    if (ticket === state.foundationTicket) { state.audienceBusy = false; syncFoundationControls(); }
  }
}

function bind() {
  $('#newShow').addEventListener('click', () => freshShow());
  $('#showForm').addEventListener('submit', saveShow);
  $('#refreshShow').addEventListener('click', () => state.show?.id && openShow(state.show.id, { refresh: true }));
  $('#loadMoreShows').addEventListener('click', () => loadShows({ append: true }));
  $('#searchProducts').addEventListener('click', () => loadProducts());
  $('#productSearch').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadProducts(); } });
  $('#loadMoreProducts').addEventListener('click', () => loadProducts({ append: true }));
  $('#loadMoreVersions').addEventListener('click', () => loadVersions());
  $('#createVersion').addEventListener('click', createVersion);
  $('#presenterPortrait').addEventListener('change', () => {
    portraitPipeline?.cancel();
    state.portraitUploadAttempt = null;
    clearPortraitPreviewUrl();
    renderPortraitFoundation();
  });
  for (const selector of ['#presenterRightsConsent', '#presenterAnimationConsent', '#presenterAuthorizedAdult']) $(selector).addEventListener('change', syncFoundationControls);
  $('#uploadPresenterPortrait').addEventListener('click', uploadPresenterPortrait);
  $('#deletePresenterPortrait').addEventListener('click', deletePresenterPortrait);
  $('#presenterPortraitPreview').addEventListener('error', () => {
    $('#presenterPortraitPreview').hidden = true;
    $('#presenterPortraitPlaceholder').hidden = false;
    setStatus('#portraitStatus', 'โหลดตัวอย่างรูปส่วนตัวไม่สำเร็จ กรุณาตรวจสิทธิ์หรือโหลดใหม่', 'error');
  });
  const clearAudienceAttempt = () => { state.audienceEventAttempt = null; };
  $('#audienceEventKind').addEventListener('change', () => { clearAudienceAttempt(); syncFoundationControls(); });
  for (const selector of ['#audienceViewerLabel', '#audienceProduct', '#audienceQuestion']) $(selector).addEventListener('input', clearAudienceAttempt);
  $('#startAudienceTest').addEventListener('click', startAudienceTest);
  $('#stopAudienceTest').addEventListener('click', stopAudienceTest);
  $('#sendAudienceTest').addEventListener('click', sendAudienceTest);
  $('#claimAudienceTest').addEventListener('click', claimAudienceTest);
  for (const input of [$('#showTitle'), $('#showDescription'), $('#avatarPreset'), $('#outputProfile')]) input.addEventListener('input', markDirty);
  addEventListener('beforeunload', () => {
    stopLocalSessionInBackground(state.show?.id, state.localSession, state.localStopAttempt);
    state.foundationController?.abort();
    portraitPipeline?.cancel();
    clearPortraitPreviewUrl();
  });
}

async function initialize() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !['boss', 'admin'].includes(data.user?.role)) throw new Error('หน้านี้ใช้ได้เฉพาะ Boss และ Admin');
    state.viewer = `${data.user.id}:${data.user.role}`;
    store.setViewer(state.viewer);
    bind();
    freshShow();
    await Promise.all([loadShows(), loadProducts()]);
  } catch (error) {
    setStatus('#showStatus', error.message, 'error');
    document.querySelectorAll('button,input,textarea,select').forEach(control => { control.disabled = true; });
  }
}

if (typeof document !== 'undefined') initialize();
