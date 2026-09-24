import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const presenterPath = path.join(root, 'public/live-package-presenter.js');
const html = read('public/live-package-open.html');
const opener = read('public/live-package-open.js');
const hostSource = read('public/live-package-ai-host.js');
const thaiSpeechSource = fs.existsSync(path.join(root, 'public/live-package-thai-speech.js'))
  ? read('public/live-package-thai-speech.js')
  : hostSource;
const css = read('public/live-center.css');

const requiredStates = ['idle', 'thinking', 'talk', 'present', 'open', 'cheer', 'paused', 'error'];
const capabilities = {
  presenterModule: fs.existsSync(presenterPath),
  noOrb: !html.includes('obs-ai-orb') && !css.includes('.obs-ai-orb'),
  previewAndObs: /id="aiPresenterPreview"/.test(html) && /id="obsPresenter"/.test(html),
  articulatedHuman: /presenter-face/.test(html + opener + css)
    && /presenter-mouth/.test(html + opener + css)
    && /presenter-torso/.test(html + opener + css)
    && /presenter-arm-left/.test(html + opener + css)
    && /presenter-arm-right/.test(html + opener + css),
  boundedStates: requiredStates.every(state => (html + opener + css).includes(state)),
  avatarPresetConnected: /manifest\.show\.avatar\.preset/.test(opener),
  speechConnected: /startSpeaking/.test(opener)
    && /onNarration/.test(opener)
    && /onStart/.test(hostSource)
    && /utterance\.onstart/.test(thaiSpeechSource),
};

console.log(JSON.stringify({ releasedVersion: read('VERSION.txt').trim(), capabilities }, null, 2));
assert.equal(capabilities.presenterModule, true, 'RED: v0.20.130 has no human-presenter state-machine module');
assert.equal(capabilities.noOrb, true, 'the glowing orb must be replaced, not kept as the presenter');
assert.equal(capabilities.previewAndObs, true, 'the same presenter state must render in operator preview and clean OBS');
assert.equal(capabilities.articulatedHuman, true, 'presenter must expose face, mouth, torso and two articulated arms');
assert.equal(capabilities.boundedStates, true, 'all eight bounded presenter states must be represented');
assert.equal(capabilities.avatarPresetConnected, true, 'validated package avatar preset must control presenter visibility/variant');
assert.equal(capabilities.speechConnected, true, 'gesture scheduling must begin only from genuine narration start');
assert.match(thaiSpeechSource, /utterance\.onstart\s*=\s*\(\)\s*=>/);
assert.match(thaiSpeechSource, /if \(activeUtterance !== utterance \|\| ticket !== generation\) return;\s*onStart\(\);/);

