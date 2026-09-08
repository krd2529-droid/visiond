import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';

const monitorSource = await readFile(new URL('../workers/maintenance/src/d1-quota-monitor.js', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../workers/maintenance/src/index.js', import.meta.url), 'utf8');
const entry = `
import {runD1QuotaMonitor} from './d1-quota-monitor.js';
import {callMaintenanceJob} from './index.js';
const envFixture={APP_ORIGIN:'https://visiond.test',D1_QUOTA_BREAKER_TOKEN:'b'.repeat(40),CF_ACCOUNT_ID:'a'.repeat(32),CF_ACCOUNT_ANALYTICS_TOKEN:'c'.repeat(40)};
export default {async fetch(request){
  const path=new URL(request.url).pathname;
  try{
    if(path==='/monitor')return Response.json(await runD1QuotaMonitor(envFixture,{now:()=>Date.parse('2026-09-08T10:50:00.000Z'),randomUUID:()=> '00000000-0000-4000-8000-000000000001'}));
    if(path==='/maintenance')return Response.json(await callMaintenanceJob(fetch,'https://visiond.test',{name:'fixture',path:'/api/internal/job'},'m'.repeat(40)));
    return new Response('not found',{status:404});
  }catch(error){return Response.json({caught:String(error?.message||error)},{status:599})}
}};
`;

async function runCase(mode, path) {
  const seen = [];
  const mf = new Miniflare({
    modules: [
      { type: 'ESModule', path: 'entry.js', contents: entry },
      { type: 'ESModule', path: 'd1-quota-monitor.js', contents: monitorSource },
      { type: 'ESModule', path: 'index.js', contents: workerSource }
    ],
    outboundService: async request => {
      const url = new URL(request.url);
      const authorization = request.headers.get('authorization') || '';
      let body = null;
      try { body = await request.clone().json(); } catch {}
      seen.push({ url: url.href, authorization, body, redirectTarget: url.hostname === 'redirect.invalid' });
      if (url.hostname === 'redirect.invalid') return Response.json({ leaked: Boolean(authorization) });
      if (mode === 'control_redirect' && url.hostname === 'visiond.test') return new Response(null, { status: 302, headers: { location: 'https://redirect.invalid/control' } });
      if (mode === 'maintenance_redirect' && url.pathname === '/api/internal/job') return new Response(null, { status: 302, headers: { location: 'https://redirect.invalid/job' } });
      if (url.hostname === 'visiond.test') return Response.json(body?.action === 'claim' ? { claimed: true } : { quota_breaker: { auto_closed: false, control_available: true } });
      if (mode === 'graphql_redirect' && url.hostname === 'api.cloudflare.com') return new Response(null, { status: 302, headers: { location: 'https://redirect.invalid/graphql' } });
      if (url.hostname === 'api.cloudflare.com') return Response.json({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 123, rowsWritten: 4 } }] }] } } });
      return new Response('unexpected', { status: 500 });
    }
  });
  try {
    const response = await mf.dispatchFetch(`http://fixture${path}`);
    return { status: response.status, payload: await response.json(), seen };
  } finally {
    await mf.dispose();
  }
}

let result = await runCase('control_redirect', '/monitor');
assert.equal(result.status, 599);
assert.equal(result.payload.caught, 'D1_QUOTA_CONTROL_REDIRECT_REFUSED');
assert.equal(result.seen.length, 1);
assert.equal(result.seen[0].url, 'https://visiond.test/api/internal/d1-quota-breaker');
assert.match(result.seen[0].authorization, /^Bearer /);
assert.equal(result.seen.some(x => x.redirectTarget), false);

result = await runCase('graphql_redirect', '/monitor');
assert.equal(result.status, 200);
assert.equal(result.payload.error, 'CF_ANALYTICS_REDIRECT_REFUSED');
assert.equal(result.seen.filter(x => x.url.startsWith('https://api.cloudflare.com/')).length, 1);
assert.equal(result.seen.some(x => x.redirectTarget), false);

result = await runCase('success', '/monitor');
assert.equal(result.status, 200);
assert.equal(result.payload.ok, true);
assert.equal(result.payload.skipped, false);
assert.equal(result.seen.length, 3);

result = await runCase('maintenance_redirect', '/maintenance');
assert.equal(result.status, 599);
assert.equal(result.payload.caught, 'fixture_REDIRECT_REFUSED');
assert.equal(result.seen.length, 1);
assert.equal(result.seen.some(x => x.redirectTarget), false);
assert.match(result.seen[0].authorization, /^Bearer /);

console.log('PASS workerd redirect gate: manual 3xx refusal, no auth forwarding, successful monitor claim/sample');
