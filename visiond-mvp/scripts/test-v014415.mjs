import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [version,index,admin,orders,cart,catalog,banner,cartHtml,featureMap]=await Promise.all([
  'VERSION.txt','public/index.html','public/admin.html','functions/api/orders/index.js','public/cart.js','public/catalog-sync.js','public/promo-banner.js','public/cart.html','FEATURE-MAP.md'
].map(read));
const rate=count=>count>=30?75:count>=20?50:count>=10?25:count>=5?15:0;
assert.deepEqual([4,5,10,20,30].map(rate),[0,15,25,50,75]);
for(const source of [orders,cart,catalog]){
  for(const token of ['? 75','? 50','? 25','? 15'])assert.ok(source.includes(token),`${token} missing`);
}
assert.match(orders,/p\.category!==['"]bundle-deals['"]/);
assert.match(cart,/item\.category !== "bundle-deals"/);
assert.match(catalog,/item\.category !== "bundle-deals"/);
for(const text of ['5 ตะกร้า</b>ลด 15%','10 ตะกร้า</b>ลด 25%','20 ตะกร้า</b>ลด 50%','30 ตะกร้า</b>ลด 75%'])assert.ok(banner.includes(text),text);
assert.doesNotMatch(banner,/visiond-bundle-promo\.gif/);
assert.match(cartHtml,/5 ตะกร้าเพื่อรับส่วนลด 15%/);
assert.match(featureMap,/5\/10\/20\/30 ตะกร้า ลด 15\/25\/50\/75%/);
assert.equal(version.trim(),'v0.14.415');
assert.match(index,/WEB v0\.14\.415/);
assert.match(admin,/ADMIN v0\.14\.415/);
console.log('PASS v0.14.415 cart tiers 15/25/50/75 without bundle-deals stacking');
