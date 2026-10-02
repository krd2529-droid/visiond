import {spawnSync} from 'node:child_process';

for(const file of [
  'scripts/test-v020154-vsport-news-images.mjs',
  'scripts/test-v020154-vsport-news-recovery.mjs',
  'scripts/test-v020154-vsport-news-parser.mjs',
  'scripts/test-v020154-vsport-news-browser.mjs',
  'scripts/test-v020154-vsport-scroll-browser.mjs'
]){
  const result=spawnSync(process.execPath,[file],{stdio:'inherit',env:{...process.env,EXPECT_GREEN:'1'}});
  if(result.status!==0)process.exit(result.status||1);
}
