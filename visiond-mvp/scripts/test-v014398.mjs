import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ensurePartnerHealthSchema} from '../functions/_partner_health.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.398');
assert.match(read('public/index.html'),/WEB v0\.14\.398/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.398/);

const calls=[];
const DB={prepare(sql){calls.push(sql);return {first:async()=>({version:66})}},async exec(){throw new Error('PARTNER_DDL_MUST_NOT_RUN')}};
assert.equal(await ensurePartnerHealthSchema({DB}),true);
assert.equal(await ensurePartnerHealthSchema({DB}),true);
assert.deepEqual(calls,["SELECT version FROM runtime_schema_state WHERE schema_key='core'"],'health schema must share one ready probe per isolate');

const health=read('functions/_partner_health.js');
assert.match(health,/if\(await ensurePartnerSchema\(env\)\)return true/);
assert.match(health,/PRAGMA table_info\(partner_webhook_events\)/,'legacy fallback must remain for databases without runtime state');
console.log('PASS v0.14.398 partner health schema hot-path guard');
