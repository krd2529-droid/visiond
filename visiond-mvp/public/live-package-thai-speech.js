export const THAI_VOICE_WAIT_MS = 1_500;
export const THAI_VOICE_MISSING_STATUS = 'thai-unavailable';
export const THAI_VOICE_MISSING_MESSAGE = 'ไม่พบเสียงภาษาไทย (th-TH) ในอุปกรณ์นี้ กรุณาติดตั้งหรือเปิดใช้เสียงไทย แล้วกดลองใหม่';

const voiceLanguage = voice => String(voice?.lang || '').trim().toLowerCase();

export function selectThaiSpeechVoice(voices) {
  const available = Array.from(voices || []);
  return available.find(voice => voiceLanguage(voice) === 'th-th')
    || available.find(voice => /^th(?:-|$)/.test(voiceLanguage(voice)))
    || null;
}

export function createThaiSpeechNarrator(scope = globalThis, options = {}) {
  const synthesis = scope?.speechSynthesis;
  const Utterance = scope?.SpeechSynthesisUtterance;
  const setTimeoutFn = typeof options.setTimeoutFn === 'function'
    ? options.setTimeoutFn
    : (scope?.setTimeout || globalThis.setTimeout).bind(scope || globalThis);
  const clearTimeoutFn = typeof options.clearTimeoutFn === 'function'
    ? options.clearTimeoutFn
    : (scope?.clearTimeout || globalThis.clearTimeout).bind(scope || globalThis);
  const requestedWaitMs = Number(options.voiceWaitMs);
  const voiceWaitMs = Number.isFinite(requestedWaitMs)
    ? Math.min(10_000, Math.max(0, requestedWaitMs))
    : THAI_VOICE_WAIT_MS;

  let generation = 0;
  let activeUtterance = null;
  let cancelPendingDiscovery = null;

  const availableVoices = () => {
    try {
      return typeof synthesis?.getVoices === 'function' ? Array.from(synthesis.getVoices() || []) : [];
    } catch {
      return [];
    }
  };

  const discoverThaiVoice = ticket => {
    const initial = availableVoices();
    const initialThai = selectThaiSpeechVoice(initial);
    if (initialThai) return Promise.resolve({ status: 'thai', voice: initialThai });
    if (initial.length > 0) return Promise.resolve({ status: THAI_VOICE_MISSING_STATUS, voice: null });

    return new Promise(resolve => {
      let settled = false;
      let timer = null;
      let previousHandler = null;
      let propertyHandler = null;
      const supportsEvents = typeof synthesis?.addEventListener === 'function'
        && typeof synthesis?.removeEventListener === 'function';

      const cleanup = () => {
        if (timer !== null) clearTimeoutFn(timer);
        timer = null;
        if (supportsEvents) synthesis.removeEventListener('voiceschanged', checkVoices);
        else if (propertyHandler && synthesis?.onvoiceschanged === propertyHandler) synthesis.onvoiceschanged = previousHandler;
        if (cancelPendingDiscovery === cancel) cancelPendingDiscovery = null;
      };
      const finish = result => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      };
      const cancel = () => finish({ status: 'cancelled', voice: null });
      const checkVoices = () => {
        if (ticket !== generation) {
          cancel();
          return;
        }
        const voices = availableVoices();
        const voice = selectThaiSpeechVoice(voices);
        if (voice) finish({ status: 'thai', voice });
        else if (voices.length > 0) finish({ status: THAI_VOICE_MISSING_STATUS, voice: null });
      };

      cancelPendingDiscovery = cancel;
      if (supportsEvents) synthesis.addEventListener('voiceschanged', checkVoices);
      else if (synthesis && 'onvoiceschanged' in synthesis) {
        previousHandler = synthesis.onvoiceschanged;
        propertyHandler = event => {
          try { if (typeof previousHandler === 'function') previousHandler.call(synthesis, event); } catch {}
          checkVoices();
        };
        synthesis.onvoiceschanged = propertyHandler;
      }
      timer = setTimeoutFn(() => finish({ status: THAI_VOICE_MISSING_STATUS, voice: null }), voiceWaitMs);
    });
  };

  const cancel = () => {
    generation += 1;
    const cancelDiscovery = cancelPendingDiscovery;
    cancelPendingDiscovery = null;
    cancelDiscovery?.();
    activeUtterance = null;
    try { synthesis?.cancel?.(); } catch {}
  };

  const speak = async (text, { onStart = () => {}, onEnd = () => {}, onError = () => {} } = {}) => {
    if (typeof text !== 'string' || !text.trim()) return 'empty';
    if (!synthesis?.speak || typeof synthesis?.getVoices !== 'function' || typeof Utterance !== 'function') return 'unavailable';

    const oldDiscovery = cancelPendingDiscovery;
    cancelPendingDiscovery = null;
    oldDiscovery?.();
    const ticket = ++generation;
    const discovery = await discoverThaiVoice(ticket);
    if (ticket !== generation || discovery.status === 'cancelled') return 'cancelled';
    if (discovery.status !== 'thai' || !discovery.voice) return THAI_VOICE_MISSING_STATUS;

    try {
      const utterance = new Utterance(text);
      utterance.lang = discovery.voice.lang || 'th-TH';
      utterance.voice = discovery.voice;
      activeUtterance = utterance;
      utterance.onstart = () => {
        if (activeUtterance !== utterance || ticket !== generation) return;
        onStart();
      };
      utterance.onend = () => {
        if (activeUtterance !== utterance || ticket !== generation) return;
        activeUtterance = null;
        onEnd();
      };
      utterance.onerror = event => {
        if (activeUtterance !== utterance || ticket !== generation) return;
        activeUtterance = null;
        onError(event);
      };
      synthesis.speak(utterance);
      return 'thai';
    } catch {
      activeUtterance = null;
      return 'unavailable';
    }
  };

  return Object.freeze({ cancel, speak });
}
