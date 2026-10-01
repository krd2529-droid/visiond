import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url),text=relative=>readFile(new URL(relative,root),'utf8');
const [version,home,admin,html,client,api,packageText,ledgerText]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/vsport.html','public/vsport.js','functions/api/admin/vsport.js','package.json','patch-ledgers/v0.20.146.json'].map(text));
assert.equal(version.trim(),'v0.20.146');
assert.match(home,/WEB v0\.20\.146/);assert.match(admin,/ADMIN v0\.20\.146/);
assert.match(html,/vsport\.css\?v=020146/);assert.match(html,/vsport\.js\?v=020146/);
assert.match(client,/วีสปอร์ต วันนี้/);assert.match(client,/thumbnailExporting/);
assert.match(api,/prepareThaiThumbnailHeadline/);assert.match(api,/project_id=\? AND headline=\? AND selected=1/);
assert.equal(JSON.parse(packageText).scripts['test:v020146'],'node scripts/test-v020146.mjs');
const ledger=JSON.parse(ledgerText);assert.equal(ledger.version,'v0.20.146');
for(const required of ['functions/api/admin/vsport.js','public/vsport.js','public/vsport.html','scripts/test-v020146-vsport-thai-cover.mjs','scripts/test-v020146-vsport-thai-cover-browser.mjs','scripts/test-v020146.mjs'])assert.ok(ledger.files.includes(required),required);
const run=script=>execFileSync(process.execPath,[script],{cwd:new URL('../',import.meta.url),stdio:'inherit'});
for(const script of ['scripts/test-v020146-vsport-thai-cover.mjs','scripts/test-v020146-vsport-thai-cover-browser.mjs','scripts/test-v020145.mjs','scripts/test-v020139-vsport-news-browser.mjs','scripts/test-v020140-vsport-bing-browser.mjs'])run(script);
for(const file of ['functions/api/admin/vsport.js','public/vsport.js'])execFileSync(process.execPath,['--check',file],{cwd:new URL('../',import.meta.url),stdio:'inherit'});
console.log('PASS v0.20.146 Thai cover release and connected V Sport regressions');
