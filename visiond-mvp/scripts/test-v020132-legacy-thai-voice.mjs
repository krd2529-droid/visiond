import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createLiveAiHostController, createLiveAiSpeechNarrator } from '../public/live-package-ai-host.js';
import { createLocalLivePlayer, createLocalSpeechNarrator } from '../public/live-package-player.js';
import * as presenterModule from '../public/live-package-presenter.js';
import { THAI_VOICE_MISSING_MESSAGE } from '../public/live-package-thai-speech.js';

const root = new URL('../', import.meta.url);
const text = path => readFile(new URL(path, root), 'utf8');

class FakeUtterance {
  constructor(value) {
    this.text = String(value);
    this.lang = '';
    this.voice = null;
  }
}

function voiceScope(initialVoices = []) {
  let voices = [...initialVoices];
  const listeners = new Set();
  const spoken = [];
  let cancellations = 0;
  const synthesis = {
    getVoices: () => [...voices],
    speak: utterance => spoken.push(utterance),
    cancel: () => { cancellations += 1; },
    addEventListener(type, listener) { if (type === 'voiceschanged') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'voiceschanged') listeners.delete(listener); },
  };
  return {
    scope: { SpeechSynthesisUtterance: FakeUtterance, speechSynthesis: synthesis },
    spoken,
    setVoices(next) {
      voices = [...next];
      for (const listener of [...listeners]) listener();
    },
    get listenerCount() { return listeners.size; },
    get cancellations() { return cancellations; },
  };
}

const flush = async (count = 8) => {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
};

const scenes = [
  { position: 0, script: 'บทฉากหนึ่ง', cue: { duration_seconds: 8 }, product: { id: 101, title: 'สินค้า 101', price_minor: 10100, currency: 'THB', stock: 9 } },
  { position: 1, script: 'บทฉากสอง', cue: { duration_seconds: 8 }, product: { id: 202, title: 'สินค้า 202', price_minor: 20200, currency: 'THB', stock: 8 } },
];

const turnFor = productId => ({
  text: `บทสดสินค้า ${productId}`,
  product: { id: productId, title: `สินค้าสด ${productId}`, price_minor: productId * 100, currency: 'THB', stock: 7 },
});

const createPlayback = () => {
  let position = 0;
  return {
    sceneCount: scenes.length,
    currentScene: () => scenes[position],
    currentAsset: () => null,
    next: () => { position = Math.min(scenes.length - 1, position + 1); },
    previous: () => { position = Math.max(0, position - 1); },
    reset: () => { position = 0; },
  };
};

const openerSource = await text('public/live-package-open.js');
const legacyPreset = typeof presenterModule.resolveLiveAiPresenterPreset === 'function'
  ? presenterModule.resolveLiveAiPresenterPreset('none')
  : 'missing';

const localMissing = voiceScope([{ name: 'English only', lang: 'en-US' }]);
const localMissingStatus = await createLocalSpeechNarrator(localMissing.scope, { voiceWaitMs: 25 }).speak('บทบันทึกภาษาไทย');

const localLate = voiceScope([]);
const localLateNarrator = createLocalSpeechNarrator(localLate.scope, { voiceWaitMs: 100 });
const localLatePromise = localLateNarrator.speak('บทที่รอรายการเสียง');
await Promise.resolve();
const localLateBefore = localLate.spoken.length;
const preferredThai = { name: 'Thai Thailand', lang: 'th-TH' };
localLate.setVoices([{ name: 'Thai generic', lang: 'th' }, preferredThai]);
const localLateStatus = await localLatePromise;

const localCancelled = voiceScope([]);
const localCancelledNarrator = createLocalSpeechNarrator(localCancelled.scope, { voiceWaitMs: 100 });
const localCancelledPromise = localCancelledNarrator.speak('บทที่ต้องถูกยกเลิก');
await Promise.resolve();
localCancelledNarrator.cancel();
const localCancelledStatus = await localCancelledPromise;

const aiMissing = voiceScope([{ name: 'English only', lang: 'en-GB' }]);
const aiMissingStatus = await createLiveAiSpeechNarrator(aiMissing.scope, { voiceWaitMs: 25 }).speak('บท AI ภาษาไทย');

const genericThai = { name: 'Thai generic fallback', lang: 'th' };
const localGeneric = voiceScope([{ name: 'English first', lang: 'en-US' }, genericThai]);
assert.equal(await createLocalSpeechNarrator(localGeneric.scope).speak('บทเสียงไทยทั่วไป'), 'thai');
assert.equal(localGeneric.spoken[0]?.voice, genericThai, 'generic th is allowed only when exact th-TH is absent');

