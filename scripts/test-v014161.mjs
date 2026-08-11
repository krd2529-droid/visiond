import fs from 'node:fs';
import assert from 'node:assert/strict';

const version=fs.readFileSync('VERSION.txt','utf8').trim();
const integrityHtml=fs.readFileSync('public/course-integrity.html','utf8');
const integrityUi=fs.readFileSync('public/course-integrity.js','utf8');
const integrityApi=fs.readFileSync('functions/api/admin/course-integrity.js','utf8');
const webhook=fs.readFileSync('functions/hooks/v1/[provider]/[publicId].js','utf8');

assert.equal(version,'v0.14.161');
assert.match(integrityHtml,/course-integrity\.js\?v=014161/);
assert.match(integrityUi,/AbortController/);
assert.match(integrityUi,/ระบบหยุดรอแล้วและไม่ค้างหน้าจอ/);
assert.match(integrityApi,/EVENT_CASE_QUERY_TIMEOUT/);
assert.doesNotMatch(webhook,/ensureWebhookHubSchema/);
assert.match(webhook,/if\(events\.length===0\)return out\(\{ok:true\},200\)/);
console.log('PASS v0.14.161 active tree integrity + LINE webhook');
