import assert from 'node:assert/strict';import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8'),checks=[];const check=(name,fn)=>{try{fn();checks.push(true);console.log(`PASS ${name}`)}catch(error){checks.push(false);console.error(`FAIL ${name}: ${error.message}`)}};
check('version',()=>assert.equal(read('VERSION.txt').trim(),'v0.14.71'));
check('create button has local status',()=>{const h=read('public/admin.html');assert.match(h,/id="v4CreateProduct"/);assert.match(h,/id="v4CreateState"/);assert.match(h,/vision4-bundle\.js\?v=01471/)});
check('first three previews auto selected',()=>assert.match(read('public/vision4-bundle.js'),/index < 3 \? " checked"/));
check('preview blocker is explicit',()=>{const j=read('public/vision4-bundle.js');assert.match(j,/ตอนนี้เลือก \$\{selected\.length\} รูป/);assert.match(j,/createState\.scrollIntoView/)});
check('server failures are surfaced',()=>{const j=read('public/vision4-bundle.js');assert.match(j,/สร้างสินค้าไม่สำเร็จ\\n/);assert.match(j,/finally/)});
check('requirement verified',()=>{const x=JSON.parse(read('requirements-ledger.json')).requirements.find(x=>x.id==='EC-V4-001');assert.equal(x?.status,'DONE-VERIFIED')});
const failed=checks.filter(x=>!x).length;console.log(`v0.14.71 RESULT: total=${checks.length} passed=${checks.length-failed} failed=${failed}`);if(failed)process.exit(1);
