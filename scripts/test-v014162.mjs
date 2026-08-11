import fs from 'node:fs';import assert from 'node:assert/strict';
const hook=fs.readFileSync('functions/hooks/v1/[provider]/[publicId].js','utf8');
assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.162');assert.doesNotMatch(hook,/ensureWebhookHubSchema/);
assert.match(hook,/LEFT JOIN veasy_channel_credentials/);assert.ok(hook.indexOf('if(events.length===0)return out({ok:true},200)')<hook.indexOf("if(x.status==='paused')"));assert.match(hook,/ctx\.waitUntil\(ctx\.env\.DB\.batch\(statements\)/);
console.log('PASS v0.14.162 active LINE Verify fast path');
