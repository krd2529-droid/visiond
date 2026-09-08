import assert from 'node:assert/strict';
import { callMaintenanceJob, parseAppOrigin, runMaintenance } from '../workers/maintenance/src/index.js';

const secretA = 'a'.repeat(32), secretB = 'b'.repeat(32), secretC = 'c'.repeat(32);
assert.equal(parseAppOrigin('https://visiondonline.com'), 'https://visiondonline.com');
for (const invalid of ['', 'http://visiondonline.com', 'https://user:x@visiondonline.com', 'https://visiondonline.com/path', 'https://visiondonline.com?x=1']) {
  assert.throws(() => parseAppOrigin(invalid), /APP_ORIGIN_INVALID/);
}

const requests = [];
const successFetch = async (url, init) => {
  requests.push({ url, init });
  return new Response('{}', { status: 200 });
};
const results = await runMaintenance({ APP_ORIGIN: 'https://visiondonline.com', ELON_CLEANUP_TOKEN: secretA, ANALYTICS_CLEANUP_TOKEN: secretB, SEO_AUTOMATION_TOKEN: secretC }, successFetch);
assert.equal(results.length, 3);
assert.deepEqual(requests.map(x => new URL(x.url).pathname).sort(), ['/api/internal/analytics-retention', '/api/internal/daily-seo-pages', '/api/internal/elon-retention']);
assert.equal(requests.every(x => x.init.method === 'POST' && x.init.redirect === 'manual'), true);
assert.deepEqual(new Set(requests.map(x => x.init.headers.authorization)), new Set([`Bearer ${secretA}`, `Bearer ${secretB}`, `Bearer ${secretC}`]));

await assert.rejects(() => runMaintenance({ APP_ORIGIN: 'https://visiondonline.com', ELON_CLEANUP_TOKEN: 'short', ANALYTICS_CLEANUP_TOKEN: secretB, SEO_AUTOMATION_TOKEN: secretC }, successFetch), /ELON_CLEANUP_TOKEN_INVALID/);
await assert.rejects(() => runMaintenance({ APP_ORIGIN: 'https://visiondonline.com', ELON_CLEANUP_TOKEN: secretA, ANALYTICS_CLEANUP_TOKEN: secretB, SEO_AUTOMATION_TOKEN: secretA }, successFetch), /TOKENS_MUST_DIFFER/);

let attempts = 0;
const retryFetch = async () => {
  attempts += 1;
  return attempts < 3 ? new Response('', { status: 503 }) : new Response(null, { status: 204 });
};
const retried = await callMaintenanceJob(retryFetch, 'https://visiondonline.com', { name: 'test', path: '/internal' }, secretA);
assert.equal(retried.attempts, 3);

attempts = 0;
await assert.rejects(() => callMaintenanceJob(async () => { attempts += 1; return new Response('', { status: 401 }); }, 'https://visiondonline.com', { name: 'test', path: '/internal' }, secretA), /HTTP_401/);
assert.equal(attempts, 1);

attempts = 0;
await assert.rejects(() => callMaintenanceJob(async (_url,init) => { attempts += 1;assert.equal(init.redirect,'manual'); return new Response('', { status: 302,headers:{location:'https://attacker.invalid/'} }); }, 'https://visiondonline.com', { name: 'test', path: '/internal' }, secretA), /REDIRECT_REFUSED/);
assert.equal(attempts, 1);

attempts = 0;
await assert.rejects(() => callMaintenanceJob(async () => { attempts += 1; throw new Error('contains-secret-' + secretA); }, 'https://visiondonline.com', { name: 'test', path: '/internal' }, secretA), /test_NETWORK/);
assert.equal(attempts, 3);

console.log('maintenance Worker tests passed');
