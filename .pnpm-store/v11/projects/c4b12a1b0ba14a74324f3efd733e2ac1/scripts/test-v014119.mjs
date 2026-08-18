import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(ok,message)=>{if(!ok)throw new Error(message)};
assert(read('VERSION.txt').trim()==='v0.14.119','VERSION must be v0.14.119');
const shared=read('public/shared-nav.js');
for(const label of ['หน้าแรก','สินค้าดิจิทัล','สร้างตะกร้าคอร์ส','ระบบ V-Learning','VBot','บทความ','เกี่ยวกับเรา'])assert(shared.includes(label),`canonical nav missing ${label}`);
assert(shared.includes('aria-current="page"'),'canonical nav must expose current page');
for(const page of ['index.html','digital-products.html','courses.html','bots.html','privacy.html','terms.html']){const html=read(`public/${page}`);assert(html.includes('/shared-nav.js?v=014119'),`${page} missing canonical nav`);assert(html.includes('/header-shell.css?v=014119'),`${page} missing canonical header CSS`);assert(html.includes('/header-shell.js?v=014119'),`${page} missing canonical header runtime`)}
const privacy=read('public/privacy.html'),terms=read('public/terms.html');
assert(privacy.includes('https://visiondonline.com/privacy.html'),'privacy canonical URL missing');
assert(terms.includes('https://visiondonline.com/terms.html'),'terms canonical URL missing');
for(const token of ['LINE','Facebook','Webhook','Channel Secret','Access Token','API'])assert(privacy.includes(token)||terms.includes(token),`platform policy missing ${token}`);
for(const forbidden of ['การดัก Token','โปรแกรมกดหน้าจอ','คุกกี้ เซสชัน'])assert(terms.includes(forbidden),`prohibited integration rule missing ${forbidden}`);
console.log('v0.14.119 canonical navigation and platform policy checks passed');
