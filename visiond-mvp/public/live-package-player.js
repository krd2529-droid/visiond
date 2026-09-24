import { THAI_VOICE_MISSING_STATUS, createThaiSpeechNarrator } from './live-package-thai-speech.js?v=020133';

const PLAYER_PHASES = new Set(['ready', 'playing', 'paused', 'ended']);

const defaultNow = () => {
  if (globalThis.performance?.now) return globalThis.performance.now();
  return Date.now();
};

const positiveDuration = scene => {
  const seconds = Number(scene?.cue?.duration_seconds);
  if (!Number.isFinite(seconds) || seconds <= 0) throw new TypeError('Scene duration must be a positive number');
  return seconds * 1000;
};

export function createLocalSpeechNarrator(scope = globalThis, options = {}) {
  return createThaiSpeechNarrator(scope, options);
}

export function createLocalLivePlayer(playback, options = {}) {
  if (!playback
    || typeof playback.currentScene !== 'function'
    || typeof playback.next !== 'function'
    || typeof playback.previous !== 'function'
    || typeof playback.reset !== 'function') {
    throw new TypeError('A local playback instance is required');
  }

  const now = typeof options.now === 'function' ? options.now : defaultNow;
  const setTimer = typeof options.setTimer === 'function' ? options.setTimer : (callback, delay) => setTimeout(callback, delay);
  const clearTimer = typeof options.clearTimer === 'function' ? options.clearTimer : timer => clearTimeout(timer);
  const tickMs = Number.isFinite(options.tickMs) ? Math.min(1000, Math.max(16, options.tickMs)) : 100;
  const narrator = options.narrator || createLocalSpeechNarrator();
  const onScene = typeof options.onScene === 'function' ? options.onScene : () => {};
  const onCountdown = typeof options.onCountdown === 'function' ? options.onCountdown : () => {};
  const onState = typeof options.onState === 'function' ? options.onState : () => {};
  const onNarration = typeof options.onNarration === 'function' ? options.onNarration : () => {};

  let phase = 'ready';
  let remainingMs = positiveDuration(playback.currentScene());
  let deadline = 0;
  let timer = null;
  let timerEpoch = 0;
  let entryEpoch = 1;
  let spokenEntryEpoch = 0;
  let narrationEpoch = 0;
  let pendingNarrationEntryEpoch = 0;
  let destroyed = false;
  let lastCountdownMs = remainingMs;

  const currentScene = () => playback.currentScene();
  const snapshot = () => Object.freeze({
    phase,
    remainingMs,
    scenePosition: currentScene()?.position ?? null,
    sceneCount: playback.sceneCount,
  });
  const emitState = reason => {
    if (!PLAYER_PHASES.has(phase)) throw new Error('Invalid local player phase');
    onState({ ...snapshot(), reason });
  };
  const emitCountdown = () => {
    const scene = currentScene();
    const durationMs = positiveDuration(scene);
    lastCountdownMs = Math.min(lastCountdownMs, Math.max(0, remainingMs));
    onCountdown({
      remainingMs: lastCountdownMs,
      remainingSeconds: lastCountdownMs / 1000,
      displaySeconds: Math.ceil(lastCountdownMs / 1000),
      durationSeconds: durationMs / 1000,
      scenePosition: scene?.position ?? null,
    });
  };
  const emitScene = (reason, transition = currentScene()?.cue?.transition || 'cut') => {
    onScene({
      scene: currentScene(),
      asset: playback.currentAsset?.() || null,
      transition: transition === 'fade' ? 'fade' : 'cut',
      reason,
    });
  };
  const cancelNarration = reason => {
    narrationEpoch += 1;
    if (pendingNarrationEntryEpoch === entryEpoch) spokenEntryEpoch = 0;
    pendingNarrationEntryEpoch = 0;
    narrator.cancel?.();
    onNarration({ status: 'cancelled', reason, scenePosition: currentScene()?.position ?? null });
  };
  const narrateCurrentEntry = reason => {
    if (spokenEntryEpoch === entryEpoch) return;
    spokenEntryEpoch = entryEpoch;
    const scene = currentScene();
    const expectedEntryEpoch = entryEpoch;
    const expectedNarrationEpoch = ++narrationEpoch;
    pendingNarrationEntryEpoch = expectedEntryEpoch;
    onNarration({ status: 'voice-loading', reason, script: scene?.script || '', scenePosition: scene?.position ?? null });
    let result;
    try { result = narrator.speak?.(scene?.script || '') || 'unavailable'; } catch { result = 'unavailable'; }
    const settle = status => {
      if (destroyed || expectedEntryEpoch !== entryEpoch || expectedNarrationEpoch !== narrationEpoch) return;
      pendingNarrationEntryEpoch = 0;
      if (status === 'cancelled') return;
      if (status === THAI_VOICE_MISSING_STATUS || status === 'unavailable') spokenEntryEpoch = 0;
      onNarration({ status, reason, script: scene?.script || '', scenePosition: scene?.position ?? null });
    };
    const reject = () => {
      if (destroyed || expectedEntryEpoch !== entryEpoch || expectedNarrationEpoch !== narrationEpoch) return;
      pendingNarrationEntryEpoch = 0;
      spokenEntryEpoch = 0;
      onNarration({ status: 'unavailable', reason, script: scene?.script || '', scenePosition: scene?.position ?? null });
    };
    if (result && typeof result.then === 'function') result.then(settle, reject);
    else settle(result);
  };
  const clearScheduled = () => {
    timerEpoch += 1;
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const resetCountdown = () => {
    remainingMs = positiveDuration(currentScene());
    lastCountdownMs = remainingMs;
    emitCountdown();
  };
  const updateRemaining = () => {
    if (phase !== 'playing') return;
    remainingMs = Math.min(remainingMs, Math.max(0, deadline - now()));
    emitCountdown();
  };

  let scheduleTick;
  const finish = () => {
    clearScheduled();
    remainingMs = 0;
    lastCountdownMs = 0;
    emitCountdown();
    cancelNarration('ended');
    phase = 'ended';
    emitState('ended');
  };
  const advanceExpired = ({ continuePlaying, reason }) => {
    const before = currentScene();
    if (!before || before.position >= playback.sceneCount - 1) {
      finish();
      return;
    }
    clearScheduled();
    cancelNarration(`${reason}-scene-change`);
    playback.next();
    entryEpoch += 1;
    resetCountdown();
    emitScene(reason, currentScene()?.cue?.transition);
    if (continuePlaying) {
      phase = 'playing';
      deadline = now() + remainingMs;
      narrateCurrentEntry(reason);
      emitState(reason);
      scheduleTick();
    } else {
      phase = 'paused';
      emitState(reason);
    }
  };
  const tick = epoch => {
    if (destroyed || phase !== 'playing' || epoch !== timerEpoch) return;
    timer = null;
    updateRemaining();
    if (remainingMs <= 0) {
      advanceExpired({ continuePlaying: true, reason: 'automatic' });
      return;
    }
    scheduleTick();
  };
  scheduleTick = () => {
    if (destroyed || phase !== 'playing' || timer !== null) return;
    const epoch = timerEpoch;
    timer = setTimer(() => tick(epoch), Math.min(tickMs, Math.max(1, remainingMs)));
  };

  const start = () => {
    if (destroyed || phase === 'playing') return snapshot();
    if (phase === 'ended') {
      cancelNarration('replay');
      playback.reset();
      entryEpoch += 1;
      resetCountdown();
      emitScene('replay', 'cut');
    }
    if (remainingMs <= 0) resetCountdown();
    phase = 'playing';
    deadline = now() + remainingMs;
    narrateCurrentEntry('start');
    emitState('start');
    scheduleTick();
    return snapshot();
  };

  const stop = () => {
    if (destroyed || phase !== 'playing') return snapshot();
    updateRemaining();
    if (remainingMs <= 0) {
      advanceExpired({ continuePlaying: false, reason: 'stop-expired' });
      return snapshot();
    }
    clearScheduled();
    cancelNarration('stop');
    phase = 'paused';
    emitState('stop');
    return snapshot();
  };

  const restart = () => {
    if (destroyed) return snapshot();
    clearScheduled();
    cancelNarration('restart');
    playback.reset();
    entryEpoch += 1;
    phase = 'ready';
    resetCountdown();
    emitScene('restart', 'cut');
    emitState('restart');
    return snapshot();
  };

  const navigate = direction => {
    if (destroyed || ![-1, 1].includes(direction)) return snapshot();
    const before = currentScene()?.position;
    if ((direction < 0 && before === 0) || (direction > 0 && before === playback.sceneCount - 1)) return snapshot();
    const wasPlaying = phase === 'playing';
    if (wasPlaying) updateRemaining();
    clearScheduled();
    cancelNarration('manual-scene-change');
    if (direction < 0) playback.previous();
    else playback.next();
    if (currentScene()?.position === before) return snapshot();
    entryEpoch += 1;
    if (phase === 'ended') phase = 'paused';
    resetCountdown();
    emitScene('manual', currentScene()?.cue?.transition);
    if (wasPlaying) {
      phase = 'playing';
      deadline = now() + remainingMs;
      narrateCurrentEntry('manual');
      scheduleTick();
    }
    emitState('manual');
    return snapshot();
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    clearScheduled();
    cancelNarration('destroy');
  };

  emitScene('load', 'cut');
  emitCountdown();
  emitState('load');

  return Object.freeze({ start, stop, restart, navigate, destroy, snapshot });
}
