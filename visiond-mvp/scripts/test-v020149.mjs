import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const root=new URL('../',import.meta.url),read=relative=>readFile(new URL(relative,root),'utf8');
const [version,home,admin,html,middleware,pkg,ledgerText]=await Promise.all(['VERSION.txt','public/index.html','public/admin.html','public/vsport.html','functions/_middleware.js','package.json','patch-ledgers/v0.20.149.json'].map(read));
assert.equal(version.trim(),'v0.20.149');assert.match(home,/WEB v0\.20\.149/u);assert.match(admin,/ADMIN v0\.20\.149/u);assert.match(html,/vsport\.js\?v=020149/u);assert.match(html,/vsport\.css\?v=020149/u);assert.match(middleware,/media-src 'self' blob:/u);assert.equal(JSON.parse(pkg).scripts['test:v020149'],'node scripts/test-v020149.mjs');
const ledger=JSON.parse(ledgerText);assert.equal(ledger.version,'v0.20.149');for(const path of ['functions/_middleware.js','scripts/test-v020148-vsport-person-images-browser.mjs','scripts/test-v020149-vsport-media-csp.mjs','scripts/test-v020149.mjs'])assert.ok(ledger.files.includes(path),path);
for(const script of ['scripts/test-v020149-vsport-media-csp.mjs','scripts/test-v020148-vsport-person-images.mjs','scripts/test-v020147-vsport-colon-cover-browser.mjs','scripts/test-v020146-vsport-thai-cover.mjs','scripts/test-v020146-vsport-thai-cover-browser.mjs','scripts/test-v020145-vsport-soccer-media.mjs'])execFileSync(process.execPath,[script],{cwd:root,stdio:'inherit'});
for(const path of ['functions/_middleware.js','scripts/test-v020148-vsport-person-images-browser.mjs','scripts/test-v020149-vsport-media-csp.mjs','scripts/test-v020149.mjs'])execFileSync(process.execPath,['--check',path],{cwd:root,stdio:'inherit'});
console.log('PASS v0.20.149 V Sport media CSP and connected v148-v145 regressions');
