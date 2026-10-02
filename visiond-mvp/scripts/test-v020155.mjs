import {spawnSync} from 'node:child_process';

for(const file of [
  'scripts/test-v020155-vsport-story-previews.mjs',
  'scripts/test-v020155-vsport-story-browser.mjs',
  'scripts/test-v020154.mjs'
]){
  const result=spawnSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,EXPECT_GREEN:'1'}});
  if(result.status!==0)process.exit(result.status||1);
}
