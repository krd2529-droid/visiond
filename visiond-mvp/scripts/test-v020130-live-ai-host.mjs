import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import {
  buildLiveHostTurnProviderInput,
  generateLiveHostTurn,
  LIVE_HOST_MAX_CUE_CHARS,
  LIVE_HOST_MAX_RECENT_TURNS,
  LIVE_HOST_RATE_LIMIT,
  LIVE_HOST_TURN_PLAN_SCHEMA,
  renderLiveHostTurnPlan,
} from '../functions/_live_center.js';
import { onRequestPost as hostTurnRoute } from '../functions/api/admin/live-center/host-turn.js';
import { onRequest as middleware } from '../functions/_middleware.js';
import {
  createLiveAiHostController,
  createLiveAiSpeechNarrator,
  LIVE_HOST_CONTEXT_LIMIT,
  LiveAiHostError,
  requestLiveHostTurn,
} from '../public/live-package-ai-host.js';

const root = new URL('../', import.meta.url);
const read = relative => fs.readFileSync(new URL(relative, root));
const source = relative => read(relative).toString('utf8');
const sha256 = relative => createHash('sha256').update(read(relative)).digest('hex').toUpperCase();
const responseJson = async response => JSON.parse(await response.text());
const flush = async () => { await Promise.resolve(); await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

assert.equal(hostTurnRoute, generateLiveHostTurn, 'the thin host-turn route must use the authenticated shared handler');
assert.equal(sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'schema-v1 parser must stay byte-identical');
assert.equal(sha256('public/live-package-player.js'), '1EF48EB00CAC02ABF925F49618DABCF782C1D816A5BE0DF12289A416E3665D9C', 'offline local player must stay byte-identical');
assert.match(source('functions/_live_center.js'), /rateLimitIdentityAtomic\(ctx\.env,'live_center_host_turn'/);
assert.doesNotMatch(source('public/live-package-ai-host.js'), /scene\.script|\.script\b/, 'online controller must never read or send a saved package script');

class StatementMock {
  constructor(owner, sql, bindings = []) { this.owner = owner; this.sql = sql; this.bindings = bindings; }
  bind(...bindings) { return new StatementMock(this.owner, this.sql, bindings); }
  async first() { return this.owner.sqlite.prepare(this.sql).get(...this.bindings) || null; }
  async all() { return { success: true, results: this.owner.sqlite.prepare(this.sql).all(...this.bindings) }; }
  async run() {
    const result = this.owner.sqlite.prepare(this.sql).run(...this.bindings);
    return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid || 0) }, results: [] };
  }
}
class D1Mock {
  constructor(sqlite) { this.sqlite = sqlite; this.queries = []; }
  prepare(sql) { this.queries.push(String(sql)); return new StatementMock(this, String(sql)); }
}

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE security_rate_limits(rate_key TEXT PRIMARY KEY,hits INTEGER NOT NULL DEFAULT 0,window_start TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,blocked_until TEXT);
CREATE TABLE toys_center_products(id INTEGER PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',brand TEXT NOT NULL DEFAULT '',product_line TEXT NOT NULL DEFAULT '',series TEXT NOT NULL DEFAULT '',price_cents INTEGER NOT NULL,currency TEXT NOT NULL,quantity INTEGER NOT NULL,status TEXT NOT NULL,availability TEXT NOT NULL);
INSERT INTO users VALUES(7,'admin@example.test','admin','Admin','','admin','2026-01-01'),(8,'boss@example.test','boss','Boss','','boss','2026-01-01'),(9,'member@example.test','member','Member','','member','2026-01-01');
INSERT INTO sessions VALUES('admin-session',7,'2099-01-01'),('boss-session',8,'2099-01-01'),('member-session',9,'2099-01-01');
INSERT INTO toys_center_products VALUES
(101,'หุ่นยนต์ Alpha','ของเล่นประกอบ วัสดุ ABS รุ่น A1','VisionD Toys','Alpha Line','Alpha Series',12900,'THB',7,'published','in stock'),
(102,'ตุ๊กตา Beta','ตุ๊กตาสำหรับสะสม','VisionD Toys','Beta Line','Beta Series',25900,'THB',3,'published','in stock'),
(103,'สินค้าร่าง','ยังไม่พร้อมขาย','','','',9900,'THB',1,'draft','in stock');`);
const d1 = new D1Mock(sqlite);
const baseEnv = { DB: d1, ELON_GEMINI_API_KEY: 'HOST_PROVIDER_KEY_DO_NOT_LEAK', ELON_GEMINI_MODEL: 'gemini-2.5-flash' };
const makeCtx = ({ session = 'admin-session', body = { product_id: 101, recent_turns: [], operator_cue: 'เน้นข้อมูลหลัก' }, env = {} } = {}) => ({
  request: new Request('https://visiondonline.com/api/admin/live-center/host-turn', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(session ? { cookie: `vd_session=${session}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }),
  env: { ...baseEnv, ...env },
});
const productQueryCount = () => d1.queries.filter(sql => /FROM toys_center_products WHERE id=\?/.test(sql)).length;
const rateQueryCount = () => d1.queries.filter(sql => /INSERT INTO security_rate_limits/.test(sql)).length;
const groundedProduct = sqlite.prepare('SELECT * FROM toys_center_products WHERE id=101').get();
const hostInput = buildLiveHostTurnProviderInput(groundedProduct, [], 'เน้นข้อมูลหลัก');
const hostPlan = ids => JSON.stringify({ schema: LIVE_HOST_TURN_PLAN_SCHEMA, segment_ids: ids });
const baseIds = ['template.lead.focus', 'fact.name', 'fact.price_stock', 'template.close.review'];
const alternateIds = ['template.lead.detail', 'fact.name', 'fact.brand', 'fact.price_stock', 'template.close.follow'];
const basePlan = hostPlan(baseIds);
const baseTurn = renderLiveHostTurnPlan(basePlan, hostInput, groundedProduct);
assert.match(baseTurn, /หุ่นยนต์ Alpha/);
assert.match(baseTurn, /ราคา 129 บาท และมีสินค้า 7 ชิ้น/);

