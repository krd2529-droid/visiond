export const LIVE_HOST_ENDPOINT = '/api/admin/live-center/host-turn';
export const LIVE_HOST_CONTEXT_LIMIT = 4;
export const LIVE_HOST_TURN_CHAR_LIMIT = 600;
export const LIVE_HOST_CUE_CHAR_LIMIT = 160;

const HOST_PHASES = new Set(['ready', 'generating', 'speaking', 'paused', 'stopped', 'error']);
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const normalizedLine = (value, max) => {
  if (typeof value !== 'string') return '';
  const output = value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return output.length <= max ? output : '';
};

export class LiveAiHostError extends Error {
  constructor(message, code = 'LIVE_HOST_FAILED', status = 0) {
    super(message);
    this.name = 'LiveAiHostError';
    this.code = code;
    this.status = status;
  }
}

const transportMessage = status => {
  if (status === 401 || status === 403) return 'เซสชันหมดอายุหรือไม่มีสิทธิ์ใช้ AI พิธีกรสด กรุณาเข้าสู่ระบบใหม่';
  if (status === 429) return 'AI พิธีกรสดรับคำขอถี่เกินไป กรุณารอแล้วกดลองใหม่';
  if (status === 409) return 'สินค้านี้ไม่พร้อมขายแล้ว กรุณาข้ามไปสินค้าอื่น';
  if (status === 504) return 'AI ใช้เวลานานเกินไป กรุณากดลองใหม่';
  return 'เชื่อมต่อ AI พิธีกรสดไม่สำเร็จ กรุณากดลองใหม่';
};

export async function requestLiveHostTurn({ productId, recentTurns = [], operatorCue = '', signal }, { fetchImpl = fetch } = {}) {
  const body = { product_id: productId, recent_turns: recentTurns };
  if (operatorCue) body.operator_cue = operatorCue;
  let response;
  try {
    response = await fetchImpl(LIVE_HOST_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new LiveAiHostError('การเชื่อมต่อ AI ขัดข้อง กรุณากดลองใหม่', 'LIVE_HOST_NETWORK_FAILED');
  }
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const serverMessage = normalizedLine(payload?.error, 300);
    throw new LiveAiHostError(serverMessage || transportMessage(response.status), String(payload?.code || 'LIVE_HOST_TRANSPORT_FAILED'), response.status);
  }
  const turn = payload?.turn;
  const product = turn?.product;
  const text = normalizedLine(turn?.text, LIVE_HOST_TURN_CHAR_LIMIT);
  if (!Number.isSafeInteger(payload?.viewer_id)
    || !isObject(turn)
    || !text
    || !isObject(product)
    || !Number.isSafeInteger(product.id)
    || product.id !== productId
    || typeof product.title !== 'string'
    || !Number.isSafeInteger(product.price_minor)
    || typeof product.currency !== 'string'
    || !Number.isSafeInteger(product.stock)) {
    throw new LiveAiHostError('AI ส่งข้อมูลบทพูดสดไม่สมบูรณ์ กรุณากดลองใหม่', 'LIVE_HOST_RESPONSE_INVALID', 502);
  }
  return Object.freeze({
    text,
    product: Object.freeze({
      id: product.id,
      title: product.title,
      price_minor: product.price_minor,
      currency: product.currency,
      stock: product.stock,
    }),
  });
}

