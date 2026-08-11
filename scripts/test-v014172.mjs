import assert from'node:assert/strict';import fs from'node:fs';
const r=p=>fs.readFileSync(p,'utf8'),runtime=r('functions/_veasy_runtime.js'),ai=r('functions/_veasy_line_ai.js'),api=r('functions/api/vision7/shops/[shopId]/contexts.js');
assert.equal(r('VERSION.txt').trim(),'v0.14.172');
for(const value of ['veasy_context_reviews','veasy_context_audit','occurrences'])assert.match(runtime,new RegExp(value));
for(const value of ['queueContextReview','prompt_injection','เบอร์โทรถูกซ่อน','ที่อยู่ถูกซ่อน','ร้านยังไม่ได้ระบุ'])assert.match(ai,new RegExp(value));
for(const value of ['approve_review','dismiss_review','edit_context','risk_flag','actor_user_id'])assert.match(api,new RegExp(value));
assert.match(api,/WHERE id=\? AND shop_id=\?/);assert.match(api,/user_id=\?/);
console.log('PASS v0.14.172 V Easy guarded chat review queue');
