import fs from 'node:fs';
import assert from 'node:assert/strict';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
assert.equal(read('VERSION.txt').trim(),'v0.14.392');
assert.match(read('public/index.html'),/WEB v0\.14\.392/);
assert.match(read('public/admin.html'),/ADMIN v0\.14\.392/);

const analytics=read('public/analytics.js');
assert.match(analytics,/if\(!el\.hasAttribute\('data-analytics-click'\)\)return/,'generic clicks must opt in');
assert.match(analytics,/if\(businessEvent\)\{window\.visiondTrack\(businessEvent\);return}/,'business events must not fall through to ui_click');
assert.match(analytics,/window\.visiondTrack\('ui_click'/,'opt-in click telemetry must remain available');

for(const page of ['public/admin.html','public/login.html','public/register.html']){
  assert.doesNotMatch(read(page),/src="\/analytics\.js/ ,`${page} must not load storefront analytics`);
}
for(const page of ['public/index.html','public/digital-products.html','public/product.html','public/cart.html']){
  assert.match(read(page),/src="\/analytics\.js\?v=014392"/,`${page} must load the current analytics asset`);
}

const loginApi=read('functions/api/auth/login.js');
const registerApi=read('functions/api/auth/register.js');
assert.match(loginApi,/customer_events[\s\S]*?'login_success'/,'login success must remain server-side');
assert.match(registerApi,/customer_events[\s\S]*?'signup_complete'/,'signup success must remain server-side');

console.log('PASS v0.14.392 analytics event scope');
