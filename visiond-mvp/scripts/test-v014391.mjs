import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.391');
assert.match(read('public/index.html'),/WEB v0\.14\.391/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.391/);

const view=read('functions/api/analytics/view.js');
const post=view.match(/export async function onRequestPost[\s\S]*?\n}\n\nexport async function onRequestGet/)?.[0]||'';
assert.match(post,/if\(isBot\)return json\(\{ok:true,counted:false,bot:true\}/);
assert.ok(post.indexOf('if(isBot)')<post.indexOf('ensureDatabase(ctx.env)'),'Bot must exit before D1 setup');
assert.doesNotMatch(post,/viewStats\(/,'POST view must not calculate live stats');
assert.doesNotMatch(post,/analyticsStats\(/,'POST view must not scan analytics totals');
assert.match(post,/return json\(\{ok:true,counted:!duplicate\}/);

const analytics=read('public/analytics.js');
assert.match(analytics,/const viewRequest=fetch\('\/api\/analytics\/view'/);
assert.match(analytics,/viewRequest\.then\(result=>result\.bot\?\{\}:fetch/,'Bot must not request stats');
assert.match(analytics,/viewRequest\.then\(result=>\{if\(result\.bot\)return;/,'Bot must not emit customer events');
assert.match(analytics,/if\(businessEvent\)\{window\.visiondTrack\(businessEvent\);return}/);

const promo=read('public/promo-banner.js');
assert.match(promo,/setTimeout\(\(\)=>\{const shared=window\.__visiondAnalyticsStats/,'Promo must wait for the shared request');
assert.match(promo,/if\(shared\)shared\.then\(paintStats\)/);
assert.match(promo,/else fetch\('\/api\/analytics\/view'/,'Promo-only pages must retain their stats fallback');

console.log('PASS v0.14.391 analytics request deduplication');
