const JOBS = [
  { name: 'elon-retention', path: '/api/internal/elon-retention', token: 'ELON_CLEANUP_TOKEN' },
  { name: 'analytics-retention', path: '/api/internal/analytics-retention', token: 'ANALYTICS_CLEANUP_TOKEN' }
];
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;

export function parseAppOrigin(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { throw new Error('APP_ORIGIN_INVALID'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('APP_ORIGIN_INVALID');
  }
  return url.origin;
}

function readToken(env, name) {
  const token = String(env?.[name] || '');
  if (token.length < 32 || token.length > 512) throw new Error(`${name}_INVALID`);
  return token;
}

const retryableStatus = status => status === 408 || status === 429 || status >= 500;

export async function callMaintenanceJob(fetcher, origin, job, token) {
  const endpoint = new URL(job.path, origin).toString();
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetcher(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal
      });
      if (response.ok) return { name: job.name, ok: true, attempts: attempt };
      lastError = new Error(`${job.name}_HTTP_${response.status}`);
      if (!retryableStatus(response.status)) break;
    } catch (error) {
      lastError = error?.name === 'AbortError' ? new Error(`${job.name}_TIMEOUT`) : new Error(`${job.name}_NETWORK`);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`${job.name}_FAILED`);
}

export async function runMaintenance(env, fetcher = fetch) {
  const origin = parseAppOrigin(env?.APP_ORIGIN);
  const credentials = JOBS.map(job => ({ job, token: readToken(env, job.token) }));
  if (credentials[0].token === credentials[1].token) throw new Error('MAINTENANCE_TOKENS_MUST_DIFFER');
  const results = await Promise.allSettled(credentials.map(({ job, token }) => callMaintenanceJob(fetcher, origin, job, token)));
  const failures = results.filter(result => result.status === 'rejected');
  if (failures.length) throw new Error(`MAINTENANCE_FAILED_${failures.length}`);
  return results.map(result => result.value);
}

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runMaintenance(env));
  }
};
