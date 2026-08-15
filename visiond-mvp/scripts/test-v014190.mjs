import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [version,index,admin,css,runtime,dashboard,hubCss,protocol,history,roadmap]=await Promise.all([
  read('VERSION.txt'),read('public/index.html'),read('public/admin.html'),
  read('public/mobile-storefront.css'),read('public/visiond-button-system.js'),read('public/member-dashboard.js'),read('public/my-hub.css'),
  read('JARVIS-PATCH-PROTOCOL.md'),read('work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md'),
  read('work-history/visiond/roadmap/VISIOND-ROADMAP.md')
]);
assert.match(version.trim(),/^v0\.14\.\d+$/);
assert.match(index,/WEB v0\.14\.\d+/);
assert.match(admin,/ADMIN v0\.14\.\d+/);
assert.match(css,/\.mobile-nav-toggle,\.mobile-nav-backdrop\{display:none!important\}/);
assert.match(css,/@media\(max-width:800px\)/);
assert.match(css,/\.mobile-nav-toggle\{[^}]*display:inline-flex!important/);
assert.match(runtime,/mobile-nav-toggle\|mobile-nav-backdrop/);
for(const source of[protocol,history])for(const rule of['mobile menu toggle','hidden above 800px','runtime button classification'])assert.ok(source.includes(rule),rule);
for(const token of["document.body.classList.toggle('staff-dashboard',isStaff)",'hubMenuToggle.hidden=true','hubSidebar.hidden=true','dashNotifications.hidden=true'])assert.ok(dashboard.includes(token),token);
assert.match(hubCss,/\.staff-dashboard \.dashboard-shell\{grid-template-columns:minmax\(0,1fr\)!important/);
for(const source of[protocol,history])for(const rule of['Boss/Admin account surfaces','member account sidebar','customer notification message cards'])assert.ok(source.includes(rule),rule);
assert.match(roadmap,/v0\.14\.190/);
console.log('v0.14.190 mobile menu desktop visibility guard: PASS');
