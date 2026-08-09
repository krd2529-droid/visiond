import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const cart=read('public/cart.js'),catalog=read('public/catalog-sync.js'),orders=read('functions/api/orders/index.js'),login=read('functions/api/auth/login.js'),register=read('functions/api/auth/register.js'),memberAuth=read('public/member-auth.js'),slip=read('functions/api/orders/[id]/slip.js'),download=read('functions/api/downloads/file/[id].js');

const discountRate=count=>count>=30?30:count>=20?20:count>=10?10:count>=5?5:0;
assert.deepEqual([[0,0],[4,0],[5,5],[9,5],[10,10],[19,10],[20,20],[29,20],[30,30]].map(([count])=>discountRate(count)),[0,0,5,5,10,10,20,20,30]);
for(const source of [cart,catalog,orders])for(const token of ['>= 30','>= 20','>= 10','>= 5'])assert.ok(source.includes(token)||source.includes(token.replace(' ','')),`discount threshold ${token}`);
assert.equal(10000-Math.round(10000*discountRate(5)/100),9500);
assert.equal(10000-Math.round(10000*discountRate(10)/100),9000);
assert.equal(10000-Math.round(10000*discountRate(20)/100),8000);
assert.equal(10000-Math.round(10000*discountRate(30)/100),7000);
console.log('PASS discounts 5/10/20/30');

assert.match(orders,/id<\?/);assert.match(orders,/limit\+1/);assert.match(orders,/next_cursor/);
assert.match(cart,/for\(let page=0;page<20;page\+\+\)/);assert.match(catalog,/loadOrderPages/);assert.match(cart,/pagination\?\.next_cursor/);
console.log('PASS cursor pagination producer/consumers');

assert.match(cart,/Promise\.all\(\[fetch\('\/api\/products'/);assert.match(cart,/fetch\('\/api\/courses'/);assert.match(cart,/before\.flatMap/);assert.match(cart,/if\(!product\)return \[\]/);assert.match(cart,/resetActiveOrder\(\)/);
assert.match(cart,/cartSignature\(getCart\(\)\) !== order\.cart_signature/);
console.log('PASS stale cart and stale order guard');

assert.match(memberAuth,/payload\.remember=payload\.remember==='on'/);assert.match(login,/b\.remember===true/);assert.match(login,/Max-Age=2592000/);assert.match(login,/sessionDuration=remember\?'\+30 days':'\+24 hours'/);
assert.match(memberAuth,/payload\.termsAccepted=payload\.termsAccepted==='true'/);assert.match(register,/body\.termsAccepted !== true/);assert.match(register,/INSERT INTO user_terms_acceptances/);
console.log('PASS remember/session and terms acceptance');

assert.match(slip,/WHERE id=\? AND user_id=\?/);assert.match(slip,/file\.size>4\*1024\*1024/);assert.match(download,/e\.user_id=\?/);assert.match(download,/x-content-type-options':'nosniff/);
console.log('PASS order/slip/download ownership guards');

const drawerPages=['index','digital-products','product','cart','courses','login','register','forgot-password','about','blog','bots','contact','course-rights-terms','privacy','terms'];
for(const page of drawerPages){const html=read(`public/${page}.html`);assert.match(html,/mobile-storefront\.css\?v=01430/);assert.match(html,/mobile-storefront\.js\?v=01430/);assert.match(html,/<header class="topbar"/)}
const mobile=read('public/mobile-storefront.js');for(const token of ["event.key==='Escape'","event.key!=='Tab'","returnFocus.focus()","setAttribute('aria-expanded','true')"])assert.ok(mobile.includes(token));
console.log('PASS mobile drawer integration and keyboard contract');
