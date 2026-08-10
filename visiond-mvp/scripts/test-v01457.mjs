import fs from 'node:fs';const read=p=>fs.readFileSync(p,'utf8'),api=read('functions/api/admin/vision7/licenses.js'),history=read('functions/api/admin/vision7/licenses/[id]/history.js'),html=read('public/vision7-admin.html'),ui=read('public/vision7-admin.js'),ledger=JSON.parse(read('requirements-ledger.json'));const checks=[
['version',Number(read('VERSION.txt').trim().split('.').pop())>=57],
['admin auth',api.includes('requireAdmin')&&history.includes('requireAdmin')],
['issue validation',api.includes("SELECT id FROM users WHERE id=?")&&api.includes("SELECT id FROM vision7_programs WHERE id=? AND active=1")],
['encrypted issue gate',api.includes('vision7LicenseEncryptionConfigured')&&api.includes('issueLicense')],
['renew from future expiry',api.includes('old>Date.now()?old:Date.now()')&&api.includes("status='active'")],
['status audit',api.includes("action==='status'")&&api.includes("'status_changed'")],
['renew audit',api.includes("'renewed_by_operator'")&&api.includes('duration_days')],
['history scoped',history.includes('WHERE e.license_id=?')&&history.includes('actor_name')&&history.includes('vision7_license_devices')],
['operator surfaces',html.includes('id="keyForm"')&&ui.includes('data-renew')&&ui.includes('data-status')&&ui.includes('data-history')],
['requirement closed',ledger.requirements.find(x=>x.id==='EC-V7-011')?.status==='DONE-VERIFIED']
];let failed=0;for(const [name,ok] of checks){console.log(ok?'PASS':'FAIL',name);if(!ok)failed++}if(failed)process.exit(1);