const presenterSource = read('public/live-package-presenter.js');
assert.doesNotMatch(presenterSource, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|https?:\/\//, 'presenter must be code-native and network-free');

const {
  LIVE_HUMAN_PRESENTER_SVG,
  LIVE_PRESENTER_SPEAKING_CYCLE,
  LIVE_PRESENTER_STATES,
  createLiveHumanPresenter,
  normalizeLivePresenterPreset,
} = await import(`${pathToFileURL(presenterPath).href}?test=${Date.now()}`);

assert.deepEqual([...LIVE_PRESENTER_STATES], requiredStates);
assert.deepEqual([...LIVE_PRESENTER_SPEAKING_CYCLE], ['talk', 'present', 'talk', 'open', 'talk', 'cheer']);
assert.match(LIVE_HUMAN_PRESENTER_SVG, /presenter-face/);
assert.match(LIVE_HUMAN_PRESENTER_SVG, /presenter-mouth/);
assert.match(LIVE_HUMAN_PRESENTER_SVG, /presenter-torso/);
assert.match(LIVE_HUMAN_PRESENTER_SVG, /presenter-arm-left/);
assert.match(LIVE_HUMAN_PRESENTER_SVG, /presenter-arm-right/);
assert.equal(normalizeLivePresenterPreset('visiond-default'), 'visiond-default');
assert.equal(normalizeLivePresenterPreset('presenter-placeholder'), 'presenter-placeholder');
assert.equal(normalizeLivePresenterPreset('none'), 'none');
assert.equal(normalizeLivePresenterPreset('hostile'), 'none');

function fakeScheduler() {
  let serial = 0;
  const pending = new Map();
  return {
    setTimeoutFn(callback, delay) {
      const id = ++serial;
      pending.set(id, { callback, delay });
      return id;
    },
    clearTimeoutFn(id) { pending.delete(id); },
    peek() { return pending.values().next().value || null; },
    runNext() {
      const entry = pending.entries().next().value;
      if (!entry) return false;
      pending.delete(entry[0]);
      entry[1].callback();
      return true;
    },
    get size() { return pending.size; },
  };
}

const scheduler = fakeScheduler();
const events = [];
const presenter = createLiveHumanPresenter({
  preset: 'visiond-default',
  gestureIntervalMs: 900,
  setTimeoutFn: scheduler.setTimeoutFn,
  clearTimeoutFn: scheduler.clearTimeoutFn,
  onState: state => events.push(state),
});
assert.deepEqual(presenter.snapshot(), {
  state: 'idle', preset: 'visiond-default', visible: true, speaking: false,
  reducedMotion: false, timerPending: false, destroyed: false,
});

presenter.setState('thinking', 'generating');
assert.equal(presenter.snapshot().state, 'thinking');
assert.equal(scheduler.size, 0);
presenter.startSpeaking('turn-a');
assert.equal(presenter.snapshot().state, 'talk');
assert.equal(presenter.snapshot().speaking, true);
assert.equal(scheduler.size, 1);
const firstLateCallback = scheduler.peek().callback;
presenter.startSpeaking('turn-a');
assert.equal(scheduler.size, 1, 'duplicate narration callback must not start a second gesture clock');
for (const expected of ['present', 'talk', 'open', 'talk', 'cheer']) {
  assert.equal(scheduler.runNext(), true);
  assert.equal(presenter.snapshot().state, expected);
  assert.equal(scheduler.size, 1);
}

presenter.setState('paused', 'pause');
assert.equal(presenter.snapshot().state, 'paused');
assert.equal(presenter.snapshot().speaking, false);
assert.equal(scheduler.size, 0);
firstLateCallback();
assert.equal(presenter.snapshot().state, 'paused', 'stale gesture callback must not animate after pause');

presenter.startSpeaking('turn-b');
const reopenLateCallback = scheduler.peek().callback;
presenter.setState('idle', 'reopen');
reopenLateCallback();
assert.equal(presenter.snapshot().state, 'idle', 'stale callback must not animate a reopened package');
assert.equal(scheduler.size, 0);

presenter.startSpeaking('turn-c');
presenter.setState('error', 'speech-error');
assert.equal(presenter.snapshot().state, 'error');
assert.equal(scheduler.size, 0);
presenter.setPreset('none');
assert.equal(presenter.snapshot().visible, false);
presenter.startSpeaking('hidden-turn');
assert.equal(scheduler.size, 0, 'hidden presenter must not run gesture timers');
presenter.setPreset('presenter-placeholder');
presenter.setState('idle', 'placeholder-ready');
assert.equal(presenter.snapshot().visible, true);

presenter.destroy();
assert.equal(presenter.snapshot().destroyed, true);
assert.equal(scheduler.size, 0);
const eventCount = events.length;
presenter.startSpeaking('after-destroy');
assert.equal(events.length, eventCount);

const reducedScheduler = fakeScheduler();
const reducedEvents = [];
const reduced = createLiveHumanPresenter({
  preset: 'visiond-default',
  reducedMotion: true,
  setTimeoutFn: reducedScheduler.setTimeoutFn,
  clearTimeoutFn: reducedScheduler.clearTimeoutFn,
  onState: state => reducedEvents.push(state),
});
reduced.setState('thinking', 'generating');
reduced.startSpeaking('reduced-turn');
assert.equal(reduced.snapshot().state, 'talk');
assert.equal(reducedScheduler.size, 0, 'reduced-motion mode must use static pose changes without a continuous timer');
assert.deepEqual(reducedEvents.map(event => event.state), ['idle', 'thinking', 'talk']);
reduced.destroy();

console.log('v0.20.131 bounded human presenter, stale-timer teardown, preset and reduced-motion checks passed');
