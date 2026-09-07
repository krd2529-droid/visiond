// Same-origin, memory-only identity. Never authorize UI from browser storage.
const TTL = 30_000;
let user = null, expires = 0, pending = null, generation = 0, timer, loggedOut = false;
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener(document.visibilityState === 'hidden' ? null : user));
export function subscribeAuth(listener) {
  listeners.add(listener);
  listener(document.visibilityState !== 'hidden' && expires > Date.now() ? user : null);
  return () => listeners.delete(listener);
}
export function invalidateAuth() {
  generation++;
  pending = null;
  user = null;
  expires = 0;
  clearTimeout(timer);
  emit();
}
export function getSession() {
  if (loggedOut) return Promise.resolve(null);
  if (pending) return pending;
  if (expires > Date.now()) return Promise.resolve(user);
  user = null;
  emit();
  const revision = generation;
  pending = (async () => {
    let confirmed = null, remaining = 0;
    const started = Date.now();
    try {
      const response = await fetch('/api/auth/me', {cache:'no-store', credentials:'same-origin'});
      if (response.ok) {
        const data = await response.json();
        confirmed = data?.user || null;
        const deadline = Date.parse(String(data.session_expires_at || '').replace(' ', 'T').replace(/(?<=\d)$/, 'Z'));
        remaining = deadline - Date.parse(data.server_time) - (Date.now() - started);
        if (confirmed?.role === 'boss' && !(remaining > 0)) confirmed = null;
      }
    } catch {}
    if (revision !== generation) return null;
    user = confirmed;
    expires = Date.now() + Math.min(TTL, remaining > 0 ? remaining : TTL);
    pending = null;
    emit();
    // Remove at the server's expiry, without background database polling.
    clearTimeout(timer);
    if (user?.role === 'boss') {
      const deadline = Date.now() + remaining;
      const expire = () => {
        const delay = deadline - Date.now();
        if (delay <= 0) invalidateAuth();
        else timer = setTimeout(expire, Math.min(delay, 2_147_483_647));
      };
      expire();
    }
    return user;
  })();
  return pending;
}
const revalidate = () => { invalidateAuth(); if (document.visibilityState !== 'hidden') getSession(); };
window.addEventListener('pageshow', event => { if (event.persisted) revalidate(); });
window.addEventListener('pagehide', invalidateAuth);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') listeners.forEach(listener => listener(null));
  else getSession().then(() => emit());
});
// Events invalidate only: their payload can never grant a role.
window.addEventListener('visiond:authchange', () => { loggedOut = false; revalidate(); });
const revokeSession = () => { loggedOut = true; invalidateAuth(); };
window.addEventListener('visiond:logout', revokeSession);
window.addEventListener('storage', event => { if (event.key === 'visiond:auth-invalidated') revokeSession(); });
export function clearSession() {
  revokeSession();
  try { localStorage.setItem('visiond:auth-invalidated', String(Date.now())); } catch {}
}
