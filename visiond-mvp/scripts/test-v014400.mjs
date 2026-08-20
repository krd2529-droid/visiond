import fs from 'node:fs';
import assert from 'node:assert/strict';
import {ensurePartnerSandboxReady} from '../functions/_partner_sandbox.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.400');
assert.match(read('public/index.html'),/WEB v0\.14\.400/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.400/);

const calls=[];
const DB={prepare(sql){calls.push(sql);return {first:async()=>({version:66})}},async exec(){throw new Error('PARTNER_SANDBOX_DDL_MUST_NOT_RUN')}};
assert.equal(await ensurePartnerSandboxReady({DB}),true);
assert.equal(await ensurePartnerSandboxReady({DB}),true);
assert.deepEqual(calls,["SELECT version FROM runtime_schema_state WHERE schema_key='core'"],'sandbox must share one ready probe per isolate');

assert.match(read('functions/_partner_sandbox.js'),/ensurePartnerSandboxReady\(env\).*ensurePartnerSchema\(env\)/);
assert.match(read('functions/api/admin/partner-websites/[id]/sandbox.js'),/ensurePartnerSandboxReady as ensurePartnerSandboxSchema/);
console.log('PASS v0.14.400 partner sandbox schema hot-path guard');
