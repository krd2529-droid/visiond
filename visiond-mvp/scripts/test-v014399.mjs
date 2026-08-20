import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ensurePartnerSyncReady} from '../functions/_partner_sync.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.399');
assert.match(read('public/index.html'),/WEB v0\.14\.399/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.399/);

const calls=[];
const DB={prepare(sql){calls.push(sql);return {first:async()=>({version:66})}},async exec(){throw new Error('PARTNER_SYNC_DDL_MUST_NOT_RUN')}};
assert.equal(await ensurePartnerSyncReady({DB}),true);
assert.equal(await ensurePartnerSyncReady({DB}),true);
assert.deepEqual(calls,["SELECT version FROM runtime_schema_state WHERE schema_key='core'"],'sync must share one ready probe per isolate');

for(const path of ['functions/api/partner/v1/customers/sync.js','functions/api/partner/v1/orders/sync.js','functions/api/admin/partner-websites/[id]/data.js']){
  assert.match(read(path),/ensurePartnerSyncReady as ensurePartnerSyncSchema/,`${path} must use guarded sync readiness`);
}
assert.match(read('functions/_partner_sync.js'),/ensurePartnerSyncReady\(env\).*ensurePartnerSchema\(env\)/);
console.log('PASS v0.14.399 partner sync schema hot-path guard');
