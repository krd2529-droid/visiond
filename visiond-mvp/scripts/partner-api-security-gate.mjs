import assert from 'node:assert/strict';
import fs from 'node:fs';

const files=['VISIOND-PARTNER-API-PROTOCOL.md','docs/PARTNER-API-WEB2-INTEGRATION.md','docs/examples/partner-api-web2.http','functions/_partner_api.js','functions/_partner_sync.js','functions/_partner_webhook.js','functions/api/partner/v1/customers/sync.js','functions/api/partner/v1/orders/sync.js','functions/api/admin/partner-websites/[id]/e2e.js'];
const source=files.map(file=>fs.readFileSync(file,'utf8')).join('\n');
const examples=fs.readFileSync('docs/examples/partner-api-web2.http','utf8');
for(const token of ['<CLIENT_ID_FROM_SECRET_MANAGER>','<CLIENT_SECRET_FROM_SECRET_MANAGER>','<UNIX_SECONDS>','<HMAC_SHA256_HEX>'])assert.ok(examples.includes(token),`placeholder missing: ${token}`);
assert.doesNotMatch(examples,/\bvdw_[a-f0-9]{20,}\b/i,'พบ Client ID รูปแบบจริงในตัวอย่าง');
assert.doesNotMatch(examples,/\bvds_[a-f0-9]{20,}\b/i,'พบ Client Secret รูปแบบจริงในตัวอย่าง');
assert.doesNotMatch(source,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,'พบ Private Key');
assert.doesNotMatch(source,/\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/,'พบเลขบัตรที่อาจเป็นค่าจริง');
for(const token of ['FORBIDDEN_SENSITIVE_FIELD','password','access_token','client_secret','card_number','bank_account'])assert.ok(source.toLowerCase().includes(token.toLowerCase()),`security contract missing: ${token}`);
for(const token of ['credential_returned:false','signature_returned:false','personal_data_returned:false','sandbox-no-production-write'])assert.ok(source.includes(token),`E2E safety missing: ${token}`);
console.log(`Partner API security gate: PASS (${files.length} files, placeholders only, no credential/card/private key)`);
