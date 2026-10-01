import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url),text=relative=>readFile(new URL(relative,root),'utf8');
const [version,home,admin,html,client,api,packageText,ledgerText]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/vsport.html','public/vsport.js','functions/api/admin/vsport.js','package.json','patch-ledgers/v0.20.147.json'].map(text));
assert.equal(version.trim(),'v0.20.147');assert.match(home,/WEB v0\.20\.147/);assert.match(admin,/ADMIN v0\.20\.147/);
assert.match(html,/vsport\.css\?v=020147/);assert.match(html,/vsport\.js\?v=020147/);
assert.match(client,/function drawHeadline/);assert.match(client,/colon=value\.search/);assert.match(client,/drawHeadline\(context,headline\)/);
assert.match(api,/prepareThaiThumbnailHeadline/,'v146 server preparation remains connected');
assert.equal(JSON.parse(packageText).scripts['test:v020147'],'node scripts/test-v020147.mjs');
const ledger=JSON.parse(ledgerText);assert.equal(ledger.version,'v0.20.147');
for(const required of ['public/vsport.js','public/vsport.html','scripts/test-v020147-vsport-colon-cover-browser.mjs','scripts/test-v020147.mjs'])assert.ok(ledger.files.includes(required),required);
const run=script=>execFileSync(process.execPath,[script],{cwd:root,stdio:'inherit'});
for(const script of ['scripts/test-v020147-vsport-colon-cover-browser.mjs','scripts/test-v020146-vsport-thai-cover.mjs','scripts/test-v020146-vsport-thai-cover-browser.mjs','scripts/test-v020145-vsport-soccer-media.mjs'])run(script);
execFileSync(process.execPath,['--check','public/vsport.js'],{cwd:root,stdio:'inherit'});
console.log('PASS v0.20.147 V Sport colon cover layout and connected Thai-cover regressions');
