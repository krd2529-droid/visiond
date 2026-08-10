import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),has=p=>fs.existsSync(p);let fail=0;
const schema=read('migrations/0017_vision7_elon_page_foundation.sql'),runtime=read('functions/_schema.js')+read('functions/_vision7_schema.js'),activate=read('functions/api/vision7/activate.js'),trial=read('functions/api/vision7/trial.js'),road=read('work-history/visiond/roadmap/VISIOND-ROADMAP.md');
const checks=[
 ['version',Number(read('VERSION.txt').trim().split('.').at(-1))>=51],
 ['migration + runtime schema',schema.includes('vision7_licenses')&&schema.includes('elon_page_conversations')&&runtime.includes('vision7_licenses')],
 ['three-device enforcement',activate.includes('l.max_devices')&&activate.includes('device_limit')],
 ['account-bound key',activate.includes('l.key_hash=? AND l.user_id=?')],
 ['customer device reset',activate.includes('onRequestDelete')&&activate.includes('revoked_at=CURRENT_TIMESTAMP')],
 ['one trial per program/account',trial.includes('vision7_trial_entitlements')&&schema.includes('PRIMARY KEY(user_id,program_id)')],
 ['isolated surfaces',['public/ads-center.html','public/elon-page-admin.html','public/vision7-admin.html','public/my-programs.html'].every(has)],
 ['legacy dashboards untouched by new pages',!read('public/ads-center.html').includes('profit-dashboard')],
 ['event case carried',road.includes('EVENT CASE: ยังไม่เสร็จ — ต้องแพตต่อ')]
];for(const [n,ok] of checks){console.log(ok?'PASS':'FAIL',n);if(!ok)fail++}if(fail)process.exit(1);
