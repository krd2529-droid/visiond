export const LIVE_PRESENTER_STATES = Object.freeze([
  'idle',
  'thinking',
  'talk',
  'present',
  'open',
  'cheer',
  'paused',
  'error',
]);

export const LIVE_PRESENTER_SPEAKING_CYCLE = Object.freeze([
  'talk',
  'present',
  'talk',
  'open',
  'talk',
  'cheer',
]);

const PRESENTER_PRESETS = new Set(['visiond-default', 'presenter-placeholder', 'none']);
const PRESENTER_STATE_SET = new Set(LIVE_PRESENTER_STATES);

export const LIVE_HUMAN_PRESENTER_SVG = `<svg class="live-presenter-svg" viewBox="0 0 320 360" focusable="false" aria-hidden="true">
  <circle class="presenter-halo" cx="160" cy="178" r="145"></circle>
  <g class="presenter-person">
    <g class="presenter-arm presenter-arm-left">
      <path class="presenter-upper-arm" d="M112 226 Q88 244 72 270"></path>
      <circle class="presenter-joint" cx="72" cy="270" r="7"></circle>
      <g class="presenter-forearm presenter-forearm-left">
        <path d="M72 270 Q62 296 66 326"></path>
        <circle class="presenter-hand" cx="67" cy="330" r="13"></circle>
      </g>
    </g>
    <g class="presenter-arm presenter-arm-right">
      <path class="presenter-upper-arm" d="M208 226 Q232 244 248 270"></path>
      <circle class="presenter-joint" cx="248" cy="270" r="7"></circle>
      <g class="presenter-forearm presenter-forearm-right">
        <path d="M248 270 Q258 296 254 326"></path>
        <circle class="presenter-hand" cx="253" cy="330" r="13"></circle>
      </g>
    </g>
    <path class="presenter-torso" d="M111 216 Q129 201 160 201 Q191 201 209 216 Q222 251 224 350 L96 350 Q98 251 111 216Z"></path>
    <path class="presenter-jacket-left" d="M111 216 Q123 207 143 203 L151 350 L104 350 Q102 266 111 216Z"></path>
    <path class="presenter-jacket-right" d="M209 216 Q197 207 177 203 L169 350 L216 350 Q218 266 209 216Z"></path>
    <path class="presenter-shirt" d="M143 203 L160 233 L177 203 L169 350 L151 350Z"></path>
    <rect class="presenter-neck" x="143" y="180" width="34" height="38" rx="14"></rect>
    <ellipse class="presenter-ear" cx="109" cy="136" rx="13" ry="19"></ellipse>
    <ellipse class="presenter-ear" cx="211" cy="136" rx="13" ry="19"></ellipse>
    <g class="presenter-head">
      <ellipse class="presenter-face" cx="160" cy="128" rx="55" ry="69"></ellipse>
      <path class="presenter-hair" d="M108 126 Q101 70 139 52 Q178 31 207 69 Q221 88 211 126 Q199 91 178 85 Q143 98 111 79 Q104 99 108 126Z"></path>
      <path class="presenter-hair-detail" d="M128 72 Q154 46 190 68"></path>
      <path class="presenter-brow presenter-brow-left" d="M126 116 Q140 108 151 116"></path>
      <path class="presenter-brow presenter-brow-right" d="M169 116 Q181 108 194 116"></path>
      <ellipse class="presenter-eye presenter-eye-left" cx="140" cy="128" rx="5" ry="7"></ellipse>
      <ellipse class="presenter-eye presenter-eye-right" cx="181" cy="128" rx="5" ry="7"></ellipse>
      <path class="presenter-nose" d="M160 132 Q154 146 163 148"></path>
      <g class="presenter-mouth">
        <path class="presenter-mouth-line" d="M143 164 Q160 176 178 164"></path>
        <ellipse class="presenter-mouth-open" cx="160" cy="167" rx="14" ry="7"></ellipse>
      </g>
    </g>
    <g class="presenter-brand" aria-hidden="true">
      <circle cx="188" cy="259" r="18"></circle>
      <path d="M180 250 L188 269 L196 250 M183 258 H193"></path>
    </g>
  </g>
</svg>`;