const timedOut = voiceScope([]);
assert.equal(await createLocalSpeechNarrator(timedOut.scope, { voiceWaitMs: 0 }).speak('บทไม่มีรายการเสียง'), 'thai-unavailable');
assert.equal(timedOut.listenerCount, 0, 'voice discovery timeout removes its voiceschanged listener');
assert.equal(timedOut.spoken.length, 0);

const localRaceVoices = voiceScope([]);
const localNarration = [];
const localPlayer = createLocalLivePlayer(createPlayback(), {
  narrator: createLocalSpeechNarrator(localRaceVoices.scope, { voiceWaitMs: 100 }),
  onNarration: value => localNarration.push(value),
});
localPlayer.start();
await flush();
assert.equal(localRaceVoices.listenerCount, 1, 'offline playback waits for async voices');
localPlayer.stop();
assert.equal(localRaceVoices.listenerCount, 0, 'offline Stop cancels pending voice discovery');
localRaceVoices.setVoices([preferredThai]);
await flush();
assert.equal(localRaceVoices.spoken.length, 0, 'a late voice event after offline Stop cannot speak');
localPlayer.destroy();

const manualRaceVoices = voiceScope([]);
const manualPlayer = createLocalLivePlayer(createPlayback(), {
  narrator: createLocalSpeechNarrator(manualRaceVoices.scope, { voiceWaitMs: 100 }),
});
manualPlayer.start();
await flush();
manualPlayer.navigate(1);
assert.equal(manualRaceVoices.listenerCount, 1, 'manual navigation replaces discovery with one listener for the new scene');
manualRaceVoices.setVoices([preferredThai]);
await flush();
assert.deepEqual(manualRaceVoices.spoken.map(item => item.text), ['บทฉากสอง'], 'stale discovery cannot narrate the old scene');
manualPlayer.destroy();

const aiLate = voiceScope([]);
const aiLateRequests = [];
const aiLateNarration = [];
const aiLateController = createLiveAiHostController(scenes, {
  narrator: createLiveAiSpeechNarrator(aiLate.scope, { voiceWaitMs: 100 }),
  requestTurn: async ({ productId }) => {
    aiLateRequests.push(productId);
    return turnFor(productId);
  },
  onNarration: value => aiLateNarration.push(value),
});
aiLateController.start();
await flush();
assert.equal(aiLateController.snapshot().speechStatus, 'voice-loading');
assert.equal(aiLate.spoken.length, 0, 'AI cannot queue speech while Chrome voice discovery is pending');
assert.deepEqual(aiLateRequests, [101], 'AI does not prefetch before genuine Thai speech starts');
aiLate.setVoices([genericThai, preferredThai]);
await flush();
assert.equal(aiLate.spoken.length, 1);
assert.equal(aiLate.spoken[0].voice, preferredThai, 'AI prefers exact th-TH independent of browser voice ordering');
assert.equal(aiLateController.snapshot().speechStatus, 'starting');
assert.deepEqual(aiLateRequests, [101], 'queuing a Thai utterance still does not prefetch');
aiLate.spoken[0].onstart?.();
await flush();
assert.equal(aiLateController.snapshot().speechStatus, 'thai');
assert.equal(aiLateNarration.length, 1, 'genuine utterance.onstart is the only AI presenter narration boundary');
assert.deepEqual(aiLateRequests, [101, 101], 'exactly one prefetch begins after genuine Thai onstart');
aiLateController.stop();

const aiNoThai = voiceScope([{ name: 'English system default', lang: 'en-US' }]);
const aiNoThaiRequests = [];
const aiNoThaiController = createLiveAiHostController(scenes, {
  narrator: createLiveAiSpeechNarrator(aiNoThai.scope),
  requestTurn: async ({ productId }) => {
    aiNoThaiRequests.push(productId);
    return turnFor(productId);
  },
});
aiNoThaiController.start();
await flush();
assert.equal(aiNoThaiController.snapshot().phase, 'error');
assert.equal(aiNoThaiController.snapshot().error?.code, 'LIVE_HOST_THAI_VOICE_MISSING');
assert.equal(aiNoThaiController.snapshot().error?.message, THAI_VOICE_MISSING_MESSAGE);
assert.equal(aiNoThai.spoken.length, 0, 'English-only AI never queues Web Speech');
assert.deepEqual(aiNoThaiRequests, [101], 'English-only AI cannot launch a prefetch');
aiNoThaiController.destroy();

