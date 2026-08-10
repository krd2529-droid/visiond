import assert from 'node:assert/strict';import fs from 'node:fs';
const css=fs.readFileSync('public/style.css','utf8'),nav=fs.readFileSync('public/nav-account.js','utf8');
for(const rule of ['grid-template-columns:auto minmax(0,1fr)','grid-template-rows:auto auto','grid-column:1/-1','grid-row:2','justify-content:center','border-top:1px solid','display:contents'])assert.ok(css.includes(rule),rule);
for(const hook of ['nav-primary-group','nav-utility-group'])assert.ok(nav.includes(hook),hook);
assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.99');console.log('v0.14.99 intentional two-tier desktop header passed');
