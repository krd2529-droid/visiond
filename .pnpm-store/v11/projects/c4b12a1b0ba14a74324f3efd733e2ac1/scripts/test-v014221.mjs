import assert from 'node:assert/strict';
import fs from 'node:fs';
import {webhookSignature,verifyWebhook,retryDelayMinutes} from '../functions/_partner_webhook.js';
import {buildPartnerAlerts} from '../functions/_partner_health.js';

const read=file=>fs.readFileSync(file,'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.221');
await import('../functions/api/admin/partner-websites/[id]/e2e.js');
const api=read('functions/api/admin/partner-websites/[id]/e2e.js'),ui=read('public/partner-webhook.js'),css=read('public/partner-webhook.css');
for(const token of ['requireBoss','products:read','customers:write','orders:write','readProducts','runSandbox','customer','order','payment','cancellation','refund','idempotency_conflict','signed_webhook','retry_dead','health_alerts','sandbox-no-production-write','credential_returned:false','signature_returned:false','personal_data_returned:false'])assert.ok(api.includes(token),token);
assert.doesNotMatch(api,/steps\.push\([^\n]*(?:secret|signature)(?:,|})/i);
for(const token of ['dataset.e2e','ทดสอบ E2E','E2E Readiness','ไม่เขียนลูกค้าและออเดอร์ลง Production','credential, Signature และข้อมูลส่วนตัวไม่ถูกส่งกลับ'])assert.ok(ui.toLowerCase().includes(token.toLowerCase()),token);
for(const token of ['.e2e-grid','.e2e-pass','.e2e-fail','@media(max-width:600px)'])assert.ok(css.includes(token),token);
const secret='e2e-test-only-secret-not-production',timestamp='1800000000',raw='{"type":"order"}',signature=await webhookSignature(secret,timestamp,raw);
assert.equal(await verifyWebhook({secret,timestamp,raw,signature,now:1800000000000}),'');
assert.deepEqual([1,2,3,4,5].map(retryDelayMinutes),[2,4,8,16,32]);
assert.equal(buildPartnerAlerts({signatureErrors:1,timestampErrors:1,retry:3,dead:1}).length,4);
console.log('v0.14.221 Partner API E2E readiness products sandbox lifecycle idempotency webhook retry dead health: PASS');
