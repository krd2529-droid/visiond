import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url));
const text=async path=>(await read(path)).toString('utf8');
const [gif,banner,cart,version,index,admin,featureMap]=await Promise.all([
  read('public/assets/visiond-bundle-promo.gif'),text('public/promo-banner.js'),text('public/cart.html'),text('VERSION.txt'),text('public/index.html'),text('public/admin.html'),text('FEATURE-MAP.md')
]);
assert.equal(gif.subarray(0,6).toString('ascii'),'GIF89a');
assert.equal(gif.readUInt16LE(6),1600);
assert.equal(gif.readUInt16LE(8),260);
assert.ok((gif.toString('latin1').match(/\x21\xF9\x04/g)||[]).length>=4,'GIF must retain at least four frames');
for(const token of ['visiond-bundle-promo.gif','5 ตะกร้าลด 15%','10 ตะกร้าลด 25%','20 ตะกร้าลด 50%','30 ตะกร้าลด 75%'])assert.ok(banner.includes(token),token);
assert.match(cart,/visiond-bundle-promo\.gif\?v=014416/);
assert.match(featureMap,/GIF 4 เฟรม/);
assert.equal(version.trim(),'v0.14.416');
assert.match(index,/WEB v0\.14\.416/);
assert.match(admin,/ADMIN v0\.14\.416/);
console.log('PASS v0.14.416 updated four-frame cart promotion GIF');
