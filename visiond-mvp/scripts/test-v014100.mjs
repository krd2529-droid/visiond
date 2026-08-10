import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync('public/index.html','utf8'),shell=fs.readFileSync('public/header-shell.js','utf8'),css=fs.readFileSync('public/header-shell.css','utf8'),catalog=fs.readFileSync('public/catalog-sync.js','utf8'),bell=fs.readFileSync('public/notification-bell.js','utf8'),mobileJs=fs.readFileSync('public/mobile-storefront.js','utf8'),mobileCss=fs.readFileSync('public/mobile-storefront.css','utf8');
for(const asset of ['/style.css?v=014100','/header-shell.css?v=014100','/catalog-sync.js?v=014100','/facebook-chat.js?v=014100','/header-shell.js?v=014100','/mobile-storefront.js?v=014100'])assert.ok(html.includes(asset),asset);
for(const stale of ['/style.css?v=01430','/catalog-sync.js?v=01442','/mobile-storefront.js?v=01442'])assert.ok(!html.includes(stale),`stale ${stale}`);
for(const hook of ['header-shell-ready','header-utility','nav-primary-group','nav-utility-group','MutationObserver','max-width: 800px'])assert.ok(shell.includes(hook),hook);
for(const rule of ['grid-template-rows:68px 50px','grid-column:1/-1','header-utility','min-height:44px','max-width:800px'])assert.ok(css.includes(rule),rule);
assert.ok(!css.includes(':has('));assert.ok(!css.includes('display:contents'));assert.equal((css.match(/{/g)||[]).length,(css.match(/}/g)||[]).length);
assert.equal((catalog.match(/nav-account\.js\?v=014100/g)||[]).length,2);assert.match(bell,/cart\.parentElement\.insertBefore/);assert.match(mobileJs,/max-width: 800px/);assert.match(mobileCss,/max-width:800px/);
assert.equal(fs.readFileSync('VERSION.txt','utf8').trim(),'v0.14.100');console.log('v0.14.100 canonical cache-safe header shell passed');
