import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {promotionPrice} from '../functions/_promotion.js';

const read=(path)=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const promotion={enabled:true,scopes:['bundle-deals'],percent:75};

assert.equal(promotionPrice({category:'bundle-deals',price:48000},promotion).sale_price,12000);
assert.equal(promotionPrice({category:'bundle-deals',price:50900},promotion).sale_price,12725);
assert.equal(promotionPrice({category:'worksheet',price:10000},promotion).sale_price,10000);
assert.equal(promotionPrice({category:'resale-rights',price:10000},{...promotion,scopes:['all']}).sale_price,10000);
const course=promotionPrice({slug:'course-selling-rights',category:'course',price:99900},{...promotion,scopes:['all']});
assert.equal(course.sale_price,49900);
assert.equal(course.promotion_percent,50);

const [version,index,admin,orders,featureMap]=await Promise.all([
  'VERSION.txt','public/index.html','public/admin.html','functions/api/orders/index.js','FEATURE-MAP.md'
].map(read));
assert.equal(version.trim(),'v0.14.414');
assert.match(index,/WEB v0\.14\.414/);
assert.match(admin,/ADMIN v0\.14\.414/);
assert.match(orders,/p\.category!==['"]bundle-deals['"]/);
assert.match(featureMap,/bundle-deals ใช้ catalog promotion ได้/);
console.log('PASS v0.14.414 configured promotion applies to bundle deals without quantity-discount stacking');
