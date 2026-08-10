import assert from 'node:assert/strict';import fs from 'node:fs';
const nav=fs.readFileSync('public/nav-account.js','utf8'),i18n=fs.readFileSync('public/i18n.js','utf8'),css=fs.readFileSync('public/style.css','utf8'),mobile=fs.readFileSync('public/mobile-storefront.css','utf8');
for(const hook of ['nav-primary-group','nav-utility-group','syncNavGroups','VisionDSyncNavGroups'])assert.ok(nav.includes(hook),hook);
for(const item of ['nav-cart-action','nav-admin-link','nav-member-account','course-owner-badge','nav-logout','vd-language-switcher'])assert.ok(nav.includes(item),item);
assert.match(i18n,/nav-utility-group/);assert.match(i18n,/VisionDSyncNavGroups/);
for(const rule of [':has(>.nav-primary-group)','justify-content:flex-end','max-width:1100px'])assert.ok(css.includes(rule),rule);
for(const rule of ['nav-primary-group','nav-utility-group','display:contents'])assert.ok(mobile.includes(rule),rule);
assert.match(fs.readFileSync('VERSION.txt','utf8').trim(),/^v0\.14\.(?:9[89]|[1-9]\d{2,})$/);console.log('v0.14.98 deterministic two-row storefront navigation passed');
