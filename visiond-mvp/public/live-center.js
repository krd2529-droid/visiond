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
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new LiveCenterApiError(payload.error || `HTTP ${response.status}`, {
          status: response.status,
          code: payload.code || '',
          payload,
        });
      }
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
  productTicket: 0,
  showListTicket: 0,
  versionTicket: 0,
  saveBusy: null,
  versionBusy: null,
};

const store = typeof fetch === 'function' ? createLiveCenterStore() : null;
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
const mutationAttempt = (current, prefix, body) => {
  const signature = bodySignature(body);
  return current?.signature === signature ? current : { signature, key: liveIdempotencyKey(prefix) };
};

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

function renderShows() {
  const list = $('#showList');
  list.replaceChildren();
  for (const show of state.shows) {
    const button = element('button', 'show-row');
    button.type = 'button';
    button.setAttribute('aria-current', String(show.id === state.show?.id));
    const copy = element('div');
    copy.append(element('h3', '', show.title), element('p', '', `${show.scene_count} ฉาก · revision ${show.revision}`));
    button.append(copy, element('small', '', dateTime(show.updated_at)));
    button.addEventListener('click', () => openShow(show.id));
    list.append(button);
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

function freshShow() {
  state.openTicket += 1;
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

function hydrateShow(item) {
  state.show = item;
  state.scenes = item.scenes.map(scene => ({
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
  const ticket = ++state.openTicket;
  setStatus('#showStatus', 'กำลังเปิดรายการ…');
  try {
    if (refresh) store.invalidate([`show:${id}`]);
    const data = await store.request(`${API_ROOT}/shows/${id}`, {}, { tags: [`show:${id}`] });
    if (ticket !== state.openTicket) return;
    hydrateShow(data.item);
    setStatus('#showStatus', 'โหลดรายการแล้ว', 'success');
    await loadVersions({ reset: true, ticket });
  } catch (error) {
    if (ticket === state.openTicket) setStatus('#showStatus', error.message, 'error');
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
  const operationTicket = ++state.openTicket;
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
      await loadVersions({ reset: true, ticket: operationTicket });
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
  state.scenes.push({
    product_id: product.id,
    product,
    script: '',
    cue: { label: '', duration_seconds: 60, transition: 'cut' },
  });
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
    const scriptLabel = element('label', 'vds-field script-field', 'บทพูด');
    const script = element('textarea');
    script.rows = 4;
    script.maxLength = 12000;
    script.value = scene.script;
    script.addEventListener('input', () => { scene.script = script.value; markDirty(); });
    scriptLabel.append(script);
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
    fields.append(scriptLabel, cueLabel, durationLabel, transitionLabel, actions);
    row.append(product, fields);
    list.append(row);
  });
  if (!state.scenes.length) list.append(element('p', 'empty', 'ยังไม่มีฉาก เลือกสินค้าด้านบนได้เลย'));
  updateActionState();
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
  const operationTicket = ++state.openTicket;
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

function bind() {
  $('#newShow').addEventListener('click', freshShow);
  $('#showForm').addEventListener('submit', saveShow);
  $('#refreshShow').addEventListener('click', () => state.show?.id && openShow(state.show.id, { refresh: true }));
  $('#loadMoreShows').addEventListener('click', () => loadShows({ append: true }));
  $('#searchProducts').addEventListener('click', () => loadProducts());
  $('#productSearch').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); loadProducts(); } });
  $('#loadMoreProducts').addEventListener('click', () => loadProducts({ append: true }));
  $('#loadMoreVersions').addEventListener('click', () => loadVersions());
  $('#createVersion').addEventListener('click', createVersion);
  for (const input of [$('#showTitle'), $('#showDescription'), $('#avatarPreset'), $('#outputProfile')]) input.addEventListener('input', markDirty);
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
