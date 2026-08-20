import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.394');
assert.match(read('public/index.html'),/WEB v0\.14\.394/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.394/);

const analytics=read('functions/_analytics.js');
assert.match(analytics,/SELECT unique_visitors count FROM analytics_summary WHERE summary_key='site'/);
assert.doesNotMatch(analytics,/SELECT COUNT\(\*\) count FROM \(SELECT visitor_key FROM analytics_visitors UNION/);

const view=read('functions/api/analytics/view.js');
const get=view.match(/export async function onRequestGet[\s\S]*$/)?.[0]||'';
assert.match(view,/const STATS_CACHE_SECONDS=300/);
assert.ok(get.indexOf('cache.match(cacheKey)')<get.indexOf('ensureDatabase(ctx.env)'),'cache hit must precede D1 readiness');
assert.ok(get.indexOf('cache.match(cacheKey)')<get.indexOf('rateLimitIdentity'),'cache hit must precede D1 rate limit');
assert.match(get,/public, max-age=60, s-maxage=\$\{STATS_CACHE_SECONDS\}, stale-while-revalidate=60/);
assert.match(get,/const write=cache\.put\(cacheKey,response\.clone\(\)\)/);

const schema=read('functions/_schema.js');
assert.match(schema,/const RUNTIME_SCHEMA_VERSION=66/);
assert.match(schema,/CREATE TRIGGER IF NOT EXISTS trg_analytics_visitors_summary AFTER INSERT ON analytics_visitors/);
const migration=read('migrations/0066_analytics_summary.sql');
assert.match(migration,/SELECT 'site',COUNT\(\*\) FROM analytics_visitors WHERE true/);
assert.match(migration,/AFTER INSERT ON analytics_visitors/);
assert.match(migration,/VALUES\('core',66\)/);

assert.doesNotMatch(read('public/analytics.js'),/fetch\(`\/api\/analytics\/view[^\n]*cache:'no-store'/);
assert.doesNotMatch(read('public/promo-banner.js'),/fetch\('\/api\/analytics\/view',\{cache:'no-store'\}\)/);
assert.match(read('FEATURE-MAP.md'),/CUSTOMER-INTELLIGENCE-001[\s\S]*?analytics_summary/);

console.log('PASS v0.14.394 analytics summary and cache');