export function createLiveAiSpeechNarrator(scope = globalThis) {
  const synthesis = scope?.speechSynthesis;
  const Utterance = scope?.SpeechSynthesisUtterance;
  let active = null;
  return Object.freeze({
    cancel() {
      active = null;
      try { synthesis?.cancel?.(); } catch {}
    },
    speak(text, { onStart = () => {}, onEnd = () => {}, onError = () => {} } = {}) {
      if (typeof text !== 'string' || !text.trim()) return 'empty';
      if (!synthesis?.speak || typeof Utterance !== 'function') return 'unavailable';
      try {
        const utterance = new Utterance(text);
        const voices = typeof synthesis.getVoices === 'function' ? synthesis.getVoices() : [];
        const thaiVoice = Array.isArray(voices)
          ? voices.find(voice => /^th(?:-|$)/i.test(String(voice?.lang || '')))
          : null;
        utterance.lang = thaiVoice?.lang || 'th-TH';
        if (thaiVoice) utterance.voice = thaiVoice;
        active = utterance;
        utterance.onstart = () => {
          if (active !== utterance) return;
          onStart();
        };
        utterance.onend = () => {
          if (active !== utterance) return;
          active = null;
          onEnd();
        };
        utterance.onerror = event => {
          if (active !== utterance) return;
          active = null;
          onError(event);
        };
        synthesis.speak(utterance);
        return thaiVoice ? 'thai' : 'default';
      } catch {
        active = null;
        return 'unavailable';
      }
    },
  });
}

