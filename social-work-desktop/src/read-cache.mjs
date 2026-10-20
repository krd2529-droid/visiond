export class RequestCache {
  constructor(ttlMs = 5000) { this.ttlMs = ttlMs; this.values = new Map(); this.pending = new Map(); this.revisions = new Map(); }
  get(key,fn) {
    const cached = this.values.get(key);
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
    if (this.pending.has(key)) return this.pending.get(key);
    const revision = this.revisions.get(key) || 0;
    const promise = Promise.resolve().then(fn).then(value => {
      if ((this.revisions.get(key) || 0) === revision) this.values.set(key,{value,until:Date.now()+this.ttlMs});
      return value;
    }).finally(() => { if (this.pending.get(key) === promise) this.pending.delete(key); });
    this.pending.set(key,promise);
    return promise;
  }
  invalidate(matches) {
    const keys = new Set([...this.values.keys(),...this.pending.keys()]);
    for (const key of keys) if (matches(key)) {
      this.revisions.set(key,(this.revisions.get(key) || 0)+1);
      this.values.delete(key);
      this.pending.delete(key);
    }
  }
}
