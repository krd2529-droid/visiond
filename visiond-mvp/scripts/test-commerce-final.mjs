import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const cart=read('public/cart.js'),catalog=read('public/catalog-sync.js'),orders=read('functions/api/orders/index.js'),login=read('functions/api/auth/login.js'),register=read('functions/api/auth/register.js'),memberAuth=read('public/member-auth.js'),slip=read('functions/api/orders/[id]/slip.js'),download=read('functions/api/downloads/file/[id].js');

const discountRate=count=>count>=30?75:count>=20?50:count>=10?25:count>=5?15:0;
assert.deepEqual([[0,0],[4,0],[5,15],[9,15],[10,25],[19,25],[20,50],[29,50],[30,75]].map(([count])=>discountRate(count)),[0,0,15,15,25,25,50,50,75]);
for(const source of [cart,catalog,orders])for(const token of ['>= 30','>= 20','>= 10','>= 5'])assert.ok(source.includes(token)||source.includes(token.replace(' ','')),`discount threshold ${token}`);
assert.equal(10000-Math.round(10000*discountRate(5)/100),8500);
assert.equal(10000-Math.round(10000*discountRate(10)/100),7500);
assert.equal(10000-Math.round(10000*discountRate(20)/100),5000);
assert.equal(10000-Math.round(10000*discountRate(30)/100),2500);
console.log('PASS discounts 5/10/20/30');

assert.match(orders,/id<\?/);assert.match(orders,/limit\+1/);assert.match(orders,/next_cursor/);
assert.match(cart,/\/api\/orders\/product-status\?slugs=/);assert.match(cart,/slice\(0,30\)/);assert.match(catalog,/pagination\?\.next_cursor/);
assert.doesNotMatch(cart,/for\s*\(let page=0;page<20/);assert.doesNotMatch(catalog,/loadOrderPages|fetch\(`\/api\/orders\?/);
console.log('PASS bounded order status and catalog cursor contracts');

assert.match(cart,/fetch\(`\/api\/products\?slugs=\$\{productQuery\}`/);assert.match(cart,/fetch\('\/api\/courses'/);assert.match(cart,/before\.flatMap/);assert.match(cart,/if\(!product\)return digitalStorefrontPaused/);assert.match(cart,/resetActiveOrder\(\)/);
assert.match(cart,/cartSignature\(getCart\(\)\) !== order\.cart_signature/);

const refreshSource=cart.slice(cart.indexOf('async function refreshCartPrices()'),cart.indexOf('\nconst discountRate',cart.indexOf('async function refreshCartPrices()'))).trim();
assert.ok(refreshSource.startsWith('async function refreshCartPrices()')&&refreshSource.endsWith('}'),'refreshCartPrices must remain extractable for behavior verification');
async function exerciseMissingOrdinaryProduct(storefrontClosed){
  const saved=[{id:7,slug:'saved-product',title:'Saved',price:5000,product_kind:'product'}],requests=[],writes=[],alerts=[];
  const empty=items=>({ok:true,json:async()=>({items,...(items===null?{storefront_closed:storefrontClosed}:{})})});
  const context={
    getCart:()=>saved.map(item=>({...item})),fetch:async url=>{requests.push(url);return url.startsWith('/api/products?slugs=')?empty(null):empty([])},
    localStorage:{setItem:(key,value)=>writes.push([key,value])},render:()=>{},resetActiveOrder:()=>writes.push(['reset','']),alert:value=>alerts.push(value),
    encodeURIComponent,console
  };
  vm.runInNewContext(`let digitalStorefrontPaused=false;${refreshSource};globalThis.run=refreshCartPrices`,context,{filename:'cart-refresh-prices.js'});
  await context.run();
  return {requests,writes,alerts,cart:JSON.parse(writes.find(([key])=>key==='vd_cart')[1])};
}
const paused=await exerciseMissingOrdinaryProduct(true);
assert.deepEqual(paused.cart,[{id:7,slug:'saved-product',title:'Saved',price:5000,product_kind:'product'}],'paused storefront must preserve an existing ordinary cart row');
assert.equal(paused.alerts.length,0);assert.equal(paused.writes.some(([key])=>key==='reset'),false);
assert.equal(paused.requests[0],'/api/products?slugs=saved-product');assert.equal(paused.requests.some(url=>url.startsWith('/api/orders?')),false);
const open=await exerciseMissingOrdinaryProduct(false);
assert.deepEqual(open.cart,[],'open storefront must remove a product that is no longer returned');
assert.equal(open.alerts.length,1);assert.equal(open.writes.some(([key])=>key==='reset'),true);
console.log('PASS paused cart preservation, open-cart cleanup and stale order guard');

assert.match(memberAuth,/payload\.remember=payload\.remember==='on'/);assert.match(login,/b\.remember===true/);assert.match(login,/Max-Age=2592000/);assert.match(login,/sessionDuration=remember\?'\+30 days':'\+24 hours'/);
assert.match(memberAuth,/payload\.termsAccepted=payload\.termsAccepted==='true'/);assert.match(register,/body\.termsAccepted !== true/);assert.match(register,/INSERT INTO user_terms_acceptances/);
console.log('PASS remember/session and terms acceptance');

assert.match(slip,/WHERE id=\? AND user_id=\?/);assert.match(slip,/file\.size>4\*1024\*1024/);assert.match(download,/e\.user_id=\?/);assert.match(download,/x-content-type-options':'nosniff/);
console.log('PASS order/slip/download ownership guards');

const drawerPages=['index','digital-products','product','cart','courses','login','register','forgot-password','about','blog','bots','contact','course-rights-terms','privacy','terms'];
for(const page of drawerPages){const html=read(`public/${page}.html`);assert.match(html,/mobile-storefront\.css\?v=014\d+/);assert.match(html,/mobile-storefront\.js\?v=014\d+/);assert.match(html,/<header class="topbar"/)}
const mobile=read('public/mobile-storefront.js'),mobileCss=read('public/mobile-storefront.css');for(const token of ["event.key==='Escape'","event.key!=='Tab'","returnFocus.focus()","setAttribute('aria-expanded','true')"])assert.ok(mobile.includes(token));
console.log('PASS mobile drawer integration and keyboard contract');
assert.match(mobileCss,/\.mobile-nav-open \.topbar\.mobile-nav-ready\{z-index:10022!important\}/,'open drawer stacking context must stay above its backdrop on Android');
assert.match(mobileCss,/\.mobile-nav-backdrop\{[^}]*backdrop-filter:none!important[^}]*-webkit-backdrop-filter:none!important/,'mobile backdrop must never blur the navigation on Android');