export function normalizeLivePresenterPreset(value) {
  const preset = String(value || '').trim();
  return PRESENTER_PRESETS.has(preset) ? preset : 'none';
}

export function resolveLiveAiPresenterPreset(value) {
  const preset = normalizeLivePresenterPreset(value);
  return preset === 'none' ? 'visiond-default' : preset;
}

export function mountLiveHumanPresenter(root) {
  if (!root || typeof root !== 'object' || !('innerHTML' in root)) return false;
  root.innerHTML = LIVE_HUMAN_PRESENTER_SVG;
  return true;
}

export function createLiveHumanPresenter(options = {}) {
  const onState = typeof options.onState === 'function' ? options.onState : () => {};
  const setTimeoutFn = typeof options.setTimeoutFn === 'function' ? options.setTimeoutFn : globalThis.setTimeout.bind(globalThis);
  const clearTimeoutFn = typeof options.clearTimeoutFn === 'function' ? options.clearTimeoutFn : globalThis.clearTimeout.bind(globalThis);
  const gestureIntervalMs = Math.min(4_000, Math.max(600, Number(options.gestureIntervalMs) || 1_400));
  const reducedMotion = options.reducedMotion === true;

  let preset = normalizeLivePresenterPreset(options.preset || 'visiond-default');
  let state = 'idle';
  let speaking = false;
  let activeTurnKey = '';
  let cyclePosition = 0;
  let generation = 0;
  let timer = null;
  let destroyed = false;

  const snapshot = () => ({
    state,
    preset,
    visible: preset !== 'none',
    speaking,
    reducedMotion,
    timerPending: timer !== null,
    destroyed,
  });
  const emit = reason => onState({ ...snapshot(), reason });
  const clearTimer = () => {
    if (timer === null) return;
    const current = timer;
    timer = null;
    try { clearTimeoutFn(current); } catch {}
  };
  const invalidate = () => {
    generation += 1;
    clearTimer();
    speaking = false;
    activeTurnKey = '';
    cyclePosition = 0;
  };

  const scheduleGesture = expectedGeneration => {
    if (destroyed || !speaking || reducedMotion || preset === 'none' || expectedGeneration !== generation) return;
    timer = setTimeoutFn(() => {
      timer = null;
      if (destroyed || !speaking || reducedMotion || preset === 'none' || expectedGeneration !== generation) return;
      cyclePosition = (cyclePosition + 1) % LIVE_PRESENTER_SPEAKING_CYCLE.length;
      state = LIVE_PRESENTER_SPEAKING_CYCLE[cyclePosition];
      emit('gesture');
      scheduleGesture(expectedGeneration);
    }, gestureIntervalMs);
  };

  const setState = (nextState, reason = 'state') => {
    if (destroyed) return snapshot();
    if (!PRESENTER_STATE_SET.has(nextState)) throw new TypeError('Invalid live presenter state');
    invalidate();
    state = nextState;
    emit(reason);
    return snapshot();
  };
  const startSpeaking = turnKey => {
    if (destroyed) return snapshot();
    const key = String(turnKey || '').slice(0, 700);
    if (speaking && key && key === activeTurnKey) return snapshot();
    invalidate();
    speaking = true;
    activeTurnKey = key;
    state = LIVE_PRESENTER_SPEAKING_CYCLE[0];
    emit('speech-started');
    scheduleGesture(generation);
    return snapshot();
  };
  const setPreset = value => {
    if (destroyed) return snapshot();
    const nextPreset = normalizeLivePresenterPreset(value);
    if (nextPreset === preset) return snapshot();
    const wasSpeaking = speaking;
    const turnKey = activeTurnKey;
    invalidate();
    preset = nextPreset;
    state = wasSpeaking && preset !== 'none' ? 'talk' : 'idle';
    if (wasSpeaking && preset !== 'none') {
      speaking = true;
      activeTurnKey = turnKey;
      scheduleGesture(generation);
    }
    emit('preset');
    return snapshot();
  };
  const destroy = () => {
    if (destroyed) return;
    invalidate();
    destroyed = true;
  };

  emit('load');
  return Object.freeze({ setState, startSpeaking, setPreset, destroy, snapshot });
}
