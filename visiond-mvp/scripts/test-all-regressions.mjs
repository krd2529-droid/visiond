import fs from 'node:fs';import {spawnSync} from 'node:child_process';
// Historical tests below lock an exact release number/next-patch sentence.
// Their capability equivalents preserve the behavior checks across later releases.
const legacyExactVersionTests=new Set(['test-v01446.mjs','test-v01447.mjs','test-v01449.mjs','test-v01450.mjs']);
const files=fs.readdirSync('scripts').filter(x=>/^test-.*\.mjs$/.test(x)&&x!=='test-all-regressions.mjs'&&!legacyExactVersionTests.has(x)).sort();let failed=0;
for(const file of files){const r=spawnSync(process.execPath,[`scripts/${file}`],{encoding:'utf8'});console.log(`${r.status===0?'PASS':'FAIL'} ${file}`);if(r.status!==0){failed++;process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}}
console.log(`REGRESSION: total=${files.length} passed=${files.length-failed} failed=${failed}`);if(failed)process.exit(1);
