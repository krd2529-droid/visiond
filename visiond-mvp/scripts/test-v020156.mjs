import {spawnSync} from 'node:child_process';

for(const args of [
  ...['team_only','cover_team','focus_team','generic','cover_only'].map(scenario=>['scripts/test-v020156-vsport-one-news-timeline-browser.mjs',scenario]),
  ['scripts/test-v020155.mjs'],
  ['scripts/visible-version-check.mjs']
]){
  const result=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,EXPECT_GREEN:'1'}});
  if(result.status!==0)process.exit(result.status||1);
}
