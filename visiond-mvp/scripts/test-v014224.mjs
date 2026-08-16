import assert from 'node:assert/strict';
import fs from 'node:fs';
import {V14_RIGHTS,canSellWithRights} from '../functions/_vision14.js';

const read=file=>fs.readFileSync(file,'utf8');
const html=read('public/vision14-library.html'),js=read('public/vision14-library.js'),css=read('public/vision14-library.css');
const api=read('functions/api/admin/vision14-sources/index.js'),updateApi=read('functions/api/admin/vision14-sources/[id].js'),migration=read('migrations/0052_vision14_source_library.sql');
assert.equal(read('VERSION.txt').trim(),'v0.14.224');
assert.deepEqual(V14_RIGHTS,['owned','plr','public_domain','licensed','reference_only']);
assert.equal(canSellWithRights('owned'),true);assert.equal(canSellWithRights('plr'),true);assert.equal(canSellWithRights('public_domain'),true);assert.equal(canSellWithRights('licensed'),true);assert.equal(canSellWithRights('reference_only'),false);assert.equal(canSellWithRights('unknown'),false);
assert.match(api,/requireBoss/);assert.match(updateApi,/requireBoss/);assert.match(api,/100\*1024\*1024/);assert.match(api,/application\/pdf/);assert.match(api,/ctx\.env\.FILES\.put/);assert.match(api,/ctx\.env\.FILES\.delete/);
assert.match(api,/rights==='licensed'&&!note/);assert.match(updateApi,/rights==='licensed'&&!note/);assert.match(migration,/sale_eligible INTEGER NOT NULL DEFAULT 0/);
assert.match(html,/id="sourceForm"/);assert.match(html,/id="reloadSources"/);assert.match(js,/form\.onsubmit/);assert.match(js,/reload\.onclick=load/);assert.match(js,/method:'PUT'/);assert.match(js,/button\.disabled=true/);assert.match(js,/role="status"/);assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/\.source-actions button\{width:100%/);
assert.match(read('public/admin.html'),/href="\/vision14-library\.html"/);
console.log('v0.14.224 Vision 14 source library rights gate upload UI mobile and Boss API contracts: PASS');
