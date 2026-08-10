import assert from 'node:assert/strict';import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8'),checks=[];const check=(name,fn)=>{try{fn();checks.push(true);console.log(`PASS ${name}`)}catch(error){checks.push(false);console.error(`FAIL ${name}: ${error.message}`)}};
check('version is not older than patch',()=>assert.ok(Number(read('VERSION.txt').trim().replace(/\D/g,''))>=1470));
check('main admin retains ads center entry',()=>{const m=read('functions/_middleware.js');assert.match(m,/ADS_CENTER_ADMIN_ENTRY/);assert.match(m,/href="\/ads-center\.html"/)});
check('static Vision 7 page has no ads link',()=>assert.doesNotMatch(read('public/vision7-admin.html'),/href="\/ads-center\.html"/));
check('runtime strips stale Vision 7 ads link',()=>{const m=read('functions/_middleware.js');assert.match(m,/isVision7AdminHtmlPath/);assert.match(m,/a\[href="\/ads-center\.html"\]/);assert.match(m,/element\.remove\(\)/)});
check('requirement verified',()=>{const x=JSON.parse(read('requirements-ledger.json')).requirements.find(x=>x.id==='EC-ADS-005');assert.equal(x?.status,'DONE-VERIFIED');assert.ok(x.evidence.includes('scripts/test-v01470.mjs'))});
const failed=checks.filter(x=>!x).length;console.log(`v0.14.70 RESULT: total=${checks.length} passed=${checks.length-failed} failed=${failed}`);if(failed)process.exit(1);
