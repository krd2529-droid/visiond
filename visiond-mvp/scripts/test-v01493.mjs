import assert from 'node:assert/strict';import fs from 'node:fs';
const cart=fs.readFileSync('public/cart.js','utf8'),login=fs.readFileSync('public/login.html','utf8'),register=fs.readFileSync('public/register.html','utf8'),hub=fs.readFileSync('public/my-hub.js','utf8'),dashboard=fs.readFileSync('public/dashboard.html','utf8'),member=fs.readFileSync('public/member-modern-ai.css','utf8'),md=fs.readFileSync('public/member-dashboard.js','utf8');
assert.match(cart,/visiond-bundle-promo\.gif\?/);assert.ok(fs.existsSync('public/assets/visiond-bundle-promo.gif'));
for(const html of [login,register]){assert.match(html,/member-modern-ai\.css\?v=014\d+/);assert.match(html,/vds-card/);assert.match(html,/vds-btn--primary/)}
for(const id of ['loginPageForm','registerPageForm','pageAuthMsg'])assert.ok(login.includes(id)||register.includes(id));
for(const id of ['hubSidebar','dashOverview','dashOrders','dashDownloads','dashboardOrders','dashboardDownloads','dashLogout'])assert.ok(dashboard.includes(id),`dashboard ${id}`);
for(const contract of ['/api/orders','dashboardDownloads','download-tile','product.html?slug='])assert.ok(md.includes(contract),`member ${contract}`);
assert.match(hub,/ซื้อสิทธิ์ก่อนเพื่อรับเครดิต/);assert.match(hub,/1 เครดิตสร้างร่างตะกร้าคอร์ส 1 ใบ/);
for(const rule of ['min-height:44px','focus-visible','max-width:760px','--vd-ai-midnight'])assert.ok(member.includes(rule),`css ${rule}`);assert.equal((member.match(/{/g)||[]).length,(member.match(/}/g)||[]).length);
console.log('v0.14.93 Member journey passed; promo intent governed by latest correction');
