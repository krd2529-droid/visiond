import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url),read=relative=>readFile(new URL(relative,root),'utf8');
const [version,home,admin,html,api,client,pkg,ledgerText]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/vsport.html','functions/api/admin/vsport.js','public/vsport.js','package.json','patch-ledgers/v0.20.150.json'].map(read));
assert.equal(version.trim(),'v0.20.150');assert.match(home,/WEB v0\.20\.150/u);assert.match(admin,/ADMIN v0\.20\.150/u);assert.match(html,/vsport\.js\?v=020150/u);assert.match(html,/vsport\.css\?v=020150/u);assert.match(api,/BBC_FOOTBALL_RSS/u);assert.match(client,/BBC Sport/u);assert.equal(JSON.parse(pkg).scripts['test:v020150'],'node scripts/test-v020150.mjs');
const ledger=JSON.parse(ledgerText);assert.equal(ledger.version,'v0.20.150');for(const path of ['functions/_vsport.js','functions/api/admin/vsport.js','public/vsport.js','scripts/test-v020150-vsport-news-fallback.mjs','scripts/test-v020150-vsport-news-browser.mjs','scripts/test-v020150.mjs'])assert.ok(ledger.files.includes(path),path);
for(const script of ['scripts/test-v020150-vsport-news-fallback.mjs','scripts/test-v020150-vsport-news-browser.mjs','scripts/test-v020149-vsport-media-csp.mjs','scripts/test-v020148-vsport-person-images.mjs','scripts/test-v020147-vsport-colon-cover-browser.mjs','scripts/test-v020146-vsport-thai-cover.mjs','scripts/test-v020145-vsport-soccer-media.mjs'])execFileSync(process.execPath,[script],{cwd:root,stdio:'inherit'});
for(const path of ['functions/_vsport.js','functions/api/admin/vsport.js','public/vsport.js','scripts/test-v020150-vsport-news-fallback.mjs','scripts/test-v020150-vsport-news-browser.mjs','scripts/test-v020150.mjs'])execFileSync(process.execPath,['--check',path],{cwd:root,stdio:'inherit'});
console.log('PASS v0.20.150 BBC exact-first soccer news fallback and connected V Sport regressions');
