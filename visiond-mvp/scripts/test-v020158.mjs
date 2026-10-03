import {spawnSync} from 'node:child_process';

for(const script of ['scripts/test-v020158-vsport-webm.mjs','scripts/test-v020157.mjs','scripts/visible-version-check.mjs']){
  const result=spawnSync(process.execPath,[script],{stdio:'inherit',env:{...process.env,EXPECT_GREEN:'1'}});
  if(result.status!==0)process.exit(result.status||1);
}
