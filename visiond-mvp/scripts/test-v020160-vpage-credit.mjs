import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPost as createOrder,onRequestGet as listOrders} from '../functions/api/orders/index.js';
import {onRequestGet as getVpagePayment,onRequestPut as putVpagePayment} from '../functions/api/admin/vpage/payment-settings.js';
import {onRequestGet as ownerCredits} from '../functions/api/vpage/credits.js';
import {onRequestGet as adminCredits} from '../functions/api/admin/vpage/credits.js';
import {grantOrder} from '../functions/_orders.js';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE runtime_schema_state(schema_key TEXT PRIMARY KEY,version INTEGER NOT NULL);
INSERT INTO runtime_schema_state VALUES('core',66);
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT UNIQUE,username TEXT UNIQUE,name TEXT,phone TEXT,role TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE products(id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,short_description TEXT,description TEXT,price INTEGER NOT NULL,cover_url TEXT,preview_urls TEXT DEFAULT '[]',category TEXT,file_type TEXT,pages INTEGER DEFAULT 0,status TEXT,source TEXT,product_kind TEXT DEFAULT 'product',member_category TEXT,member_duration_months INTEGER,family_key TEXT,deleted_at TEXT,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,order_no TEXT UNIQUE,user_id INTEGER,total INTEGER,status TEXT DEFAULT 'awaiting_payment',slip_key TEXT,admin_note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,payment_account_type TEXT,payment_bank_name TEXT,payment_account_number TEXT,payment_account_name TEXT,course_owner_user_id INTEGER,seller_course_id INTEGER,payment_qr_url TEXT,discount_kind TEXT,discount_amount INTEGER DEFAULT 0,course_plan TEXT,teacher_revenue INTEGER DEFAULT 0,visiond_revenue INTEGER DEFAULT 0,course_api_fee INTEGER DEFAULT 0,vx_referral_attribution_id TEXT,order_origin TEXT DEFAULT 'customer',sale_price_recorded INTEGER DEFAULT 0,gift_for_order_id INTEGER);
CREATE TABLE order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,product_id INTEGER,product_title TEXT,price INTEGER,vision7_renew_license_id TEXT);
CREATE TABLE entitlements(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,product_id INTEGER,order_id INTEGER,active INTEGER DEFAULT 1,granted_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(user_id,product_id,order_id));
CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,product_id INTEGER,order_id INTEGER,active INTEGER DEFAULT 1,granted_at TEXT DEFAULT CURRENT_TIMESTAMP,used_at TEXT,used_course_id INTEGER,source_entitlement_id INTEGER UNIQUE,source_order_item_id INTEGER UNIQUE);
CREATE TABLE courses(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,owner_user_id INTEGER,course_type TEXT,course_plan TEXT,payment_bank_name TEXT,payment_account_name TEXT,payment_account_number TEXT,payment_qr_url TEXT);
CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '',updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE first_order_promo_state(user_id INTEGER PRIMARY KEY,login_count INTEGER DEFAULT 0,offer_granted_at TEXT,offer_expires_at TEXT,used_order_id INTEGER,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE security_rate_limits(rate_key TEXT PRIMARY KEY,hits INTEGER DEFAULT 0,window_start TEXT DEFAULT CURRENT_TIMESTAMP,blocked_until TEXT);
CREATE TABLE unlock_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,actor_user_id INTEGER,actor_name TEXT,actor_role TEXT,target_user_id INTEGER,target_name TEXT,product_id INTEGER,product_title TEXT,order_id INTEGER,order_no TEXT,method TEXT,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE customer_events(id INTEGER PRIMARY KEY AUTOINCREMENT,visitor_key TEXT,user_id INTEGER,event_type TEXT,path TEXT,product_id INTEGER,order_id INTEGER,source TEXT DEFAULT '',medium TEXT DEFAULT '',campaign TEXT DEFAULT '',content TEXT DEFAULT '',referrer TEXT DEFAULT '',metadata TEXT DEFAULT '{}',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_orders_user_id ON orders(user_id,id DESC);
CREATE INDEX idx_order_items_order_product ON order_items(order_id,product_id);
INSERT INTO users(id,email,username,name,role) VALUES(1,'one@example.test','one','Owner One','user'),(2,'two@example.test','two','Owner Two','user'),(9,'admin@example.test','admin','Admin','admin'),(10,'boss@example.test','boss','Boss','boss');
INSERT INTO sessions VALUES('session-one',1,datetime('now','+1 day'),CURRENT_TIMESTAMP),('session-two',2,datetime('now','+1 day'),CURRENT_TIMESTAMP),('session-admin',9,datetime('now','+1 day'),CURRENT_TIMESTAMP),('session-boss',10,datetime('now','+1 day'),CURRENT_TIMESTAMP);
INSERT INTO settings(key,value) VALUES('promotion_enabled','1'),('promotion_percent','90'),('promotion_scope','all'),('accepting_orders','1'),('first_order_promo_enabled','0');`);
sqlite.exec(readFileSync(new URL('../migrations/0123_vpage_credit_purchase.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/0124_vpage_provisioning.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/0125_vpage_editor.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/0126_vpage_renewal.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/0127_vpage_media.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/0128_vpage_admin_credit_grants.sql',import.meta.url),'utf8'));
sqlite.exec(readFileSync(new URL('../migrations/0129_vpage_create_content.sql',import.meta.url),'utf8'));
sqlite.prepare("UPDATE products SET price=1 WHERE slug='vpage-credit'").run();

const DB={
  prepare(sql){const state={sql,args:[]};return{bind(...args){state.args=args;return this},async first(){return sqlite.prepare(sql).get(...state.args)||null},async all(){return{results:sqlite.prepare(sql).all(...state.args)}},async run(){const result=sqlite.prepare(sql).run(...state.args);return{meta:{changes:Number(result.changes)}}},get __statement(){return state}}},
  async exec(sql){sqlite.exec(sql)},
  async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(statement=>{const {sql,args}=statement.__statement;const result=sqlite.prepare(sql).run(...args);return{meta:{changes:Number(result.changes)}}});sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}
};
const env={DB};
const request=(url,{method='GET',session,body}={})=>new Request(url,{method,headers:{...(session?{cookie:`vd_session=${session}`}:{}) ,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
const body=async response=>({status:response.status,data:await response.json(),headers:response.headers});

const unauth=await body(await ownerCredits({env,request:request('https://visiondonline.com/api/vpage/credits')}));
assert.equal(unauth.status,401,'credit ledger requires login');
const vpagePaymentUrl='https://visiondonline.com/api/admin/vpage/payment-settings',vpageCheckout=()=>createOrder({env,request:request('https://visiondonline.com/api/orders',{method:'POST',session:'session-one',body:{productSlugs:['vpage-credit'],quantities:{'vpage-credit':1}}})}),paymentRequest=(session,details)=>request(vpagePaymentUrl,{method:'PUT',session,body:details});
assert.equal((await body(await getVpagePayment({env,request:request(vpagePaymentUrl)}))).status,401,'dedicated account is not public');
assert.equal((await body(await getVpagePayment({env,request:request(vpagePaymentUrl,{session:'session-admin'})}))).status,403,'regular admin cannot read dedicated account');
assert.equal((await body(await putVpagePayment({env,request:paymentRequest('session-admin',{bank_name:'Mock Bank',account_name:'Test Vpage',account_number:'012-345-6789'})}))).status,403,'regular admin cannot change dedicated account');
const emptyPayment=await body(await getVpagePayment({env,request:request(vpagePaymentUrl,{session:'session-boss'})}));assert.equal(emptyPayment.status,200);assert.equal(emptyPayment.data.configured,false);assert.equal(emptyPayment.headers.get('cache-control'),'private, no-store');
const missingPayment=await body(await vpageCheckout());assert.equal(missingPayment.status,503,'Vpage checkout fails closed without its own account');assert.equal(missingPayment.data.code,'VPAGE_PAYMENT_ACCOUNT_NOT_CONFIGURED');assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM orders').get().count,0);
const invalidPayment=await body(await putVpagePayment({env,request:paymentRequest('session-boss',{bank_name:'Mock Bank',account_name:'Test Vpage',account_number:'bad'})}));assert.equal(invalidPayment.status,400);assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM settings WHERE key LIKE 'vpage_%'").get().count,0,'invalid configuration writes no partial rows');
const configured=await body(await putVpagePayment({env,request:paymentRequest('session-boss',{bank_name:'Mock Bank',account_name:'Test Vpage',account_number:'012-345-6789'})}));assert.equal(configured.status,200);assert.equal(configured.data.item.account_number,'012-345-6789');assert.equal(sqlite.prepare("SELECT COUNT(*) count FROM settings WHERE key IN ('vpage_bank_name','vpage_account_name','vpage_account_number')").get().count,3);
const paymentPlan=sqlite.prepare("EXPLAIN QUERY PLAN SELECT key,value FROM settings WHERE key IN ('vpage_bank_name','vpage_account_name','vpage_account_number')").all().map(row=>String(row.detail)).join(' | ');assert.match(paymentPlan,/sqlite_autoindex_settings_1|PRIMARY KEY/i,'dedicated profile reads only indexed settings keys');
const created=await body(await createOrder({env,request:request('https://visiondonline.com/api/orders',{method:'POST',session:'session-one',body:{productSlugs:['vpage-credit'],quantities:{'vpage-credit':1}}})}));
assert.equal(created.status,201);
assert.equal(created.data.bank.account_number,'012-345-6789','checkout response shows dedicated account');assert.equal(created.data.bank.active_account,'vpage');
assert.equal(created.data.subtotal,99900,'price is fixed on server despite tampered product price');
assert.equal(created.data.discount,0,'Vpage is excluded from promotions');
assert.equal(created.data.total,99900);
assert.equal(created.data.items.length,1);
assert.equal(created.data.items[0].price,99900);
const duplicatePending=await body(await createOrder({env,request:request('https://visiondonline.com/api/orders',{method:'POST',session:'session-one',body:{productSlugs:['vpage-credit']}})}));
assert.equal(duplicatePending.status,409,'same customer cannot create duplicate pending Vpage order');
const order=sqlite.prepare('SELECT * FROM orders WHERE id=?').get(created.data.id);
assert.equal(order.payment_account_number,'012-345-6789','new Vpage order snapshots dedicated account');
assert.equal(order.payment_account_type,'vpage');
sqlite.prepare("INSERT INTO products(slug,title,price,status,product_kind,category) VALUES('regular-test','Regular Test',5000,'published','product','test')").run();
const regular=await body(await createOrder({env,request:request('https://visiondonline.com/api/orders',{method:'POST',session:'session-two',body:{productSlugs:['regular-test']}})}));assert.equal(regular.status,201);assert.notEqual(regular.data.bank.account_number,'012-345-6789','unrelated product retains shared account');
const regularOrder=sqlite.prepare('SELECT payment_account_number FROM orders WHERE id=?').get(regular.data.id);assert.equal(regularOrder.payment_account_number,regular.data.bank.account_number);
const changed=await body(await putVpagePayment({env,request:paymentRequest('session-boss',{bank_name:'Mock Bank Two',account_name:'Test Vpage Two',account_number:'987-654-3210'})}));assert.equal(changed.status,200);
const reloaded=await body(await listOrders({env,request:request('https://visiondonline.com/api/orders',{session:'session-one'})}));assert.equal(reloaded.status,200);assert.equal(reloaded.data.items.find(item=>item.id===created.data.id).bank.account_number,'012-345-6789','existing Vpage order retains its original snapshot after settings change');
sqlite.prepare("UPDATE orders SET status='pending_review' WHERE id=?").run(order.id);
const stale={...order,status:'pending_review'};
assert.equal(await grantOrder(env,stale,{id:9,name:'Admin',role:'admin'}),1,'approval grants one credit');
assert.equal(await grantOrder(env,stale,{id:9,name:'Admin',role:'admin'}),0,'duplicate approval is idempotent');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM vpage_credits WHERE order_id=?').get(order.id).count,1);
assert.equal(sqlite.prepare('SELECT service_days FROM vpage_credits WHERE order_id=?').get(order.id).service_days,30,'credit records the fixed service term');
assert.equal(sqlite.prepare('SELECT COUNT(*) count FROM entitlements WHERE order_id=?').get(order.id).count,0,'Vpage credit is not a file entitlement');

const secondPurchase=await body(await createOrder({env,request:request('https://visiondonline.com/api/orders',{method:'POST',session:'session-one',body:{productSlugs:['vpage-credit']}})}));
assert.equal(secondPurchase.status,201,'paid customer may buy another credit in a new order');
sqlite.prepare("INSERT INTO orders(order_no,user_id,total,status) VALUES('OTHER-ORDER',2,99900,'paid')").run();
const otherOrder=sqlite.prepare("SELECT id FROM orders WHERE order_no='OTHER-ORDER'").get();
const product=sqlite.prepare("SELECT id FROM products WHERE slug='vpage-credit'").get();
sqlite.prepare("INSERT INTO order_items(order_id,product_id,product_title,price) VALUES(?,?,?,99900)").run(otherOrder.id,product.id,'Vpage Credit');
const otherItem=sqlite.prepare('SELECT id FROM order_items WHERE order_id=?').get(otherOrder.id);
sqlite.prepare("INSERT INTO vpage_credits(user_id,order_id,source_order_item_id) VALUES(?,?,?)").run(2,otherOrder.id,otherItem.id);
for(let index=0;index<30;index++){
  const orderNo=`OWNER-PAGE-${String(index).padStart(2,'0')}`;
  sqlite.prepare("INSERT INTO orders(order_no,user_id,total,status) VALUES(?,1,99900,'paid')").run(orderNo);
  const extraOrder=sqlite.prepare('SELECT id FROM orders WHERE order_no=?').get(orderNo);
  sqlite.prepare("INSERT INTO order_items(order_id,product_id,product_title,price) VALUES(?,?,?,99900)").run(extraOrder.id,product.id,'Vpage Credit');
  const extraItem=sqlite.prepare('SELECT id FROM order_items WHERE order_id=?').get(extraOrder.id);
  sqlite.prepare("INSERT INTO vpage_credits(user_id,order_id,source_order_item_id) VALUES(?,?,?)").run(1,extraOrder.id,extraItem.id);
}

const ownerPage=await body(await ownerCredits({env,request:request('https://visiondonline.com/api/vpage/credits?limit=99&user_id=2',{session:'session-one'})}));
assert.equal(ownerPage.status,200);
assert.equal(ownerPage.data.pagination.limit,24,'owner list is capped at 24');
assert.equal(ownerPage.data.balance,31);
assert.equal(ownerPage.data.items.length,24);
assert.equal(ownerPage.data.pagination.has_more,true);
assert.ok(ownerPage.data.items.every(item=>item.order_no!== 'OTHER-ORDER'),'owner cannot select another customer');
assert.equal(ownerPage.headers.get('cache-control'),'private, no-store');
const ownerNext=await body(await ownerCredits({env,request:request(`https://visiondonline.com/api/vpage/credits?limit=24&cursor=${ownerPage.data.pagination.next_cursor}`,{session:'session-one'})}));
const ownerIds=[...ownerPage.data.items,...ownerNext.data.items].map(item=>item.id);
assert.equal(ownerIds.length,31,'keyset pages return every owner credit');
assert.equal(new Set(ownerIds).size,31,'keyset pages contain no duplicates');
const regularAdminRoute=await body(await adminCredits({env,request:request('https://visiondonline.com/api/admin/vpage/credits',{session:'session-one'})}));
assert.equal(regularAdminRoute.status,403);
const adminPage=await body(await adminCredits({env,request:request('https://visiondonline.com/api/admin/vpage/credits?limit=99&user_id=2',{session:'session-admin'})}));
assert.equal(adminPage.status,200);
assert.equal(adminPage.data.pagination.limit,24,'admin list is capped at 24');
assert.deepEqual(adminPage.data.items.map(item=>item.user_id),[2]);
assert.equal(adminPage.headers.get('cache-control'),'private, no-store');

const ownerPlan=sqlite.prepare("EXPLAIN QUERY PLAN SELECT c.id,c.status,c.service_days,c.granted_at,c.consumed_at,o.order_no FROM vpage_credits c JOIN orders o ON o.id=c.order_id WHERE c.user_id=? AND c.id<? ORDER BY c.id DESC LIMIT ?").all(1,999999,25).map(row=>row.detail).join(' ');
const balancePlan=sqlite.prepare("EXPLAIN QUERY PLAN SELECT COUNT(*) FROM vpage_credits WHERE user_id=? AND status='available'").all(1).map(row=>row.detail).join(' ');
assert.match(ownerPlan,/idx_vpage_credits_owner_cursor/,'owner keyset list uses owner cursor index');
assert.match(balancePlan,/idx_vpage_credits_owner_status/,'balance uses owner status index');

const sources=['../functions/api/vpage/credits.js','../functions/api/admin/vpage/credits.js','../public/vpage.js','../public/vpage-admin.js'].map(path=>readFileSync(new URL(path,import.meta.url),'utf8')).join('\n');
assert.doesNotMatch(sources,/customer[_-]?key|secret|ciphertext/i,'purchase-only surface must not invent or expose a customer key');
const storefront=readFileSync(new URL('../public/vpage.html',import.meta.url),'utf8');
assert.match(storefront,/1 เครดิตใช้สร้าง Sales Page ได้ 1 หน้า/);
assert.match(storefront,/พร้อมอายุบริการ 30 วัน/);
assert.match(sources,/productSlugs:\[offer\.slug\]/,'storefront reuses the native order API');
assert.match(sources,/\/api\/orders\/\$\{activeOrder\.id\}\/slip/,'storefront reuses the native slip API');
assert.doesNotMatch(storefront,/สร้างหน้าใหม่|เลือกโดเมน|เผยแพร่หน้า/,'purchase patch must not expose provisioning controls');
console.log('PASS Vpage credit purchase, authorization, idempotency, pagination and index contract');
