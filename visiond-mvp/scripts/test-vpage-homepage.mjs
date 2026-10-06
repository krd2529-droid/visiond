import assert from 'node:assert/strict';
import vpageService from '../services/vpage/src/index.js';

let databaseReads=0;
const env={
  VPAGE_SHARED_SECRET:'homepage-test-secret-32-characters-minimum',
  VPAGE_KEY_ID:'homepage-test-key',
  VPAGE_DB:{
    prepare(){
      databaseReads++;
      return{bind(){return this},async first(){return null}};
    }
  }
};

const root=await vpageService.fetch(new Request('https://smartlinkpage.com/'),env);
assert.equal(root.status,200);
assert.match(root.headers.get('content-type')||'',/^text\/html/);
assert.match(root.headers.get('content-security-policy')||'',/default-src 'none'/);
assert.match(root.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
assert.equal(root.headers.get('x-content-type-options'),'nosniff');
assert.equal(root.headers.get('referrer-policy'),'no-referrer');
const homepage=await root.text();
assert.match(homepage,/<html lang="th">/);
assert.match(homepage,/<meta name="viewport" content="width=device-width, initial-scale=1">/);
assert.match(homepage,/<meta name="description" content="[^"]+">/);
assert.match(homepage,/<title>SmartLinkPage \| บริการสร้างเซลเพจออนไลน์<\/title>/);
assert.match(homepage,/บริการเซลเพจเพื่อธุรกิจออนไลน์/);
assert.match(homepage,/สร้างหน้าขายที่เล่าเรื่องสินค้า/);
assert.match(homepage,/ขั้นตอนการเริ่มต้น/);
assert.match(homepage,/href="https:\/\/lin\.ee\/rUcWsJu"/);
assert.match(homepage,/target="_blank"/);
assert.match(homepage,/rel="noopener noreferrer"/);
assert.match(homepage,/src="\/smartlinkpage-logo\.svg"/);
assert.match(homepage,/alt="SmartLinkPage"/);
assert.doesNotMatch(homepage,/<script\b|<form\b|google-analytics|googletagmanager/i);
assert.equal(databaseReads,0,'root homepage must not read D1');

const head=await vpageService.fetch(new Request('https://smartlinkpage.com/',{method:'HEAD'}),env);
assert.equal(head.status,200);
assert.match(head.headers.get('content-type')||'',/^text\/html/);
assert.equal(databaseReads,0,'root HEAD must not read D1');

const logo=await vpageService.fetch(new Request('https://smartlinkpage.com/smartlinkpage-logo.svg'),env);
assert.equal(logo.status,200);
assert.match(logo.headers.get('content-type')||'',/^image\/svg\+xml/);
assert.match(logo.headers.get('cache-control')||'',/max-age=604800/);
assert.match(await logo.text(),/<svg[^>]+viewBox="0 0 640 180"/);
assert.equal(databaseReads,0,'brand asset must not read D1');

const invalid=await vpageService.fetch(new Request('https://smartlinkpage.com/not-a-page.svg'),env);
assert.equal(invalid.status,404,'unknown asset-like route stays not found');
assert.equal(databaseReads,0,'invalid slug must not read D1');

const dynamic=await vpageService.fetch(new Request('https://smartlinkpage.com/mali-shop'),env);
assert.equal(dynamic.status,404,'dynamic slug routing remains database-backed');
assert.equal(databaseReads,1,'dynamic slug still performs the existing indexed page lookup');

const unsignedApi=await vpageService.fetch(new Request('https://smartlinkpage.com/api/v1/domains'),env);
assert.equal(unsignedApi.status,401,'signed API boundary remains protected');
assert.equal(unsignedApi.headers.get('cache-control'),'private, no-store');
assert.equal((await unsignedApi.json()).code,'VPAGE_SIGNATURE_INVALID');
assert.equal(databaseReads,1,'unsigned API rejection happens before D1');

console.log('PASS SmartLinkPage isolated root homepage copy, LINE CTA, brand asset, security and route preservation');
