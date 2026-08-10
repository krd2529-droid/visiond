import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const files=fs.readdirSync('scripts').filter(x=>/^test-.*\.mjs$/.test(x)&&x!=='test-all-regressions.mjs').sort();let failed=0;
for(const file of files){const r=spawnSync(process.execPath,[`scripts/${file}`],{encoding:'utf8'});console.log(`${r.status===0?'PASS':'FAIL'} ${file}`);if(r.status!==0){failed++;process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'')}}
console.log(`REGRESSION: total=${files.length} passed=${files.length-failed} failed=${failed}`);if(failed)process.exit(1);
