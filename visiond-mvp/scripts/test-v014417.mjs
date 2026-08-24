import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const text=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const binary=path=>readFile(new URL(`../${path}`,import.meta.url));
const [version,index,admin,cart,generator,gif,featureMap]=await Promise.all([
  text('VERSION.txt'),text('public/index.html'),text('public/admin.html'),text('public/cart.html'),text('scripts/generate-bundle-promo-gif.py'),binary('public/assets/visiond-bundle-promo.gif'),text('FEATURE-MAP.md')
]);
assert.equal(gif.readUInt16LE(6),1600);
assert.equal(gif.readUInt16LE(8),260);
assert.ok((gif.toString('latin1').match(/\x21\xF9\x04/g)||[]).length>=4);
assert.match(generator,/background = frame\.getpixel/);
assert.match(generator,/foreground = .* if background/);
assert.doesNotMatch(generator,/\(20, 185, 184\).*\(255, 255, 255\)/);
assert.match(cart,/visiond-bundle-promo\.gif\?v=014417/);
assert.match(featureMap,/ไม่ให้เกิดแถบสีค้าง/);
assert.equal(version.trim(),'v0.14.417');
assert.match(index,/WEB v0\.14\.417/);
assert.match(admin,/ADMIN v0\.14\.417/);
console.log('PASS v0.14.417 promotion GIF samples card colors per frame');
