import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  LIVE_PACKAGE_FORMAT,
  LIVE_PACKAGE_MAGIC_TEXT,
  canonicalLiveJson,
  createLocalLivePlayback,
  livePackageSha256,
  parseVisionDLivePackage,
} from '../public/live-center-package.js';
import { createLocalLivePlayer, createLocalSpeechNarrator } from '../public/live-package-player.js';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root));
const sha256 = async path => createHash('sha256').update(await read(path)).digest('hex').toUpperCase();
const encoder = new TextEncoder();
const imageBytes = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));

function concat(parts) {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export async function representativePackage(title = 'รายการทดสอบสามฉาก', { avatarPreset = 'visiond-default' } = {}) {
  const digest = await livePackageSha256(imageBytes);
  let offset = 0;
  const transitions = ['cut', 'fade', 'cut'];
  const durations = [5, 6, 7];
  const scripts = ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง', 'บทพูดฉากสาม'];
  const scenes = transitions.map((transition, position) => {
    const id = `livea_${String(position + 3).repeat(32)}`;
    return {
      position,
      product: {
        id: position + 1,
        meta_id: `LOCAL-${position + 1}`,
        title: `สินค้าทดสอบ ${position + 1}`,
        price_minor: (position + 1) * 10000,
        currency: 'THB',
        stock: position + 2,
      },
      script: scripts[position],
      cue: { label: `ฉาก ${position + 1}`, duration_seconds: durations[position], transition },
      assets: [{
        id,
        position: 0,
        reference: `visiondlive://assets/${id}`,
        mime_type: 'image/png',
        size: imageBytes.byteLength,
        integrity: { sha256: digest, etag: null },
        primary: true,
      }],
    };
  });
  const embeddedAssets = scenes.map(scene => {
    const asset = scene.assets[0];
    const descriptor = {
      id: asset.id,
      reference: asset.reference,
      offset,
      length: imageBytes.byteLength,
      mime_type: asset.mime_type,
      sha256: digest,
    };
    offset += imageBytes.byteLength;
    return descriptor;
  });
  const manifest = {
    show: {
      id: `live_${'1'.repeat(32)}`,
      title,
      description: 'แพ็กเกจจริงสำหรับทดสอบ local player',
      revision: 3,
      avatar: { preset: avatarPreset },
      output: { profile: 'landscape-1080p' },
    },
    version: { id: `livev_${'2'.repeat(32)}`, number: 4 },
    scenes,
    embedded_assets: embeddedAssets,
    runtime: {
      local_cache: { required: true, cache_key: `live_${'1'.repeat(32)}:v4`, preload_assets: true },
      adapters: { facebook: 'placeholder', tiktok: 'later', shopee: 'later' },
      livestream_launch: false,
    },
    created: { at: '2026-09-24T08:00:00.000Z' },
  };
  const envelope = {
    format: LIVE_PACKAGE_FORMAT,
    schema_version: 1,
    manifest,
    integrity: { algorithm: 'sha256', manifest_sha256: await livePackageSha256(canonicalLiveJson(manifest)) },
  };
  const envelopeBytes = encoder.encode(canonicalLiveJson(envelope));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, envelopeBytes.byteLength, false);
  return concat([
    encoder.encode(LIVE_PACKAGE_MAGIC_TEXT),
    length,
    envelopeBytes,
    imageBytes,
    imageBytes,
    imageBytes,
  ]);
}

class FakeClock {
  nowValue = 0;
  nextId = 1;
  timers = new Map();
  now = () => this.nowValue;
  setTimer = (callback, delay) => {
    const id = this.nextId++;
    this.timers.set(id, { callback, due: this.nowValue + Math.max(0, Number(delay) || 0) });
    return id;
  };
  clearTimer = id => { this.timers.delete(id); };
  jump(milliseconds) { this.nowValue += milliseconds; }
  advance(milliseconds) {
    const target = this.nowValue + milliseconds;
    while (true) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.due <= target)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!due) break;
      this.nowValue = due[1].due;
      this.timers.delete(due[0]);
      due[1].callback();
    }
    this.nowValue = target;
  }
}

function playerHarness(parsed) {
  const clock = new FakeClock();
  const events = { scenes: [], countdowns: [], states: [], narration: [], spoken: [], cancelled: 0 };
  const playback = createLocalLivePlayback(parsed);
  const player = createLocalLivePlayer(playback, {
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    tickMs: 100,
    narrator: {
      cancel: () => { events.cancelled += 1; },
      speak: script => { events.spoken.push(script); return 'thai'; },
    },
    onScene: event => events.scenes.push({ position: event.scene.position, transition: event.transition, reason: event.reason }),
    onCountdown: event => events.countdowns.push({ position: event.scenePosition, remainingMs: event.remainingMs }),
    onState: event => events.states.push({ phase: event.phase, reason: event.reason, position: event.scenePosition }),
    onNarration: event => events.narration.push(event),
  });
  return { clock, events, playback, player };
}

assert.equal(await sha256('public/live-center-package.js'), '0BDC88818EA1369614B0275B9442E1E0C17C17AE502614E2145BEE1D7AB26E35', 'package parser/runtime must remain byte-identical');
const packageBytes = await representativePackage();
const parsed = await parseVisionDLivePackage(packageBytes);
assert.equal(parsed.envelope.schema_version, 1);
assert.equal(parsed.manifest.runtime.livestream_launch, false);
assert.equal(parsed.manifest.scenes.length, 3);
assert.equal(parsed.assets.size, 3);

