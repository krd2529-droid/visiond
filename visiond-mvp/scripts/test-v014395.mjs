import fs from 'node:fs';
import assert from 'node:assert/strict';
import {recordPageView} from '../functions/_analytics.js';
import {edgeTelemetryDuplicate,edgeTelemetryLimit,rememberEdgeTelemetry,resetEdgeTelemetryForTest} from '../functions/_edge_telemetry.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.395');
assert.match(read('public/index.html'),/WEB v0\.14\.395/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.395/);

resetEdgeTelemetryForTest();
const request=new Request('https://visiond.test/api/analytics/view',{headers:{'CF-Connecting-IP':'203.0.113.7'}});
assert.ok((await edgeTelemetryLimit(request,'test',2,60)).ok);
assert.ok((await edgeTelemetryLimit(request,'test',2,60)).ok);
const blocked=await edgeTelemetryLimit(request,'test',2,60);
assert.equal(blocked.error.status,429);
assert.equal(await edgeTelemetryDuplicate(request,'view|visitor|/|'),false);
await rememberEdgeTelemetry(request,'view|visitor|/|',1800);
assert.equal(await edgeTelemetryDuplicate(request,'view|visitor|/|'),true);

const statements=[];
const DB={prepare(sql){return {bind(...values){return {sql,values}}}},async batch(items){statements.push(...items)}};
await recordPageView({DB},{path:'/',productId:0,visitorKey:'visitor'});
assert.equal(statements.length,2,'counted page view must use two explicit D1 writes');
assert.ok(statements.some(x=>x.sql.includes('analytics_daily')));
assert.ok(statements.some(x=>x.sql.includes('analytics_visitors')));
assert.ok(statements.every(x=>!x.sql.includes('INSERT INTO page_views')));

for(const file of ['functions/api/analytics/view.js','functions/api/analytics/event.js']){
  const source=read(file);
  assert.doesNotMatch(source,/rateLimitIdentity/);
  assert.doesNotMatch(source,/security_rate_limits/);
}
assert.doesNotMatch(read('functions/api/analytics/view.js'),/SELECT id FROM page_views WHERE visitor_key/);
assert.doesNotMatch(read('functions/api/analytics/event.js'),/SELECT id FROM customer_events WHERE event_type/);
assert.match(read('functions/api/auth/login.js'),/rateLimitIdentity/,'strict auth limiter must remain');
assert.match(read('FEATURE-MAP.md'),/CUSTOMER-INTELLIGENCE-001[\s\S]*?edge cache หรือ memory ต่อ isolate/);

console.log('PASS v0.14.395 analytics write reduction');