export function createLiveAiHostController(scenes, options = {}) {
  if (!Array.isArray(scenes) || scenes.length < 1 || scenes.some(scene => !Number.isSafeInteger(scene?.product?.id) || scene.product.id < 1)) {
    throw new TypeError('Validated package scenes are required');
  }
  const requestTurn = typeof options.requestTurn === 'function' ? options.requestTurn : requestLiveHostTurn;
  const narrator = options.narrator || createLiveAiSpeechNarrator();
  const onState = typeof options.onState === 'function' ? options.onState : () => {};
  const onProduct = typeof options.onProduct === 'function' ? options.onProduct : () => {};
  const onTurn = typeof options.onTurn === 'function' ? options.onTurn : () => {};
  const onNarration = typeof options.onNarration === 'function' ? options.onNarration : () => {};

  let phase = 'ready';
  let productPosition = 0;
  let epoch = 0;
  let speechSerial = 0;
  let activeRequest = null;
  let activeSpeech = null;
  let prefetchedTurn = null;
  let recentTurns = [];
  let operatorCue = '';
  let loopProducts = false;
  let caption = '';
  let authoritativeProduct = null;
  let errorState = null;
  let speechStatus = 'idle';
  let destroyed = false;

  const currentScene = () => scenes[productPosition];
  const snapshot = () => Object.freeze({
    phase,
    productPosition,
    productCount: scenes.length,
    productId: currentScene().product.id,
    product: authoritativeProduct || currentScene().product,
    caption,
    error: errorState,
    speechStatus,
    requestPending: activeRequest !== null,
    hasPrefetch: prefetchedTurn !== null,
    loopProducts,
  });
  const emitState = reason => {
    if (!HOST_PHASES.has(phase)) throw new Error('Invalid AI host phase');
    onState({ ...snapshot(), reason });
  };
  const emitProduct = reason => onProduct({
    scene: currentScene(),
    product: authoritativeProduct || currentScene().product,
    productPosition,
    productCount: scenes.length,
    reason,
  });
  const abortActiveRequest = () => {
    const request = activeRequest;
    activeRequest = null;
    try { request?.controller.abort(); } catch {}
  };
  const invalidateWork = ({ cancelSpeech = true } = {}) => {
    epoch += 1;
    abortActiveRequest();
    prefetchedTurn = null;
    activeSpeech = null;
    if (cancelSpeech) {
      try { narrator.cancel?.(); } catch {}
    }
    speechStatus = 'idle';
  };
  const normalizedFailure = error => error instanceof LiveAiHostError
    ? error
    : new LiveAiHostError('AI พิธีกรสดหยุดทำงาน กรุณากดลองใหม่', 'LIVE_HOST_FAILED');
  const fail = (error, reason = 'failure') => {
    if (destroyed) return;
    const failure = normalizedFailure(error);
    invalidateWork();
    phase = 'error';
    errorState = Object.freeze({ message: failure.message, code: failure.code, status: failure.status || 0 });
    emitState(reason);
  };
  const validTurn = (value, expectedProductId) => {
    const text = normalizedLine(value?.text, LIVE_HOST_TURN_CHAR_LIMIT);
    const product = value?.product;
    if (!text
      || !isObject(product)
      || product.id !== expectedProductId
      || typeof product.title !== 'string'
      || !Number.isSafeInteger(product.price_minor)
      || typeof product.currency !== 'string'
      || !Number.isSafeInteger(product.stock)) {
      throw new LiveAiHostError('AI ส่งข้อมูลบทพูดสดไม่สมบูรณ์ กรุณากดลองใหม่', 'LIVE_HOST_RESPONSE_INVALID', 502);
    }
    return Object.freeze({ text, product: Object.freeze({ ...product }) });
  };

  let launchRequest;
  const handleSpeechStart = (token, status, turn, reason) => {
    if (destroyed || activeSpeech !== token || token.epoch !== epoch || token.productPosition !== productPosition || token.started) return;
    token.started = true;
    speechStatus = status;
    onNarration({ status, text: turn.text, productPosition, reason });
    emitState('speech-started');
    launchRequest('prefetch');
  };
  const handleSpeechEnd = token => {
    if (destroyed || activeSpeech !== token || token.epoch !== epoch || token.productPosition !== productPosition) return;
    if (!token.started) {
      fail(new LiveAiHostError('เสียงพูดของอุปกรณ์จบก่อนเริ่มทำงาน กรุณากดลองใหม่', 'LIVE_HOST_SPEECH_FAILED'), 'speech-ended-before-start');
      return;
    }
    activeSpeech = null;
    speechStatus = 'idle';
    if (prefetchedTurn) {
      const next = prefetchedTurn;
      prefetchedTurn = null;
      speakTurn(next, 'prefetch-consumed');
      return;
    }
    if (activeRequest) {
      phase = 'generating';
      emitState('speech-ended-waiting');
      return;
    }
    phase = 'generating';
    emitState('speech-ended');
    launchRequest('speech-ended');
  };
  const handleSpeechError = (token, event) => {
    if (destroyed || activeSpeech !== token || token.epoch !== epoch || token.productPosition !== productPosition) return;
    fail(new LiveAiHostError('เสียงพูดของอุปกรณ์หยุดทำงาน กรุณากดลองใหม่', 'LIVE_HOST_SPEECH_FAILED'), event?.error === 'not-allowed' ? 'speech-not-allowed' : 'speech-error');
  };
  const speakTurn = (value, reason) => {
    if (destroyed || !['generating', 'speaking'].includes(phase)) return;
    const turn = validTurn(value, currentScene().product.id);
    prefetchedTurn = null;
    caption = turn.text;
    authoritativeProduct = turn.product;
    errorState = null;
    recentTurns = [...recentTurns, turn.text].slice(-LIVE_HOST_CONTEXT_LIMIT);
    const token = { epoch, productPosition, serial: ++speechSerial, started: false };
    activeSpeech = token;
    phase = 'speaking';
    speechStatus = 'starting';
    onTurn({ ...turn, source: 'ai-live', productPosition, reason });
    emitState(reason);
    let status = '';
    let startPending = false;
    const startSpeech = () => {
      if (!status) {
        startPending = true;
        return;
      }
      handleSpeechStart(token, status, turn, reason);
    };
    try {
      status = narrator.speak?.(turn.text, {
        onStart: startSpeech,
        onEnd: () => handleSpeechEnd(token),
        onError: event => handleSpeechError(token, event),
      }) || 'unavailable';
    } catch {
      status = 'unavailable';
    }
    if (activeSpeech !== token || token.epoch !== epoch) return;
    if (!['thai', 'default'].includes(status)) {
      fail(new LiveAiHostError('อุปกรณ์นี้ไม่พร้อมพูดด้วย Web Speech กรุณาตรวจเสียงแล้วกดลองใหม่', 'LIVE_HOST_SPEECH_UNAVAILABLE'), 'speech-unavailable');
      return;
    }
    if (startPending) handleSpeechStart(token, status, turn, reason);
  };
  launchRequest = reason => {
    if (destroyed || activeRequest || prefetchedTurn || !['generating', 'speaking'].includes(phase)) return false;
    const requestEpoch = epoch;
    const requestPosition = productPosition;
    const productId = currentScene().product.id;
    const controller = new AbortController();
    const request = { controller, epoch: requestEpoch, productPosition: requestPosition, productId };
    activeRequest = request;
    if (phase !== 'speaking') {
      phase = 'generating';
      speechStatus = 'idle';
      emitState(reason);
    } else {
      emitState('prefetch-started');
    }
    const requestContext = recentTurns.slice(-LIVE_HOST_CONTEXT_LIMIT);
    const requestCue = operatorCue;
    Promise.resolve().then(() => requestTurn({ productId, recentTurns: requestContext, operatorCue: requestCue, signal: controller.signal })).then(value => {
      if (destroyed || activeRequest !== request || requestEpoch !== epoch || requestPosition !== productPosition || productId !== currentScene().product.id) return;
      const turn = validTurn(value, productId);
      activeRequest = null;
      if (activeSpeech) {
        prefetchedTurn = turn;
        emitState('prefetch-ready');
        return;
      }
      speakTurn(turn, reason === 'prefetch' ? 'prefetch-after-speech' : 'turn-ready');
    }).catch(error => {
      if (destroyed || activeRequest !== request || requestEpoch !== epoch || requestPosition !== productPosition) return;
      activeRequest = null;
      if (error?.name === 'AbortError' && controller.signal.aborted) return;
      fail(error, error?.status === 401 || error?.status === 403 ? 'auth-failure' : 'request-failure');
    });
    return true;
  };

  const start = ({ position } = {}) => {
    if (destroyed || phase === 'generating' || phase === 'speaking') return snapshot();
    const wasError = phase === 'error';
    if (position !== undefined) {
      const selected = Number(position);
      if (Number.isInteger(selected) && selected >= 0 && selected < scenes.length && selected !== productPosition) {
        productPosition = selected;
        recentTurns = [];
        caption = '';
        authoritativeProduct = null;
        emitProduct('start-position');
      }
    }
    invalidateWork();
    phase = 'generating';
    errorState = null;
    launchRequest(wasError ? 'retry' : 'start');
    return snapshot();
  };
  const pause = () => {
    if (destroyed || !['generating', 'speaking'].includes(phase)) return snapshot();
    invalidateWork();
    phase = 'paused';
    errorState = null;
    emitState('pause');
    return snapshot();
  };
  const stop = () => {
    if (destroyed || ['ready', 'stopped'].includes(phase)) return snapshot();
    invalidateWork();
    phase = 'stopped';
    errorState = null;
    emitState('stop');
    return snapshot();
  };
  const retry = () => phase === 'error' ? start() : snapshot();
  const skip = () => {
    if (destroyed || scenes.length < 2) return snapshot();
    const atFinal = productPosition === scenes.length - 1;
    if (atFinal && !loopProducts) return snapshot();
    const previousPhase = phase;
    const wasRunning = previousPhase === 'generating' || previousPhase === 'speaking';
    const wasPaused = previousPhase === 'paused';
    invalidateWork();
    productPosition = atFinal ? 0 : productPosition + 1;
    recentTurns = [];
    caption = '';
    authoritativeProduct = null;
    errorState = null;
    emitProduct('skip');
    if (wasRunning) {
      phase = 'generating';
      emitState('skip');
      launchRequest('skip');
    } else {
      phase = wasPaused ? 'paused' : previousPhase === 'ready' ? 'ready' : 'stopped';
      emitState('skip');
    }
    return snapshot();
  };
  const setLoopProducts = value => {
    if (destroyed) return snapshot();
    loopProducts = value === true;
    emitState('loop-products');
    return snapshot();
  };
  const setOperatorCue = value => {
    if (destroyed) return snapshot();
    const next = typeof value === 'string' ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LIVE_HOST_CUE_CHAR_LIMIT) : '';
    operatorCue = next;
    emitState('operator-cue');
    return snapshot();
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    invalidateWork();
  };

  emitProduct('load');
  emitState('load');
  return Object.freeze({ start, pause, stop, retry, skip, setLoopProducts, setOperatorCue, destroy, snapshot });
}