const providerCalls = [];
let providerMode = 'gemini';
let providerText = basePlan;
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const capturedErrors = [];
globalThis.fetch = async (url, options = {}) => {
  providerCalls.push({ url: String(url), headers: new Headers(options.headers), body: String(options.body || '') });
  if (providerMode === 'throw') throw new DOMException('timed out', 'TimeoutError');
  if (providerMode === '429') return new Response('{}', { status: 429 });
  if (providerMode === '500') return new Response('<html>provider detail</html>', { status: 500 });
  if (providerMode === 'malformed') return new Response('{', { status: 200, headers: { 'content-type': 'application/json' } });
  if (providerMode === 'openai') return new Response(JSON.stringify({ output_text: providerText, usage: { secret: 'raw-usage' } }), { status: 200, headers: { 'content-type': 'application/json' } });
  return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: providerText }] }, finishReason: 'STOP' }], usageMetadata: { secret: 'raw-usage' } }), { status: 200, headers: { 'content-type': 'application/json' } });
};
console.error = (...values) => capturedErrors.push(values.map(String).join(' '));

try {
  let beforeQueries = d1.queries.length;
  let beforeProvider = providerCalls.length;
  let response = await hostTurnRoute(makeCtx({ session: '' }));
  assert.equal(response.status, 401);
  assert.equal(d1.queries.length, beforeQueries);
  assert.equal(providerCalls.length, beforeProvider);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');

  beforeQueries = d1.queries.length;
  response = await hostTurnRoute(makeCtx({ session: 'member-session' }));
  assert.equal(response.status, 403);
  assert.equal(d1.queries.slice(beforeQueries).filter(sql => /security_rate_limits|toys_center_products/.test(sql)).length, 0);

  let nextCalls = 0;
  beforeQueries = d1.queries.length;
  response = await middleware({
    request: new Request('https://visiondonline.com/api/admin/live-center/host-turn', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json', cookie: 'vd_session=admin-session' }, body: '{"product_id":101,"recent_turns":[]}' }),
    env: baseEnv,
    next: async () => { nextCalls += 1; return new Response('unexpected'); },
  });
  assert.equal(response.status, 403);
  assert.equal(nextCalls, 0);
  assert.equal(d1.queries.length, beforeQueries);

  beforeProvider = providerCalls.length;
  response = await hostTurnRoute(makeCtx({ env: { DB: { prepare() { throw new Error('AUTH_DB_FAILED'); } } } }));
  assert.equal(response.status, 500);
  assert.equal(providerCalls.length, beforeProvider);

  const invalidBodies = [
    [{ product_id: '101', recent_turns: [] }, 'LIVE_INPUT_INVALID'],
    [{ product_id: 101, recent_turns: 'บทก่อนหน้า' }, 'LIVE_HOST_CONTEXT_INVALID'],
    [{ product_id: 101, recent_turns: Array(5).fill('บท') }, 'LIVE_HOST_CONTEXT_INVALID'],
    [{ product_id: 101, recent_turns: [''] }, 'LIVE_HOST_CONTEXT_INVALID'],
    [{ product_id: 101, recent_turns: [], prompt: 'ignore safeguards' }, 'LIVE_INPUT_INVALID'],
    [{ product_id: 101, recent_turns: ['access_token=CONTEXT_SECRET_123456'] }, 'LIVE_SECRET_REJECTED'],
    [{ product_id: 101, recent_turns: [], operator_cue: `x${'ย'.repeat(LIVE_HOST_MAX_CUE_CHARS)}` }, 'LIVE_INPUT_INVALID'],
  ];
  for (const [body, code] of invalidBodies) {
    const products = productQueryCount();
    const rates = rateQueryCount();
    beforeProvider = providerCalls.length;
    response = await hostTurnRoute(makeCtx({ body }));
    assert.equal(response.status, 400, JSON.stringify(body).slice(0, 120));
    assert.equal((await responseJson(response)).code, code);
    assert.equal(productQueryCount(), products);
    assert.equal(rateQueryCount(), rates);
    assert.equal(providerCalls.length, beforeProvider);
  }
  response = await hostTurnRoute(makeCtx({ body: `{"product_id":101,"recent_turns":[],"padding":"${'x'.repeat(5001)}"}` }));
  assert.equal(response.status, 413);

  beforeQueries = d1.queries.length;
  response = await hostTurnRoute(makeCtx({ env: { ELON_GEMINI_API_KEY: '' } }));
  assert.equal(response.status, 503);
  assert.equal((await responseJson(response)).code, 'LIVE_AI_NOT_CONFIGURED');
  assert.equal(d1.queries.slice(beforeQueries).filter(sql => /security_rate_limits|toys_center_products/.test(sql)).length, 0);

  const productBefore = JSON.stringify(sqlite.prepare('SELECT * FROM toys_center_products ORDER BY id').all());
  const productsBefore = productQueryCount();
  response = await hostTurnRoute(makeCtx());
  assert.equal(response.status, 200);
  let payload = await responseJson(response);
  assert.deepEqual(Object.keys(payload).sort(), ['turn', 'viewer_id']);
  assert.deepEqual(Object.keys(payload.turn).sort(), ['product', 'text']);
  assert.deepEqual(Object.keys(payload.turn.product).sort(), ['currency', 'id', 'price_minor', 'stock', 'title']);
  assert.equal(payload.viewer_id, 7);
  assert.equal(payload.turn.text, baseTurn);
  assert.deepEqual(payload.turn.product, { id: 101, title: 'หุ่นยนต์ Alpha', price_minor: 12900, currency: 'THB', stock: 7 });
  assert.equal(productQueryCount(), productsBefore + 1);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.doesNotMatch(JSON.stringify(payload), /HOST_PROVIDER_KEY|raw-usage|segment_ids|provider/i);
  assert.equal(JSON.stringify(sqlite.prepare('SELECT * FROM toys_center_products ORDER BY id').all()), productBefore);

  const providerCall = providerCalls.at(-1);
  const providerBody = JSON.parse(providerCall.body);
  const providerMessage = JSON.parse(providerBody.contents.at(-1).parts[0].text);
  assert.deepEqual(providerMessage.recent_turns, []);
  assert.equal(providerMessage.operator_cue, 'เน้นข้อมูลหลัก');
  assert.equal(providerBody.generationConfig.maxOutputTokens, 256);
  assert.equal(providerBody.generationConfig.responseMimeType, 'application/json');
  assert.equal(providerBody.generationConfig.thinkingConfig.thinkingBudget, 0);
  assert.equal(providerCall.headers.get('x-goog-api-key'), 'HOST_PROVIDER_KEY_DO_NOT_LEAK');

  providerText = hostPlan(alternateIds);
  response = await hostTurnRoute(makeCtx({ body: { product_id: 101, recent_turns: [baseTurn], operator_cue: 'เปลี่ยนจังหวะ' } }));
  assert.equal(response.status, 200);
  payload = await responseJson(response);
  assert.notEqual(payload.turn.text, baseTurn);
  assert.match(payload.turn.text, /หุ่นยนต์ Alpha/);
  assert.match(payload.turn.text, /ราคา 129 บาท และมีสินค้า 7 ชิ้น/);
  const variationMessage = JSON.parse(JSON.parse(providerCalls.at(-1).body).contents.at(-1).parts[0].text);
  assert.deepEqual(variationMessage.recent_turns, [baseTurn]);
  assert.equal(variationMessage.operator_cue, 'เปลี่ยนจังหวะ');

  providerText = basePlan;
  response = await hostTurnRoute(makeCtx({ body: { product_id: 101, recent_turns: [baseTurn] } }));
  assert.equal(response.status, 502);
  assert.equal((await responseJson(response)).code, 'LIVE_AI_TURN_REPEATED');

  const unsafePlans = [
    'ลด 50% ส่งฟรี',
    `\`\`\`${basePlan}\`\`\``,
    '{',
    JSON.stringify({ schema: LIVE_HOST_TURN_PLAN_SCHEMA, segment_ids: baseIds, discount: 50 }),
    hostPlan(['template.lead.focus', 'fact.name', 'fact.price_stock', 'fact.unknown']),
    hostPlan(['template.lead.focus', 'template.lead.detail', 'fact.name', 'fact.price_stock']),
    hostPlan(['template.lead.focus', 'fact.name', 'fact.name', 'fact.price_stock']),
    hostPlan(['fact.name', 'fact.price_stock']),
  ];
  for (const unsafe of unsafePlans) {
    providerText = unsafe;
    response = await hostTurnRoute(makeCtx());
    assert.equal(response.status, 502, unsafe.slice(0, 100));
    assert.equal((await responseJson(response)).code, 'LIVE_AI_OUTPUT_INVALID');
  }

  providerText = basePlan;
  beforeProvider = providerCalls.length;
  response = await hostTurnRoute(makeCtx({ body: { product_id: 103, recent_turns: [] } }));
  assert.equal(response.status, 409);
  assert.equal((await responseJson(response)).code, 'LIVE_PRODUCT_UNAVAILABLE');
  assert.equal(providerCalls.length, beforeProvider);

  for (const [mode, status, code] of [['throw', 504, 'LIVE_AI_TIMEOUT'], ['429', 429, 'LIVE_AI_PROVIDER_RATE_LIMIT'], ['500', 502, 'LIVE_AI_PROVIDER_FAILED'], ['malformed', 502, 'LIVE_AI_PROVIDER_FAILED']]) {
    providerMode = mode;
    response = await hostTurnRoute(makeCtx());
    assert.equal(response.status, status);
    payload = await responseJson(response);
    assert.equal(payload.code, code);
    assert.doesNotMatch(JSON.stringify(payload), /provider detail|HOST_PROVIDER_KEY|raw-usage/i);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  }

  providerMode = 'openai';
  providerText = basePlan;
  response = await hostTurnRoute(makeCtx({ env: { ELON_GEMINI_API_KEY: '', ELON_OPENAI_API_KEY: 'OPENAI_HOST_KEY' } }));
  assert.equal(response.status, 200);
  assert.equal((await responseJson(response)).turn.text, baseTurn);
  assert.match(providerCalls.at(-1).url, /api\.openai\.com\/v1\/responses/);

  providerMode = 'gemini';
  sqlite.exec('DELETE FROM security_rate_limits');
  d1.queries.length = 0;
  const beforeBurstCalls = providerCalls.length;
  const burst = await Promise.all(Array.from({ length: LIVE_HOST_RATE_LIMIT + 1 }, () => hostTurnRoute(makeCtx())));
  assert.equal(burst.filter(item => item.status === 200).length, LIVE_HOST_RATE_LIMIT);
  assert.equal(burst.filter(item => item.status === 429).length, 1);
  assert.equal(burst.find(item => item.status === 429).headers.get('retry-after'), '900');
  assert.equal(providerCalls.length - beforeBurstCalls, LIVE_HOST_RATE_LIMIT);
  assert.equal(productQueryCount(), LIVE_HOST_RATE_LIMIT);
  assert.equal(rateQueryCount(), LIVE_HOST_RATE_LIMIT + 1);
  assert.equal(d1.queries.filter(sql => /SELECT .*security_rate_limits/i.test(sql)).length, 0);
  const rateRow = sqlite.prepare('SELECT rate_key,hits FROM security_rate_limits').get();
  assert.match(rateRow.rate_key, /^live_center_host_turn:identity:[a-f0-9]{32}$/);
  assert.equal(rateRow.hits, LIVE_HOST_RATE_LIMIT + 1);
  response = await hostTurnRoute(makeCtx({ session: 'boss-session' }));
  assert.equal(response.status, 200);
  assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM security_rate_limits').get().count, 2);

  const queryPlan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT id,title,description,brand,product_line,series,price_cents,currency,quantity FROM toys_center_products WHERE id=? AND status='published' AND availability='in stock' AND quantity>0 LIMIT 1").all(101).map(row => row.detail).join(' | ');
  assert.match(queryPlan, /SEARCH toys_center_products USING INTEGER PRIMARY KEY/);
  assert.doesNotMatch(queryPlan, /\bSCAN\b|TEMP B-TREE/);
  assert.doesNotMatch(capturedErrors.join('\n'), /HOST_PROVIDER_KEY|OPENAI_HOST_KEY|raw-usage|CONTEXT_SECRET/);
} finally {
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
}

const scenes = [101, 102, 103].map((id, position) => ({
  position,
  product: { id, title: `แพ็กเกจสินค้า ${id}`, price_minor: id * 100, currency: 'THB', stock: position + 1 },
  script: `SAVED_OFFLINE_SCRIPT_${id}`,
  cue: { transition: position === 1 ? 'fade' : 'cut' },
}));
const liveTurn = (id, suffix) => ({ text: `บทสด ${id} ${suffix}`, product: { id, title: `สินค้าสด ${id}`, price_minor: id * 100, currency: 'THB', stock: id - 90 } });

function controllerHarness({ narratorStatus = 'thai', cancelEndsSpeech = false, autoStart = true, requestImpl = null } = {}) {
  const calls = [];
  const utterances = [];
  const events = [];
  let cancellations = 0;
  let maxConcurrent = 0;
  const requestTurn = requestImpl || (args => {
    const pending = deferred();
    const call = { ...args, pending, settled: false };
    calls.push(call);
    maxConcurrent = Math.max(maxConcurrent, calls.filter(item => !item.settled && !item.signal.aborted).length);
    pending.promise.finally(() => { call.settled = true; }).catch(() => {});
    return pending.promise;
  });
  const narrator = {
    cancel() {
      cancellations += 1;
      const current = utterances.at(-1);
      if (cancelEndsSpeech) current?.handlers.onEnd();
    },
    speak(text, handlers) {
      events.push(`speak:${text}`);
      if (narratorStatus === 'throw') throw new Error('TTS constructor failed');
      utterances.push({ text, handlers });
      if (autoStart && ['thai', 'default'].includes(narratorStatus)) handlers.onStart();
      return narratorStatus;
    },
  };
  const controller = createLiveAiHostController(scenes, {
    requestTurn,
    narrator,
    onProduct: event => events.push(`product:${event.product.id}:${event.reason}`),
    onTurn: event => events.push(`caption:${event.text}`),
    onState: event => events.push(`state:${event.phase}:${event.reason}`),
    onNarration: event => events.push(`narration:${event.status}`),
  });
  return { calls, utterances, events, controller, get cancellations() { return cancellations; }, get maxConcurrent() { return maxConcurrent; } };
}

{
  const harness = controllerHarness();
  const { controller, calls, utterances, events } = harness;
  assert.equal(controller.snapshot().phase, 'ready');
  assert.equal(calls.length, 0, 'valid package open does not contact the host endpoint');
  assert.equal(utterances.length, 0, 'AI host never autoplays');
  controller.setOperatorCue('เล่าแบบกระชับ');
  controller.start();
  controller.start();
  await flush();
  assert.equal(calls.length, 1, 'double Start creates one request');
  assert.deepEqual(Object.keys(calls[0]).filter(key => !['pending', 'settled'].includes(key)).sort(), ['operatorCue', 'productId', 'recentTurns', 'signal']);
  assert.equal(calls[0].productId, 101);
  assert.deepEqual(calls[0].recentTurns, []);
  assert.equal(calls[0].operatorCue, 'เล่าแบบกระชับ');
  assert.equal(JSON.stringify(calls[0]).includes('SAVED_OFFLINE_SCRIPT'), false);
  calls[0].pending.resolve(liveTurn(101, 'หนึ่ง'));
  await flush();
  assert.equal(utterances.length, 1);
  assert.ok(events.indexOf('caption:บทสด 101 หนึ่ง') < events.indexOf('speak:บทสด 101 หนึ่ง'), 'caption renders before Web Speech starts');
  assert.equal(controller.snapshot().phase, 'speaking');
  assert.equal(controller.snapshot().caption, 'บทสด 101 หนึ่ง');
  assert.deepEqual(controller.snapshot().product, liveTurn(101, 'หนึ่ง').product);
  assert.equal(calls.length, 2, 'speaking starts exactly one prefetch');
  assert.deepEqual(calls[1].recentTurns, ['บทสด 101 หนึ่ง']);
  controller.start();
  controller.setOperatorCue('คิวถัดไป');
  assert.equal(calls.length, 2, 'UI events do not duplicate a held prefetch');
  calls[1].pending.resolve(liveTurn(101, 'สอง'));
  await flush();
  assert.equal(controller.snapshot().hasPrefetch, true);
  const firstEnd = utterances[0].handlers.onEnd;
  firstEnd();
  firstEnd();
  await flush();
  assert.deepEqual(utterances.map(item => item.text), ['บทสด 101 หนึ่ง', 'บทสด 101 สอง']);
  assert.equal(calls.length, 3, 'prefetch is consumed once and replenished once');
  assert.equal(harness.maxConcurrent, 1);

  const staleSecondEnd = utterances[1].handlers.onEnd;
  controller.pause();
  assert.equal(controller.snapshot().phase, 'paused');
  assert.equal(controller.snapshot().productId, 101);
  assert.equal(calls[2].signal.aborted, true);
  const callsAtPause = calls.length;
  staleSecondEnd();
  utterances[1].handlers.onError({ error: 'cancelled' });
  calls[2].pending.resolve(liveTurn(101, 'เก่า'));
  await flush();
  assert.equal(calls.length, callsAtPause);
  assert.notEqual(controller.snapshot().caption, 'บทสด 101 เก่า');
  controller.start();
  await flush();
  assert.equal(calls.length, callsAtPause + 1, 'resume creates one fresh request');
  assert.deepEqual(calls.at(-1).recentTurns, ['บทสด 101 หนึ่ง', 'บทสด 101 สอง']);
  calls.at(-1).pending.resolve(liveTurn(101, 'สาม'));
  await flush();
  const oldSpeech = utterances.at(-1);
  const oldPrefetch = calls.at(-1);
  assert.equal(oldPrefetch.productId, 101);
  controller.skip();
  await flush();
  assert.equal(controller.snapshot().productId, 102);
  assert.equal(oldPrefetch.signal.aborted, true);
  assert.equal(calls.at(-1).productId, 102);
  assert.deepEqual(calls.at(-1).recentTurns, [], 'history is isolated per product');
  oldPrefetch.pending.resolve(liveTurn(101, 'ล่าช้า'));
  oldSpeech.handlers.onEnd();
  await flush();
  assert.notEqual(controller.snapshot().caption, 'บทสด 101 ล่าช้า');
  calls.at(-1).pending.resolve(liveTurn(102, 'หนึ่ง'));
  await flush();
  assert.equal(controller.snapshot().caption, 'บทสด 102 หนึ่ง');
  controller.skip();
  await flush();
  assert.equal(controller.snapshot().productId, 103);
  const finalRequest = calls.at(-1);
  finalRequest.pending.resolve(liveTurn(103, 'หนึ่ง'));
  await flush();
  const requestsBeforeBoundary = calls.length;
  const cancelsBeforeBoundary = harness.cancellations;
  controller.skip();
  assert.equal(controller.snapshot().productId, 103, 'loop-off final product keeps selling');
  assert.equal(calls.length, requestsBeforeBoundary);
  assert.equal(harness.cancellations, cancelsBeforeBoundary, 'boundary no-op happens before cancellation');
  controller.setLoopProducts(true);
  controller.skip();
  await flush();
  assert.equal(controller.snapshot().productId, 101, 'explicit loop wraps exactly once');
  assert.equal(calls.at(-1).productId, 101);
  controller.stop();
  assert.equal(controller.snapshot().phase, 'stopped');
  assert.equal(calls.at(-1).signal.aborted, true);
  const stoppedCalls = calls.length;
  await flush();
  assert.equal(calls.length, stoppedCalls);
  controller.destroy();
}

{
  let attempts = 0;
  const auth = controllerHarness({ requestImpl: async () => { attempts += 1; throw new LiveAiHostError('กรุณาเข้าสู่ระบบใหม่', 'LIVE_HOST_AUTH_REQUIRED', 401); } });
  auth.controller.start();
  await flush();
  assert.equal(auth.controller.snapshot().phase, 'error');
  assert.equal(auth.controller.snapshot().error.status, 401);
  await flush();
  assert.equal(attempts, 1, 'auth failure has no timer retry');
  auth.controller.retry();
  await flush();
  assert.equal(attempts, 2, 'Retry is explicit and singular');
  auth.controller.destroy();
}

{
  let attempts = 0;
  const unexpectedAbort = controllerHarness({ requestImpl: async () => { attempts += 1; throw new DOMException('transport interrupted', 'AbortError'); } });
  unexpectedAbort.controller.start();
  await flush();
  assert.equal(attempts, 1);
  assert.equal(unexpectedAbort.controller.snapshot().phase, 'error', 'an active AbortError not caused by our signal must not strand generating');
  assert.equal(unexpectedAbort.controller.snapshot().requestPending, false);
  unexpectedAbort.controller.retry();
  await flush();
  assert.equal(attempts, 2);
  unexpectedAbort.controller.destroy();
}

for (const narratorStatus of ['unavailable', 'throw']) {
  const harness = controllerHarness({ narratorStatus });
  harness.controller.start();
  await flush();
  harness.calls[0].pending.resolve(liveTurn(101, narratorStatus));
  await flush();
  assert.equal(harness.controller.snapshot().phase, 'error');
  assert.equal(harness.controller.snapshot().caption, `บทสด 101 ${narratorStatus}`);
  assert.equal(harness.calls.length, 1, 'TTS failure cannot create a tight prefetch loop');
  harness.controller.destroy();
}

{
  const harness = controllerHarness({ cancelEndsSpeech: true });
  harness.controller.start();
  await flush();
  harness.calls[0].pending.resolve(liveTurn(101, 'cancel-onend'));
  await flush();
  const count = harness.calls.length;
  harness.controller.pause();
  await flush();
  assert.equal(harness.controller.snapshot().phase, 'paused');
  assert.equal(harness.calls.length, count, 'cancel-triggered onend is neutralized before speech cancellation');
  harness.controller.destroy();
}

{
  const queued = controllerHarness({ autoStart: false });
  queued.controller.start();
  await flush();
  queued.calls[0].pending.resolve(liveTurn(101, 'รอ onstart'));
  await flush();
  assert.equal(queued.controller.snapshot().phase, 'speaking');
  assert.equal(queued.controller.snapshot().speechStatus, 'starting');
  assert.equal(queued.calls.length, 1, 'queued-but-not-started speech cannot prefetch');
  assert.equal(queued.events.some(event => event.startsWith('narration:')), false);
  queued.utterances[0].handlers.onStart();
  queued.utterances[0].handlers.onStart();
  await flush();
  assert.equal(queued.controller.snapshot().speechStatus, 'thai');
  assert.equal(queued.events.filter(event => event === 'narration:thai').length, 1, 'duplicate onstart is consumed once');
  assert.equal(queued.calls.length, 2, 'prefetch starts only after genuine speech onstart');
  queued.controller.destroy();
}

{
  const stale = controllerHarness({ autoStart: false });
  stale.controller.start();
  await flush();
  stale.calls[0].pending.resolve(liveTurn(101, 'พักก่อนเริ่ม'));
  await flush();
  const pausedStart = stale.utterances[0].handlers.onStart;
  stale.controller.pause();
  pausedStart();
  assert.equal(stale.controller.snapshot().phase, 'paused');
  assert.equal(stale.events.some(event => event.startsWith('narration:')), false, 'late onstart after pause is stale');
  stale.controller.start();
  await flush();
  stale.calls.at(-1).pending.resolve(liveTurn(101, 'error ก่อนเริ่ม'));
  await flush();
  const failedSpeech = stale.utterances.at(-1);
  failedSpeech.handlers.onError({ error: 'synthetic-before-start' });
  failedSpeech.handlers.onStart();
  assert.equal(stale.controller.snapshot().phase, 'error');
  assert.equal(stale.events.some(event => event === 'narration:thai'), false, 'onerror-before-onstart never starts narration');
  stale.controller.destroy();
}

{
  const stopped = controllerHarness({ autoStart: false });
  stopped.controller.start();
  await flush();
  stopped.calls[0].pending.resolve(liveTurn(101, 'หยุดก่อนเริ่ม'));
  await flush();
  const stoppedStart = stopped.utterances[0].handlers.onStart;
  stopped.controller.stop();
  stoppedStart();
  assert.equal(stopped.controller.snapshot().phase, 'stopped');
  assert.equal(stopped.events.some(event => event.startsWith('narration:')), false, 'late onstart after stop is stale');
  stopped.controller.destroy();

  const ended = controllerHarness({ autoStart: false });
  ended.controller.start();
  await flush();
  ended.calls[0].pending.resolve(liveTurn(101, 'จบก่อนเริ่ม'));
  await flush();
  ended.utterances[0].handlers.onEnd();
  assert.equal(ended.controller.snapshot().phase, 'error', 'onend-before-onstart fails visibly instead of looping silently');
  assert.equal(ended.calls.length, 1);
  ended.controller.destroy();
}

{
  const first = controllerHarness();
  first.controller.start();
  await flush();
  const pendingA = first.calls[0];
  first.controller.destroy();
  const second = controllerHarness();
  pendingA.pending.resolve(liveTurn(101, 'จากแพ็กเกจเก่า'));
  await flush();
  assert.equal(first.utterances.length, 0);
  assert.equal(second.calls.length, 0, 'valid reopen remains explicit-click and old work cannot revive it');
  second.controller.destroy();
}

{
  const requests = [];
  const result = await requestLiveHostTurn({ productId: 101, recentTurns: ['บทสดหนึ่ง'], operatorCue: 'คิวสั้น', signal: new AbortController().signal }, { fetchImpl: async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return new Response(JSON.stringify({ viewer_id: 7, turn: liveTurn(101, 'ผ่าน transport') }), { headers: { 'content-type': 'application/json' } });
  } });
  assert.equal(result.text, 'บทสด 101 ผ่าน transport');
  assert.equal(requests[0].url, '/api/admin/live-center/host-turn');
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.equal(requests[0].options.cache, 'no-store');
  assert.deepEqual(requests[0].body, { product_id: 101, recent_turns: ['บทสดหนึ่ง'], operator_cue: 'คิวสั้น' });
  await assert.rejects(requestLiveHostTurn({ productId: 101, recentTurns: [], signal: new AbortController().signal }, { fetchImpl: async () => new Response('<html>secret upstream</html>', { status: 502 }) }), error => error.code === 'LIVE_HOST_TRANSPORT_FAILED' && !/secret upstream|HTML|502/i.test(error.message));
}

