export const LIVE_PHOTO_AVATAR_PHASES = Object.freeze([
  'disconnected',
  'connecting',
  'ready',
  'speaking',
  'stopped',
  'error',
]);

const PHASES = new Set(LIVE_PHOTO_AVATAR_PHASES);
const noop = () => {};

const pauseVideo = video => {
  if (!video) return;
  try { video.pause?.(); } catch {}
  try { video.srcObject = null; } catch {}
  video.hidden = true;
};

export function createExactAudioAvatarController(options = {}) {
  const previewVideo = options.previewVideo || null;
  const obsVideo = options.obsVideo || null;
  const AudioContextCtor = options.AudioContextCtor
    || globalThis.AudioContext
    || globalThis.webkitAudioContext;
  const requestFrame = options.requestFrame
    || globalThis.requestAnimationFrame?.bind(globalThis)
    || (callback => globalThis.setTimeout(callback, 16));
  const cancelFrame = options.cancelFrame
    || globalThis.cancelAnimationFrame?.bind(globalThis)
    || globalThis.clearTimeout?.bind(globalThis)
    || noop;
  const onState = typeof options.onState === 'function' ? options.onState : noop;
  const threshold = Number.isFinite(Number(options.audioThreshold))
    ? Math.min(0.25, Math.max(0.005, Number(options.audioThreshold)))
    : 0.018;

  let epoch = 0;
  let phase = 'disconnected';
  let reason = 'load';
  let sessionId = '';
  let speaking = false;
  let destroyed = false;
  let stream = null;
  let audioContext = null;
  let sourceNode = null;
  let analyser = null;
  let samples = null;
  let frame = null;
  let audioTrack = null;
  let trackedTracks = [];
  let endedHandlers = [];

  const snapshot = () => Object.freeze({ phase, reason, sessionId, speaking, epoch });
  const emit = nextReason => {
    reason = nextReason || reason;
    if (!PHASES.has(phase)) throw new Error('Invalid photo avatar phase');
    onState(snapshot());
  };
  const setPhase = (next, nextReason) => {
    phase = next;
    speaking = next === 'speaking';
    emit(nextReason);
  };
  const resetMedia = ({ stopTracks = true } = {}) => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    for (let index = 0; index < trackedTracks.length; index += 1) {
      try { trackedTracks[index]?.removeEventListener?.('ended', endedHandlers[index]); } catch {}
    }
    trackedTracks = [];
    endedHandlers = [];
    audioTrack = null;
    try { sourceNode?.disconnect?.(); } catch {}
    try { analyser?.disconnect?.(); } catch {}
    sourceNode = null;
    analyser = null;
    samples = null;
    const oldContext = audioContext;
    audioContext = null;
    try { oldContext?.close?.(); } catch {}
    const oldStream = stream;
    stream = null;
    if (stopTracks) {
      try { for (const track of oldStream?.getTracks?.() || []) track.stop?.(); } catch {}
    }
    pauseVideo(previewVideo);
    pauseVideo(obsVideo);
  };

  const stop = (nextReason = 'stopped') => {
    if (destroyed) return snapshot();
    epoch += 1;
    resetMedia();
    sessionId = '';
    setPhase('stopped', nextReason);
    return snapshot();
  };

  const fail = (nextReason = 'error') => {
    if (destroyed) return snapshot();
    epoch += 1;
    resetMedia();
    sessionId = '';
    setPhase('error', nextReason);
    return snapshot();
  };

  const connect = async (mediaStream, { id = '' } = {}) => {
    if (destroyed) throw new Error('Photo avatar controller is destroyed');
    const tracks = Array.from(mediaStream?.getTracks?.() || []);
    const audioTracks = Array.from(mediaStream?.getAudioTracks?.() || []);
    const videoTracks = Array.from(mediaStream?.getVideoTracks?.() || []);
    const exactMediaContract = tracks.length === 2
      && audioTracks.length === 1
      && videoTracks.length === 1
      && audioTracks[0]?.readyState === 'live'
      && videoTracks[0]?.readyState === 'live';
    if (!exactMediaContract || typeof AudioContextCtor !== 'function') {
      try { for (const track of tracks) track.stop?.(); } catch {}
      fail('media-contract-invalid');
      throw new TypeError('Photo avatar requires one live audio track, one live video track, and AudioContext');
    }
    epoch += 1;
    const ticket = epoch;
    resetMedia();
    stream = mediaStream;
    sessionId = String(id || '');
    setPhase('connecting', 'media-attaching');

    try {
      audioContext = new AudioContextCtor();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.35;
      sourceNode = audioContext.createMediaStreamSource(mediaStream);
      sourceNode.connect(analyser);
      samples = new Uint8Array(analyser.fftSize);
      audioTrack = audioTracks[0];
      trackedTracks = [audioTracks[0], videoTracks[0]];
      endedHandlers = trackedTracks.map(track => {
        const handler = () => { if (ticket === epoch) stop(track === audioTrack ? 'audio-ended' : 'video-ended'); };
        track.addEventListener?.('ended', handler, { once: true });
        return handler;
      });

      for (const [video, muted] of [[previewVideo, true], [obsVideo, false]]) {
        if (!video) continue;
        video.autoplay = true;
        video.playsInline = true;
        video.muted = muted;
        video.srcObject = mediaStream;
        video.hidden = false;
        Promise.resolve(video.play?.()).catch(() => {
          if (ticket === epoch) fail('media-play-rejected');
        });
      }
      await Promise.resolve(audioContext.resume?.());
      if (ticket !== epoch || destroyed) return snapshot();
      setPhase('ready', 'audio-silent');

      const tick = () => {
        if (ticket !== epoch || destroyed || !analyser || !samples) return;
        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          energy += centered * centered;
        }
        const audible = Math.sqrt(energy / samples.length) >= threshold
          && audioTrack?.readyState !== 'ended'
          && audioTrack?.enabled !== false;
        if (audible !== speaking) setPhase(audible ? 'speaking' : 'ready', audible ? 'audio-signal' : 'audio-silent');
        frame = requestFrame(tick);
      };
      frame = requestFrame(tick);
      return snapshot();
    } catch (error) {
      if (ticket === epoch) fail('media-connect-failed');
      throw error;
    }
  };

  const setConnecting = (nextReason = 'session-request') => {
    if (destroyed) return snapshot();
    epoch += 1;
    resetMedia();
    sessionId = '';
    setPhase('connecting', nextReason);
    return snapshot();
  };

  const destroy = () => {
    if (destroyed) return;
    epoch += 1;
    resetMedia();
    destroyed = true;
    phase = 'stopped';
    speaking = false;
    sessionId = '';
  };

  emit('load');
  return Object.freeze({ connect, destroy, fail, setConnecting, snapshot, stop });
}
