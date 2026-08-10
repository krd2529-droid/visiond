import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPromotion,promotionPrice} from '../functions/_promotion.js';

const rows=[
  {key:'promotion_enabled',value:'1'},
  {key:'promotion_scope',value:'multiple'},
  {key:'promotion_scopes',value:JSON.stringify(['tattoo','worksheet','coloring'])},
  {key:'promotion_percent',value:'30'}
];
const env={DB:{prepare(sql){return {async all(){return {results:sql.includes("key IN")?rows:[]}},bind(){return this},async run(){return {}}}}}};
const promo=await loadPromotion(env);assert.deepEqual(promo.scopes,['tattoo','worksheet','coloring']);assert.equal(promo.scope,'multiple');
for(const category of promo.scopes)assert.equal(promotionPrice({category,price:10000},promo).sale_price,7000,category);
assert.equal(promotionPrice({category:'development-game',price:10000},promo).sale_price,10000);
assert.equal(promotionPrice({category:'resale-rights',price:10000},promo).promotion_percent,0);
const api=fs.readFileSync(new URL('../functions/api/admin/promotion-settings.js',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../public/admin.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../public/admin.html',import.meta.url),'utf8');
assert.match(api,/Array\.isArray\(body\.scopes\)/);assert.match(api,/promotion_scopes/);assert.match(api,/JSON\.stringify\(scopes\)/);
assert.match(admin,/querySelectorAll\('\[name="promotion_scope"\]:checked'\)/);assert.doesNotMatch(admin,/elements\.scope\.value/);
assert.match(html,/เลือกพร้อมกันได้หลายหมวด/);assert.match(html,/type="checkbox" value="all"/);
console.log('v0.14.80 multi-category promotion persistence checks passed');