for (const action of ['pause', 'stop', 'destroy']) {
  const pending = voiceScope([]);
  const pendingRequests = [];
  const controller = createLiveAiHostController(scenes, {
    narrator: createLiveAiSpeechNarrator(pending.scope, { voiceWaitMs: 100 }),
    requestTurn: async ({ productId }) => {
      pendingRequests.push(productId);
      return turnFor(productId);
    },
  });
  controller.start();
  await flush();
  assert.equal(pending.listenerCount, 1, `AI ${action} fixture reaches pending voice discovery`);
  controller[action]();
  assert.equal(pending.listenerCount, 0, `AI ${action} cleans the voiceschanged listener`);
  pending.setVoices([preferredThai]);
  await flush();
  assert.equal(pending.spoken.length, 0, `late voices after AI ${action} cannot speak`);
  assert.deepEqual(pendingRequests, [101], `AI ${action} cannot prefetch from stale voice discovery`);
}

const skipPending = voiceScope([]);
const skipRequests = [];
let releaseSkippedProduct;
const skipController = createLiveAiHostController(scenes, {
  narrator: createLiveAiSpeechNarrator(skipPending.scope, { voiceWaitMs: 100 }),
  requestTurn: ({ productId }) => {
    skipRequests.push(productId);
    if (productId === 101) return Promise.resolve(turnFor(productId));
    return new Promise(resolve => { releaseSkippedProduct = () => resolve(turnFor(productId)); });
  },
});
skipController.start();
await flush();
assert.equal(skipPending.listenerCount, 1, 'AI skip fixture reaches pending voice discovery');
skipController.skip();
await flush();
assert.equal(skipPending.listenerCount, 0, 'AI skip cancels old-product voice discovery before requesting the next product');
skipPending.setVoices([preferredThai]);
await flush();
assert.equal(skipPending.spoken.length, 0, 'late old-product voiceschanged after Skip cannot speak or animate');
assert.deepEqual(skipRequests, [101, 202]);
releaseSkippedProduct();
await flush();
assert.equal(skipPending.spoken.length, 1);
assert.equal(skipPending.spoken[0].text, 'บทสดสินค้า 202', 'only the post-Skip product may be queued');
skipController.destroy();

const capabilities = {
  legacyNoneUsesFullAiPresenter: legacyPreset === 'visiond-default'
    && /resolveLiveAiPresenterPreset\(manifest\.show\.avatar\.preset\)/.test(openerSource),
  localMissingThaiFailsClosed: localMissingStatus === 'thai-unavailable' && localMissing.spoken.length === 0,
  localLateThaiWaits: localLateBefore === 0
    && localLateStatus === 'thai'
    && localLate.spoken.length === 1
    && localLate.spoken[0].voice === preferredThai
    && localLate.spoken[0].lang.toLowerCase() === 'th-th',
  pendingVoiceCancellation: localCancelledStatus === 'cancelled'
    && localCancelled.spoken.length === 0
    && localCancelled.listenerCount === 0,
  aiMissingThaiFailsClosed: aiMissingStatus === 'thai-unavailable' && aiMissing.spoken.length === 0,
  controllerVoiceBoundary: aiLateNarration.length === 1
    && aiLateRequests.length === 2
    && aiNoThaiController.snapshot().error?.code === 'LIVE_HOST_THAI_VOICE_MISSING',
};

console.log(JSON.stringify({ releasedVersion: (await text('VERSION.txt')).trim(), capabilities, observed: {
  legacyPreset,
  localMissingStatus,
  localMissingSpoken: localMissing.spoken.length,
  localLateStatus,
  localLateBefore,
  localLateVoice: localLate.spoken[0]?.voice?.lang || '',
  localCancelledStatus,
  localCancelledSpoken: localCancelled.spoken.length,
  aiMissingStatus,
  aiMissingSpoken: aiMissing.spoken.length,
} }, null, 2));

assert.equal(capabilities.legacyNoneUsesFullAiPresenter, true, 'legacy avatar none must map to the full online AI presenter without mutating package metadata');
assert.equal(capabilities.localMissingThaiFailsClosed, true, 'offline saved-script narration must never fall back to a non-Thai voice');
assert.equal(capabilities.localLateThaiWaits, true, 'offline narration must wait for Chrome async voices and prefer th-TH');
assert.equal(capabilities.pendingVoiceCancellation, true, 'stop/reopen must cancel pending voice discovery before speech');
assert.equal(capabilities.aiMissingThaiFailsClosed, true, 'AI live narration must never fall back to a non-Thai voice');
assert.equal(capabilities.controllerVoiceBoundary, true, 'AI controller must bind prefetch/presenter work to genuine Thai utterance.onstart');

console.log('v0.20.132 legacy AI presenter and Thai-only asynchronous voice contract passed');
