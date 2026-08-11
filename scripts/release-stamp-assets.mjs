import fs from 'node:fs';
const version=fs.readFileSync('VERSION.txt','utf8').trim().replace(/^v/,'');
if(!/^0\.14\.\d+$/.test(version)) throw new Error(`Invalid VERSION.txt: ${version}`);
for(const [file,label] of [['public/index.html','WEB'],['public/admin.html','ADMIN']]){
  const src=fs.readFileSync(file,'utf8');
  const next=src.replace(new RegExp(`(<span class="visiond-build-version"[^>]*>)${label} v0\\.14\\.\\d+(</span>)`),`$1${label} v${version}$2`);
  if(next===src && !src.includes(`${label} v${version}`)) throw new Error(`Version badge not found in ${file}`);
  fs.writeFileSync(file,next);
}
console.log(`Stamped WEB/ADMIN v${version}`);