{
  const { clock, events, playback, player } = playerHarness(parsed);
  assert.equal(player.snapshot().phase, 'ready');
  assert.equal(clock.timers.size, 0, 'opening a valid package must not autoplay');
  assert.deepEqual(events.spoken, [], 'opening a valid package must not narrate before a click');
  player.start();
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง']);
  assert.equal(clock.timers.size, 1);
  const cancelsBeforeBoundaryNoop = events.cancelled;
  player.navigate(-1);
  assert.equal(events.cancelled, cancelsBeforeBoundaryNoop, 'no-op previous at scene 1 must not cancel narration');
  assert.equal(clock.timers.size, 1, 'no-op navigation must keep the active timer');
  clock.advance(4900);
  assert.equal(playback.currentScene().position, 0);
  clock.advance(100);
  assert.equal(playback.currentScene().position, 1);
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง']);
  assert.deepEqual(events.scenes.at(-1), { position: 1, transition: 'fade', reason: 'automatic' });
  clock.advance(6000);
  assert.equal(playback.currentScene().position, 2);
  assert.deepEqual(events.scenes.at(-1), { position: 2, transition: 'cut', reason: 'automatic' });
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง', 'บทพูดฉากสาม']);
  const countdownsBeforeEnd = [...events.countdowns];
  for (let index = 1; index < countdownsBeforeEnd.length; index += 1) {
    const before = countdownsBeforeEnd[index - 1];
    const current = countdownsBeforeEnd[index];
    if (before.position === current.position) assert.ok(current.remainingMs <= before.remainingMs, 'countdown must be monotonic within each scene entry');
  }
  clock.advance(7000);
  assert.equal(player.snapshot().phase, 'ended');
  assert.equal(player.snapshot().remainingMs, 0);
  assert.equal(playback.currentScene().position, 2, 'final scene must stop without wrapping');
  assert.equal(clock.timers.size, 0);
  const cancelAtEnd = events.cancelled;
  player.navigate(1);
  assert.equal(events.cancelled, cancelAtEnd, 'no-op next at final scene must not cancel anything');
  player.start();
  assert.equal(playback.currentScene().position, 0, 'play from ended state must replay scene 1');
  assert.equal(player.snapshot().phase, 'playing');
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง', 'บทพูดฉากสาม', 'บทพูดฉากหนึ่ง']);
  player.destroy();
  assert.equal(clock.timers.size, 0);
}

{
  const { clock, events, playback, player } = playerHarness(parsed);
  player.start();
  clock.advance(1000);
  player.stop();
  const pausedRemaining = player.snapshot().remainingMs;
  const speechCountAtPause = events.spoken.length;
  assert.equal(player.snapshot().phase, 'paused');
  assert.equal(clock.timers.size, 0);
  clock.advance(10000);
  assert.equal(player.snapshot().remainingMs, pausedRemaining);
  player.start();
  assert.equal(events.spoken.length, speechCountAtPause, 'stop then resume must not narrate the same scene entry twice');
  player.navigate(1);
  assert.equal(playback.currentScene().position, 1);
  assert.equal(player.snapshot().phase, 'playing');
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง']);
  player.stop();
  player.navigate(1);
  assert.equal(playback.currentScene().position, 2);
  assert.equal(player.snapshot().phase, 'paused');
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง'], 'paused manual navigation must wait for an explicit play click');
  player.start();
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง', 'บทพูดฉากสาม']);
  const cancelBeforeFinalNoop = events.cancelled;
  const timersBeforeFinalNoop = clock.timers.size;
  player.navigate(1);
  assert.equal(events.cancelled, cancelBeforeFinalNoop);
  assert.equal(clock.timers.size, timersBeforeFinalNoop);
  player.restart();
  assert.equal(playback.currentScene().position, 0);
  assert.equal(player.snapshot().phase, 'ready');
  assert.equal(clock.timers.size, 0);
  player.destroy();
}

{
  const { clock, events, playback, player } = playerHarness(parsed);
  player.start();
  clock.jump(5001);
  player.stop();
  assert.equal(playback.currentScene().position, 1, 'Stop must reconcile an expired throttled deadline to the next scene');
  assert.equal(player.snapshot().phase, 'paused');
  assert.equal(player.snapshot().remainingMs, 6000);
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง'], 'the next scene waits silently after an expired Stop action');
  assert.equal(clock.timers.size, 0, 'the throttled stale callback is cancelled');
  player.start();
  assert.deepEqual(events.spoken, ['บทพูดฉากหนึ่ง', 'บทพูดฉากสอง']);
  player.navigate(1);
  clock.jump(7001);
  player.stop();
  assert.equal(playback.currentScene().position, 2);
  assert.equal(player.snapshot().phase, 'ended', 'expired Stop on the final scene must end instead of replaying it silently');
  assert.equal(player.snapshot().remainingMs, 0);
  assert.equal(clock.timers.size, 0);
  player.destroy();
}

assert.equal(await createLocalSpeechNarrator({}).speak('บทพูดแบบไม่มี Web Speech'), 'unavailable');
{
  const utterances = [];
  let cancellations = 0;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const thai = { name: 'Thai Local', lang: 'th-TH' };
  const narrator = createLocalSpeechNarrator({
    SpeechSynthesisUtterance: FakeUtterance,
    speechSynthesis: {
      getVoices: () => [{ name: 'English', lang: 'en-US' }, thai],
      speak: utterance => utterances.push(utterance),
      cancel: () => { cancellations += 1; },
    },
  });
  assert.equal(await narrator.speak('บทพูดตรงจากแพ็กเกจ'), 'thai');
  assert.equal(utterances.length, 1);
  assert.equal(utterances[0].text, 'บทพูดตรงจากแพ็กเกจ');
  assert.equal(utterances[0].voice, thai);
  assert.equal(utterances[0].lang, 'th-TH');
  narrator.cancel();
  assert.equal(cancellations, 1);
}

console.log('v0.20.129 local three-scene playback, monotonic timer, replay, manual sync, narration and schema-v1 preservation checks passed');
