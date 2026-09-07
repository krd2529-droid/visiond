import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequestPost as login} from '../functions/api/auth/login.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [client,loginSource,html,version]=await Promise.all([
  read('public/tiktok-analyzer.js'),read('functions/api/auth/login.js'),read('public/tiktok-analyzer.html'),read('VERSION.txt'),
]);

for(const token of ["fetch('/api/auth/me'","response.status===401","sessionStorage.setItem('vd_return_to'","location.replace('/login.html')",'await loadChannels()'])assert.ok(client.includes(token),token);
assert.ok(client.indexOf('bootstrapReviewerAccess();')>client.lastIndexOf('loadChannels();'),'reviewer bootstrap must replace the unconditional initial private API load');
assert.doesNotMatch(client,/reviewDemo|review_demo|demoShopData|demoChannels/,'review flow must never use mock data');
assert.doesNotMatch(loginSource,/ensureVision7AuthSchema/,'web login must not run Vision7 schema DDL');
assert.match(loginSource,/ctx\.waitUntil\)ctx\.waitUntil\(recordLoginActivity\(\)\)/,'noncritical login activity must leave the response hot path');
assert.match(loginSource,/DATABASE_DAILY_LIMIT/,'D1 exhaustion must have a diagnostic service response');

const env={DB:{prepare(){throw new Error('D1 daily operation limit exceeded error code: 1101')}}};
const response=await login({env,request:new Request('https://visiondonline.com/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({login:'reviewer@example.invalid',password:'wrong'})})});
assert.equal(response.status,503);assert.equal((await response.json()).code,'DATABASE_DAILY_LIMIT');assert.equal(response.headers.get('retry-after'),'3600');
assert.doesNotMatch(html,/reviewDemoLink|review_demo=1|reviewDemoNotice/);
assert.equal(version.trim(),'v0.20.57');
console.log('v0.20.55 TikTok reviewer login reliability tests passed');
