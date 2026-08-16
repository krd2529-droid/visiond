import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {maskedExternalId,SANDBOX_SCENARIOS,sandboxHash,sandboxPayload} from '../functions/_partner_sandbox.js';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [version,index,admin,page,ui,css,api,helper,migration,protocol,roadmap]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/partner-api.html','public/partner-api.js','public/partner-sandbox.css','functions/api/admin/partner-websites/[id]/sandbox.js','functions/_partner_sandbox.js','migrations/0048_partner_api_sandbox.sql','VISIOND-PARTNER-API-PROTOCOL.md','VISIOND-ROADMAP.md'].map(read));
assert.equal(version.trim(),'v0.14.217');assert.match(index,/WEB v0\.14\.217/);assert.match(admin,/ADMIN v0\.14\.217/);assert.match(page,/v0\.14\.217/);
assert.deepEqual(SANDBOX_SCENARIOS,['customer','order','payment','cancellation','refund']);
for(const scenario of SANDBOX_SCENARIOS){const payload=sandboxPayload({scenario,externalId:'ORDER-TEST-001'});assert.ok(payload);assert.equal(JSON.stringify(payload).includes('password'),false);assert.equal(JSON.stringify(payload).includes('access_token'),false)}
assert.equal(maskedExternalId('ORDER-123456'),'ORD•••56');assert.equal(maskedExternalId('abc'),'••••');assert.equal(await sandboxHash({scenario:'order',externalId:'A'}),await sandboxHash({scenario:'order',externalId:'A'}));assert.notEqual(await sandboxHash({scenario:'order',externalId:'A'}),await sandboxHash({scenario:'refund',externalId:'A'}));
for(const token of['partner_sandbox_runs','UNIQUE(website_id,idempotency_key)','request_hash','request_summary','response_summary','replayed'])assert.ok(migration.includes(token),token);
for(const token of['requireBoss','SANDBOX_SCOPE_MISSING','IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD','maskedExternalId','[REDACTED]','[MASKED]','ไม่เขียนข้อมูล Production'])assert.ok(api.includes(token),token);
assert.doesNotMatch(api,/INSERT INTO partner_customers|INSERT INTO partner_orders/);assert.ok(api.indexOf('maskedExternalId(row.external_id)')>=0);assert.ok(api.indexOf('maskedExternalId(row.idempotency_key)')>=0);
for(const token of['เปิด Sandbox','ส่งข้อมูลจำลอง','Idempotent Replay','ประวัติ Request / Response','customer','payment','cancellation','refund'])assert.ok(ui.includes(token),token);
assert.match(css,/@media\(max-width:700px\)/);assert.match(css,/sandbox-form/);assert.match(helper,/ensurePartnerSandboxSchema/);
for(const token of['Phase 3 Sandbox Contract','แยกจากข้อมูล Production','ปิดบัง Credential','Idempotency'])assert.ok(protocol.includes(token),token);assert.match(roadmap,/Partner API Phase 3 Sandbox/);
console.log('v0.14.217 Partner API phase 3 isolated masked sandbox replay conflict and mobile UI: PASS');
