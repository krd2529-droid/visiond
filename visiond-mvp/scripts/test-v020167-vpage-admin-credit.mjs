import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {env} from './test-vtools-access.mjs';
import {onRequestGet as listCredits,onRequestPost as grantCredits} from '../functions/api/admin/vpage/credits.js';
import {onRequestGet as findCustomer} from '../functions/api/admin/vpage/customers.js';
import {onRequestGet as ownerCredits} from '../functions/api/vpage/credits.js';

for(const name of ['0123_vpage_credit_purchase.sql','0124_vpage_provisioning.sql','0125_vpage_editor.sql','0126_vpage_renewal.sql','0127_vpage_media.sql'])await env.DB.exec(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
await env.DB.prepare("INSERT INTO users(id,email,username,name,password_hash,role) VALUES(990,'upgrade-vpage@example.invalid','upgrade-vpage','Upgrade Vpage','x','customer')").run();
await env.DB.prepare("INSERT INTO orders(id,order_no,user_id,total,status) VALUES(990,'VP-UPGRADE-990',990,99900,'paid')").run();
await env.DB.prepare("INSERT INTO order_items(id,order_id,product_id,product_title,price) SELECT 990,990,id,title,99900 FROM products WHERE slug='vpage-credit'").run();
await env.DB.prepare("INSERT INTO vpage_credits(id,user_id,order_id,source_order_item_id,status) VALUES(990,990,990,990,'available')").run();
await env.DB.prepare("INSERT INTO vpage_pages(id,user_id,credit_id,domain_id,slug,display_name,status,create_idempotency_key,create_request_hash) VALUES('vpl_99999999999999999999999999999999',990,990,'dom_smartlinkpage','upgrade-shop','Upgrade Shop','active','upgrade-page-key-0001','upgrade-page-hash')").run();
await env.DB.prepare("INSERT INTO vpage_credit_claims(id,credit_id,page_id,state) VALUES('vpc_99999999999999999999999999999999',990,'vpl_99999999999999999999999999999999','committed')").run();
await env.DB.prepare("INSERT INTO vpage_renewal_requests(id,user_id,page_id,credit_id,idempotency_key,request_hash,state) VALUES('vpr_99999999999999999999999999999999',990,'vpl_99999999999999999999999999999999',990,'upgrade-renew-key-0001','upgrade-renew-hash','committed')").run();
await env.DB.prepare("INSERT INTO vpage_media(id,owner_id,page_id,object_key,mime_type,file_size,width,height,content_hash,idempotency_key,request_hash,state) VALUES('vpm_99999999999999999999999999999999',990,'vpl_99999999999999999999999999999999','vpage/990/upgrade.webp','image/webp',128,10,10,'upgrade-media-hash','upgrade-media-key-0001','upgrade-media-request','ready')").run();
await env.DB.prepare("INSERT INTO vpage_media_save_ops(id,owner_id,page_id,vpage_id,set_no,idempotency_key,request_hash,state) VALUES('vps_99999999999999999999999999999999',990,'vpl_99999999999999999999999999999999','remote-upgrade-page',1,'upgrade-save-key-0001','upgrade-save-hash','committed')").run();
await env.DB.prepare("INSERT INTO vpage_media_pending_refs(op_id,media_id,slot_key) VALUES('vps_99999999999999999999999999999999','vpm_99999999999999999999999999999999','hero')").run();
await env.DB.prepare("INSERT INTO vpage_media_refs(page_id,owner_id,set_no,slot_key,media_id) VALUES('vpl_99999999999999999999999999999999',990,1,'hero','vpm_99999999999999999999999999999999')").run();
await env.DB.exec(await readFile(new URL('../migrations/0128_vpage_admin_credit_grants.sql',import.meta.url),'utf8'));
await env.DB.exec(await readFile(new URL('../migrations/0129_vpage_create_content.sql',import.meta.url),'utf8'));
assert.equal((await env.DB.prepare("SELECT create_content_json,create_active_set FROM vpage_pages WHERE id='vpl_99999999999999999999999999999999'").first()).create_content_json,'','populated upgrade preserves existing page with an explicitly empty legacy create snapshot');
assert.equal((await env.DB.prepare("SELECT create_active_set FROM vpage_pages WHERE id='vpl_99999999999999999999999999999999'").first()).create_active_set,1,'populated upgrade defaults an existing page to content set 1');
assert.equal((await env.DB.prepare('SELECT COUNT(*) count FROM vpage_credits WHERE id=990 AND order_id=990').first()).count,1,'populated upgrade preserves purchase credit');
assert.equal((await env.DB.prepare('SELECT COUNT(*) count FROM vpage_credit_claims WHERE credit_id=990').first()).count,1,'populated upgrade preserves claim FK');
assert.equal((await env.DB.prepare('SELECT COUNT(*) count FROM vpage_renewal_requests WHERE credit_id=990').first()).count,1,'populated upgrade preserves renewal FK');
assert.equal((await env.DB.prepare("SELECT COUNT(*) count FROM vpage_media_refs WHERE media_id='vpm_99999999999999999999999999999999'").first()).count,1,'populated upgrade preserves media refs');
assert.equal((await env.DB.prepare("SELECT COUNT(*) count FROM vpage_media_pending_refs WHERE op_id='vps_99999999999999999999999999999999'").first()).count,1,'populated upgrade preserves pending media refs');
assert.equal((await env.DB.prepare('SELECT COUNT(*) count FROM pragma_foreign_key_check').first()).count,0,'populated upgrade leaves every Vpage foreign key valid');
await env.DB.prepare("INSERT INTO users(id,email,username,name,password_hash,role) VALUES(901,'boss-vpage@example.invalid','boss-vpage','Boss Vpage','x','boss'),(902,'user-vpage@example.invalid','user-vpage','User Vpage','x','customer'),(903,'admin-vpage@example.invalid','admin-vpage','Admin Vpage','x','admin'),(904,'no-user@example.invalid',NULL,'No Username','x','customer'),(905,'collision@example.invalid','shared-identity','Username Match','x','customer'),(906,'shared-identity','email-match','Email Match','x','customer')").run();
await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('boss-vpage-session',901,datetime('now','+1 day')),('user-vpage-session',902,datetime('now','+1 day')),('admin-vpage-session',903,datetime('now','+1 day'))").run();

const ctx=(path,{method='GET',session='boss-vpage-session',body,key}={})=>({env,request:new Request(`https://visiondonline.com${path}`,{method,headers:{cookie:`vd_session=${session}`,...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined})});
const json=async response=>({status:response.status,data:await response.json()});

let response=await json(await findCustomer(ctx('/api/admin/vpage/customers?q=user-vpage')));assert.equal(response.status,200);assert.equal(response.data.items[0].id,902);
response=await json(await findCustomer(ctx('/api/admin/vpage/customers?q=no-user%40example.invalid')));assert.deepEqual(response.data.items.map(item=>item.id),[904],'email lookup finds a customer with null username');
response=await json(await findCustomer(ctx('/api/admin/vpage/customers?q=shared-identity')));assert.deepEqual(response.data.items.map(item=>item.id),[905,906],'cross-field collision returns both exact customers for explicit Boss selection');
response=await json(await findCustomer(ctx('/api/admin/vpage/customers?q=user-vpage',{session:'admin-vpage-session'})));assert.equal(response.status,403,'only Boss can search Vpage credit recipients');

const key='vpage-grant:test-00000001',payload={user_id:902,quantity:2,note:'ทดสอบเครดิต Vpage'};
response=await json(await grantCredits(ctx('/api/admin/vpage/credits',{method:'POST',body:payload,key})));assert.equal(response.status,201,JSON.stringify(response.data));assert.equal(response.data.credits_added,2);assert.equal(response.data.credit_balance,2);assert.equal(response.data.replayed,false);
const grantId=response.data.grant_id;
response=await json(await grantCredits(ctx('/api/admin/vpage/credits',{method:'POST',body:payload,key})));assert.equal(response.status,200);assert.equal(response.data.replayed,true);assert.equal(response.data.credit_balance,2,'idempotent replay cannot double grant Vpage credits');
response=await json(await grantCredits(ctx('/api/admin/vpage/credits',{method:'POST',body:{...payload,quantity:3},key})));assert.equal(response.status,409,'changed payload with the same key conflicts');
response=await json(await grantCredits(ctx('/api/admin/vpage/credits',{method:'POST',session:'admin-vpage-session',body:payload,key:'vpage-grant:test-00000002'})));assert.equal(response.status,403,'Admin cannot grant Vpage credits');

assert.equal((await env.DB.prepare('SELECT COUNT(*) count FROM vpage_credit_grants WHERE id=?').bind(grantId).first()).count,1);
assert.equal((await env.DB.prepare('SELECT COUNT(*) count FROM vpage_credits WHERE grant_id=?').bind(grantId).first()).count,2);
assert.equal((await env.DB.prepare('SELECT COUNT(*) count FROM orders WHERE user_id=902').first()).count,0,'Boss Vpage grants do not fabricate commerce orders');

response=await json(await listCredits(ctx('/api/admin/vpage/credits?user_id=902&limit=24')));assert.equal(response.status,200);assert.equal(response.data.items.length,2);assert.ok(response.data.items.every(item=>item.source_type==='boss_grant'&&item.granted_by_name==='Boss Vpage'));
response=await json(await ownerCredits(ctx('/api/vpage/credits?limit=24',{session:'user-vpage-session'})));assert.equal(response.status,200);assert.equal(response.data.balance,2);assert.ok(response.data.items.every(item=>item.source_type==='boss_grant'&&item.order_no===null));

const listPlan=(await env.DB.prepare("EXPLAIN QUERY PLAN SELECT c.id FROM vpage_credits c WHERE c.user_id=? AND c.id<? ORDER BY c.id DESC LIMIT ?").bind(902,999999,25).all()).results.map(row=>row.detail).join(' | ');assert.match(listPlan,/idx_vpage_credits_owner_cursor/);
const grantPlan=(await env.DB.prepare("EXPLAIN QUERY PLAN SELECT id FROM vpage_credit_grants WHERE idempotency_key=?").bind(key).all()).results.map(row=>row.detail).join(' | ');assert.match(grantPlan,/sqlite_autoindex_vpage_credit_grants_2|idempotency/);
const usernamePlan=(await env.DB.prepare("EXPLAIN QUERY PLAN SELECT id FROM users WHERE username=? COLLATE NOCASE AND role IN ('user','customer')").bind('user-vpage').all()).results.map(row=>row.detail).join(' | ');assert.match(usernamePlan,/idx_users_vpage_username_lookup/);
const emailPlan=(await env.DB.prepare("EXPLAIN QUERY PLAN SELECT id FROM users WHERE email=? COLLATE NOCASE AND role IN ('user','customer')").bind('user-vpage@example.invalid').all()).results.map(row=>row.detail).join(' | ');assert.match(emailPlan,/idx_users_vpage_email_lookup/);

const html=await readFile(new URL('../public/vpage-admin.html',import.meta.url),'utf8'),js=await readFile(new URL('../public/vpage-admin.js',import.meta.url),'utf8'),admin=await readFile(new URL('../public/admin.html',import.meta.url),'utf8');
for(const label of ['เพิ่มเครดิต Vpage','จำนวนเครดิต Vpage','ประวัติเครดิต Vpage'])assert.match(html,new RegExp(label));assert.match(js,/ยืนยันเพิ่มเครดิต Vpage/);assert.match(js,/เครดิต Vpage พร้อมใช้/);assert.match(admin,/class="admin-tab-link boss-only-danger" href="\/vpage-admin\.html"/);
console.log('PASS Boss-only audited idempotent Vpage credit grant, no fake order, owner balance/history, indexed plans and explicit เครดิต Vpage labels');
