import assert from 'node:assert/strict';
import vpageService,{validSlug} from '../services/vpage/src/index.js';

let databaseReads=0;
const env={
  VPAGE_SHARED_SECRET:'demo-test-secret-at-least-32-characters',
  VPAGE_KEY_ID:'demo-test-key',
  VPAGE_DB:{prepare(){databaseReads++;return{bind(){return this},async first(){return null}}}}
};

assert.equal(validSlug('demo'),false,'demo is reserved from customer page creation');
const response=await vpageService.fetch(new Request('https://smartlinkpage.com/demo'),env);
assert.equal(response.status,200);
assert.match(response.headers.get('content-type')||'',/^text\/html/);
assert.match(response.headers.get('content-security-policy')||'',/default-src 'none'/);
assert.equal(response.headers.get('x-content-type-options'),'nosniff');
const demo=await response.text();
assert.match(demo,/<title>ตัวอย่างเซลเพจ \| ละมุนเดย์ สตูดิโอ<\/title>/);
assert.match(demo,/ตัวอย่างสาธิต/);
assert.match(demo,/แบรนด์และสินค้าสมมติ/);
assert.match(demo,/เทียนหอม<br>แสงเช้า/);
assert.match(demo,/ข้อมูลทั้งหมดในหน้านี้สร้างขึ้นเพื่อสาธิตเท่านั้น/);
assert.equal((demo.match(/data-content-set="1"/g)||[]).length,1,'demo has exactly one static content set');
assert.doesNotMatch(demo,/data-content-set="2"|active-set|content-sets|\/api\/|<script\b|<form\b/i);
assert.match(demo,/class="[^\"]*demo-product-action[^\"]*" href="#demo-details"/);
assert.match(demo,/class="[^\"]*demo-contact-action[^\"]*" href="#demo-contact"/);
assert.match(demo,/ไม่มีการสั่งซื้อหรือส่งข้อความจริง/);
assert.equal(databaseReads,0,'exact demo route must not read D1');

const head=await vpageService.fetch(new Request('https://smartlinkpage.com/demo',{method:'HEAD'}),env);
assert.equal(head.status,200);
assert.equal(databaseReads,0,'demo HEAD must not read D1');

const root=await vpageService.fetch(new Request('https://smartlinkpage.com/'),env);
assert.equal(root.status,200);
assert.match(await root.text(),/บริการเซลเพจเพื่อธุรกิจออนไลน์/,'homepage remains unchanged');
assert.equal(databaseReads,0,'root remains static');

const dynamic=await vpageService.fetch(new Request('https://smartlinkpage.com/mali-shop'),env);
assert.equal(dynamic.status,404);
assert.equal(databaseReads,1,'ordinary slug still uses existing D1 lookup');
const unknown=await vpageService.fetch(new Request('https://smartlinkpage.com/demo.html'),env);
assert.equal(unknown.status,404);
assert.equal(databaseReads,1,'invalid unknown route stays 404 without D1');

const unsignedApi=await vpageService.fetch(new Request('https://smartlinkpage.com/api/v1/domains'),env);
assert.equal(unsignedApi.status,401);
assert.equal(unsignedApi.headers.get('cache-control'),'private, no-store');
assert.equal((await unsignedApi.json()).code,'VPAGE_SIGNATURE_INVALID');
assert.equal(databaseReads,1,'unsigned API still rejects before D1');

console.log('PASS SmartLinkPage exact static one-set demo, fictional disclosure, safe actions and route isolation');
