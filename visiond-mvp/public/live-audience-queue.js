export const LIVE_AUDIENCE_QUEUE_CAPACITY = 24;
export const LIVE_AUDIENCE_SOURCE_LABELS = Object.freeze({
  local_test: 'LOCAL TEST · ไม่ใช่เหตุการณ์จากแพลตฟอร์ม',
  facebook: 'FACEBOOK PAGE LIVE · ยืนยันโดยเซิร์ฟเวอร์',
});

const PRIORITIES = Object.freeze({ operator: 100, comment: 20, viewer_join: 10 });
const EVENT_ID = /^[a-z0-9][a-z0-9._:-]{7,127}$/i;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ANSWER_KINDS = new Set(['greeting', 'grounded', 'unknown']);
const SERVER_EVENT_KINDS = new Set(['comment', 'viewer_join']);

const normalizedEvent = event => {
  const id = String(event?.id || '');
  const source = String(event?.source || '');
  const kind = String(event?.kind || '');
  const productId = Number(event?.product_id);
  const answerKind = String(event?.answer_kind || '');
  const text = String(event?.answer_text || '');
  const receivedAt = String(event?.created_at || '');
  if (!EVENT_ID.test(id)
    || !Object.hasOwn(LIVE_AUDIENCE_SOURCE_LABELS, source)
    || !SERVER_EVENT_KINDS.has(kind)
    || !Number.isSafeInteger(productId) || productId < 1
    || !ANSWER_KINDS.has(answerKind)
    || (kind === 'viewer_join' ? answerKind !== 'greeting' : answerKind === 'greeting')
    || !text.trim() || text.length > 700 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
    || !ISO_INSTANT.test(receivedAt) || !Number.isFinite(Date.parse(receivedAt))) {
    throw new TypeError('Audience event is invalid');
  }
  return Object.freeze({
    id,
    source,
    sourceLabel: LIVE_AUDIENCE_SOURCE_LABELS[source],
    kind,
    priority: PRIORITIES[kind],
    productId,
    answerKind,
    text,
    receivedAt,
  });
};

export function createLiveAudienceQueue(options = {}) {
  const requestedCapacity = Number(options.capacity);
  const capacity = Number.isInteger(requestedCapacity)
    ? Math.min(LIVE_AUDIENCE_QUEUE_CAPACITY, Math.max(1, requestedCapacity))
    : LIVE_AUDIENCE_QUEUE_CAPACITY;
  const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
  const queue = [];
  const seen = new Map();
  let active = null;
  let generation = 0;

  const snapshot = () => ({
    capacity,
    queued: queue.length,
    active: active ? { id: active.id, source: active.source, kind: active.kind, productId: active.productId } : null,
    generation,
  });
  const emit = reason => onChange({ ...snapshot(), reason });
  const remember = id => {
    seen.set(id, true);
    while (seen.size > capacity * 4) seen.delete(seen.keys().next().value);
  };
  const sort = () => queue.sort((left, right) => right.priority - left.priority
    || left.receivedAt.localeCompare(right.receivedAt)
    || left.id.localeCompare(right.id));

  const enqueue = value => {
    const event = normalizedEvent(value);
    if (seen.has(event.id) || active?.id === event.id || queue.some(item => item.id === event.id)) return { accepted: false, reason: 'duplicate', event };
    if (queue.length >= capacity) {
      sort();
      const lowest = queue.reduce((candidate, item) => item.priority < candidate.priority ? item : candidate, queue[0]);
      if (!lowest || event.priority <= lowest.priority) {
        remember(event.id);
        emit('capacity-drop');
        return { accepted: false, reason: 'capacity', event };
      }
      queue.splice(queue.indexOf(lowest), 1);
      remember(lowest.id);
    }
    queue.push(event);
    remember(event.id);
    sort();
    emit('enqueue');
    return { accepted: true, reason: 'queued', event };
  };
  const take = () => {
    if (active || !queue.length) return null;
    sort();
    active = queue.shift();
    emit('take');
    return active;
  };
  const complete = id => {
    if (!active || active.id !== String(id || '')) return false;
    active = null;
    emit('complete');
    return true;
  };
  const clear = (reason = 'clear') => {
    generation += 1;
    queue.length = 0;
    active = null;
    seen.clear();
    emit(reason);
  };

  emit('load');
  return Object.freeze({ clear, complete, enqueue, snapshot, take });
}