{
  assert.equal(createLiveAiSpeechNarrator({}).speak('บทสด'), 'unavailable');
  const utterances = [];
  let cancellations = 0;
  class Utterance { constructor(text) { this.text = text; } }
  const narrator = createLiveAiSpeechNarrator({ SpeechSynthesisUtterance: Utterance, speechSynthesis: { getVoices: () => [{ lang: 'th-TH', name: 'Thai' }], speak: value => utterances.push(value), cancel: () => { cancellations += 1; } } });
  let ended = 0;
  let started = 0;
  assert.equal(narrator.speak('บทสดภาษาไทย', { onStart: () => { started += 1; }, onEnd: () => { ended += 1; } }), 'thai');
  assert.equal(utterances[0].lang, 'th-TH');
  utterances[0].onstart();
  assert.equal(started, 1);
  narrator.cancel();
  utterances[0].onstart();
  utterances[0].onend();
  assert.equal(started, 1, 'late onstart after cancel is detached');
  assert.equal(ended, 0, 'late onend after cancel is detached');
  assert.equal(cancellations, 1);
}

assert.equal(LIVE_HOST_CONTEXT_LIMIT, LIVE_HOST_MAX_RECENT_TURNS);
console.log('v0.20.130 private grounded host-turn server and deterministic abort/prefetch/TTS client tests passed');
