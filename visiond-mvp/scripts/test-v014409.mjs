import assert from 'node:assert/strict';
import fs from 'node:fs';
import {ensurePartnerCommerceSchema} from '../functions/_partner_commerce.js';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const create=read('functions/api/partner/v1/commerce/orders/index.js');
const status=read('functions/api/partner/v1/commerce/orders/[externalId].js');
const migration=read('migrations/0067_partner_digital_commerce.sql');

assert.equal(read('VERSION.txt').trim(),'v0.14.409');
assert.match(read('public/index.html'),/WEB v0\.14\.409/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.409/);
assert.match(read('functions/_partner_api.js'),/'commerce:read','commerce:write'/);
assert.match(read('public/partner-api.html'),/partner-api\.js\?v=014409/);
assert.match(create,/requirePartnerScope\(ctx,'commerce:write'\)/);
assert.match(create,/items\.length>100/);
assert.match(create,/SELECT id,title,price FROM products WHERE id IN/);
assert.match(create,/status:'pending_payment'/);
assert.match(create,/idempotencyCheck/);
assert.doesNotMatch(create,/INSERT INTO entitlements|status:'paid'|status:'fulfilled'|api_fee/);
assert.match(status,/requirePartnerScope\(ctx,'commerce:read'\)/);
assert.match(status,/WHERE website_id=\? AND external_order_id=\? LIMIT 1/);
assert.match(status,/ORDER BY line_index LIMIT 100/);
assert.match(migration,/VALUES\('core',67\)/);
assert.match(migration,/UNIQUE\(website_id,external_order_id\)/);

const calls=[];const DB={prepare(sql){calls.push(sql);return{first:async()=>({version:67})}},exec:async()=>{throw new Error('COMMERCE_DDL_MUST_NOT_RUN')}};
assert.equal(await ensurePartnerCommerceSchema({DB}),true);
assert.equal(await ensurePartnerCommerceSchema({DB}),true);
assert.equal(calls.filter(sql=>sql.includes('runtime_schema_state')).length,2,'core and commerce readiness each probe once per isolate');

console.log('PASS v0.14.409 Web 2 commerce order create/status boundary');
