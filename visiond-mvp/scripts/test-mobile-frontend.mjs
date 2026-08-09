import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';

const root=new URL('../',import.meta.url).pathname;
const read=file=>readFileSync(join(root,file),'utf8');
const htmlFiles=[];
const walk=dir=>{for(const entry of readdirSync(join(root,dir),{withFileTypes:true})){const rel=join(dir,entry.name);if(entry.isDirectory())walk(rel);else if(rel.endsWith('.html'))htmlFiles.push(rel)}};
walk('public');

for(const file of htmlFiles){
  const source=read(file);
  for(const match of source.matchAll(/href=["']([^"'#?]+)(?:[?#][^"']*)?["']/gi)){
    const href=match[1];
    if(/^(?:https?:|mailto:|tel:|\/\/)/i.test(href))continue;
    const target=href.startsWith('/')?join(root,'public',href.slice(1)):join(root,dirname(file),href);
    assert.ok(existsSync(target)||existsSync(target+'.html')||existsSync(join(target,'index.html')),`${file} has broken local href ${href}`);
  }
}

const preview=read('public/boss-mobile-preview.js');
assert.match(preview,/max-width: 760px\), \(pointer: coarse/,'Boss mobile preview must never initialize on a real phone');

const cart=read('public/cart.html'),dialog=cart.match(/<dialog[\s\S]*?<\/dialog>/)?.[0]||'';
assert.match(dialog,/id="sellerPaymentQr"/,'seller QR must live inside the modal top layer');
assert.equal((cart.match(/id="sellerPaymentQr"/g)||[]).length,1,'seller QR id must be unique');
assert.doesNotMatch(read('public/cart.js'),/Ctrl\+C/,'mobile clipboard fallback must not require a keyboard');

const elonCss=read('public/elon-chat.css');
assert.match(elonCss,/body\.mobile-nav-open \.elon-chat,body\.lesson-menu-open \.elon-chat\{display:none!important\}/,'ELON must not intercept mobile drawers');

for(const page of ['how-to-choose-tattoo-design','popular-tattoo-styles','tattoo-design-pdf-for-artists']){
  const source=read(`public/blog/${page}.html`);
  assert.match(source,/mobile-storefront\.css\?v=01442/);
  assert.match(source,/mobile-storefront\.js\?v=01442/);
}

assert.match(read('public/cart-catalog.css'),/min-height:44px/,'catalog action targets must be at least 44px');
assert.match(read('public/catalog-static.css'),/@media\(max-width:430px\)\{\.vd-grid\{grid-template-columns:minmax\(0,1fr\)!important/,'narrow phones must use one catalog column');
assert.doesNotMatch(read('public/promo-banner.js'),/width:640px/,'mobile promo must not crop a forced 640px image');
assert.match(read('public/facebook-chat.js'),/@media\(max-width:560px\)[\s\S]*?\.vd-line-launcher b,\.vd-facebook-chat-launcher b\{display:none\}/,'contact dock must compact on phones');
const catalogSync=read('public/catalog-sync.js'),memberDashboard=read('public/member-dashboard.js');
assert.doesNotMatch(catalogSync,/isStaffAccount \? \[\] : orderData\.items/,'Boss storefront must show its own paid/pending state');
assert.match(memberDashboard,/orderMarkup\(o,currentBank,false\)/,'Boss personal dashboard orders must retain buyer actions');
assert.doesNotMatch(memberDashboard,/if\(!isStaff\)document\.querySelectorAll\('\.order-slip-form'\)/,'Boss must be able to resume its own slip upload');

console.log(`PASS mobile frontend audit: ${htmlFiles.length} HTML pages, links, overlays, QR, clipboard, touch targets and article drawers`);
