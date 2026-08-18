import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

const read=file=>fs.readFileSync(file,'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.222');
const guide=read('docs/PARTNER-API-WEB2-INTEGRATION.md'),examples=read('docs/examples/partner-api-web2.http'),page=read('public/partner-api.html'),protocol=read('VISIOND-PARTNER-API-PROTOCOL.md');
for(const token of ['products:read','customers:write','orders:write','Idempotency-Key','HMAC_SHA256','Checklist ก่อนใช้งานจริง','security:partner-api','Rollback'])assert.ok(guide.includes(token),token);
for(const token of ['/products','/customers/sync','/orders/sync','/webhooks/events','<CLIENT_SECRET_FROM_SECRET_MANAGER>'])assert.ok(examples.includes(token),token);
for(const token of ['partnerGuide','คู่มือเชื่อมเว็บ 2','Headers มาตรฐาน','Signed Webhook','ข้อมูลต้องห้าม'])assert.ok(page.includes(token),token);
assert.match(protocol,/Phase 7 Integration Guide and Production Gate Contract/);
const gate=spawnSync(process.execPath,['scripts/partner-api-security-gate.mjs'],{encoding:'utf8'});assert.equal(gate.status,0,gate.stderr||gate.stdout);assert.match(gate.stdout,/security gate: PASS/);
console.log('v0.14.222 Partner API Web2 guide examples checklist rollback and security gate: PASS');
