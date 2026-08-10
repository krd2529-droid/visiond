import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(file,'utf8'),checks=[];
const check=(name,fn)=>{try{fn();checks.push(true);console.log(`PASS ${name}`)}catch(error){checks.push(false);console.error(`FAIL ${name}: ${error.message}`)}};

check('version',()=>{const match=read('VERSION.txt').trim().match(/^v0\.14\.(\d+)$/);assert.ok(match&&Number(match[1])>=63)});
check('admin key center visible',()=>{const html=read('public/vision7-admin.html');assert.match(html,/Vision 7/);assert.match(html,/ออกคีย์/);assert.match(html,/id="keyForm"/)});
check('key center secret readiness',()=>{const api=read('functions/api/admin/vision7/licenses.js'),ui=read('public/vision7-admin.js');assert.match(api,/encryption_ready/);assert.match(api,/VISION7_LICENSE_ENCRYPTION_NOT_CONFIGURED/);assert.match(ui,/newKey\.setAttribute\("aria-disabled"/);assert.match(ui,/if \(!encryptionReady\)/)});
check('key center summary and confirmation',()=>{const html=read('public/vision7-admin.html'),ui=read('public/vision7-admin.js');assert.match(html,/id="keySummary"/);assert.match(ui,/unbound_veasy/);assert.match(ui,/ยืนยันออกคีย์ให้/)});
check('V Easy program option',()=>{const html=read('public/vision7-admin.html'),api=read('functions/api/admin/vision7/programs.js');assert.match(html,/value="veasy"/);assert.match(api,/"veasy"/)});
check('V Easy binding state prepared',()=>{const migration=read('migrations/0025_vision7_key_center.sql'),core=read('functions/_vision7_key_center.js'),api=read('functions/api/admin/vision7/licenses.js');assert.match(migration,/binding_state/);assert.match(core,/platformType.*===.*veasy.*unbound/);assert.match(api,/binding_state_initialized/)});
check('license duration remains day based',()=>assert.match(read('functions/api/admin/vision7/licenses.js'),/duration_days\) \* 86400000/));
check('user lookup includes username',()=>assert.match(read('public/vision7-admin.js'),/x\.username/));
check('mobile key center',()=>{const css=read('public/vision7.css');assert.match(css,/@media \(max-width: 650px\)/);assert.match(css,/summary-grid[\s\S]*repeat\(2/)});
check('new requirements captured atomically',()=>{const source=JSON.parse(read('source-captures/vision7-veasy-key-center-v1.json')),ledger=JSON.parse(read('requirements-ledger.json')),historical=JSON.parse(read('requirements-history/v0.14.63.json'));assert.equal(source.items.length,7);for(const item of source.items)assert.ok(ledger.requirements.some(x=>x.id===item.requirement_id));assert.equal(historical.requirements.find(x=>x.id==='VE-KEYCENTER-001').status,'DONE-VERIFIED');assert.equal(historical.requirements.find(x=>x.id==='VE-LICENSE-001').status,'PENDING')});
check('migration sequence',()=>{const files=fs.readdirSync('migrations').filter(x=>/^\d{4}_.*\.sql$/.test(x)).sort();assert.ok(Number(files.at(-1).slice(0,4))>=25)});

const failed=checks.filter(ok=>!ok).length;console.log(`v0.14.63 RESULT: total=${checks.length} passed=${checks.length-failed} failed=${failed}`);if(failed)process.exit(1);
