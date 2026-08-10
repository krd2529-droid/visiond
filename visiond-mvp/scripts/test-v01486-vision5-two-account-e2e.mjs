import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const db=new DatabaseSync(':memory:');
db.exec(`
  PRAGMA foreign_keys=ON;
  CREATE TABLE users(id INTEGER PRIMARY KEY,role TEXT NOT NULL);
  CREATE TABLE products(id INTEGER PRIMARY KEY,slug TEXT UNIQUE,title TEXT,category TEXT,product_kind TEXT,status TEXT,deleted_at TEXT);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,order_no TEXT UNIQUE,user_id INTEGER,total INTEGER,status TEXT,slip_key TEXT,slip_verification_status TEXT,course_owner_user_id INTEGER,seller_course_id INTEGER);
  CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_id INTEGER,product_title TEXT,price INTEGER);
  CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,order_id INTEGER,active INTEGER DEFAULT 1,used_course_id INTEGER,source_order_item_id INTEGER UNIQUE);
  CREATE TABLE courses(id INTEGER PRIMARY KEY,product_id INTEGER UNIQUE,owner_user_id INTEGER,license_entitlement_id INTEGER,basket_binding_locked INTEGER DEFAULT 0,review_status TEXT,active INTEGER DEFAULT 0,course_type TEXT,course_origin TEXT);
  CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,order_id INTEGER,active INTEGER DEFAULT 1,UNIQUE(user_id,product_id,order_id));
  CREATE TABLE course_lessons(id INTEGER PRIMARY KEY,course_id INTEGER,title TEXT,video_key TEXT);
  INSERT INTO users VALUES(1,'boss'),(2,'user'),(3,'user');
  INSERT INTO products VALUES(10,'course-selling-rights','สิทธิ์เปิดตะกร้า','resale-rights','product','published',NULL);
  INSERT INTO products VALUES(20,'seller-course','คอร์สผู้ขาย','online-course','course','draft',NULL);
  INSERT INTO courses VALUES(30,20,2,NULL,0,'draft',0,'online_course','seller_rights');
  INSERT INTO course_lessons VALUES(40,30,'EP 1','lessons/ep1.mp4');
  INSERT INTO orders VALUES(100,'RIGHTS-100',2,99800,'pending_review','slips/rights.jpg','manual',NULL,NULL);
  INSERT INTO order_items VALUES(1001,100,10,'สิทธิ์เปิดตะกร้า',49900),(1002,100,10,'สิทธิ์เปิดตะกร้า',49900);
`);

// Boss manual approval: claim the pending order and create one credit per real order item.
const rights=db.prepare("SELECT oi.id,oi.product_id FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=? AND p.category='resale-rights' ORDER BY oi.id").all(100);
assert.equal(rights.length,2);
for(const item of rights)db.prepare("INSERT OR IGNORE INTO course_right_credits(user_id,product_id,order_id,active,source_order_item_id) SELECT 2,?,100,1,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=100 AND status='pending_review')").run(item.product_id,item.id);
assert.equal(db.prepare("UPDATE orders SET status='paid' WHERE id=100 AND status='pending_review'").run().changes,1);
assert.equal(db.prepare('SELECT COUNT(*) total FROM course_right_credits WHERE user_id=2').get().total,2);

// Replaying approval must neither reclaim the order nor duplicate credits.
for(const item of rights)db.prepare("INSERT OR IGNORE INTO course_right_credits(user_id,product_id,order_id,active,source_order_item_id) SELECT 2,?,100,1,? WHERE EXISTS(SELECT 1 FROM orders WHERE id=100 AND status='pending_review')").run(item.product_id,item.id);
assert.equal(db.prepare("UPDATE orders SET status='paid' WHERE id=100 AND status='pending_review'").run().changes,0);
assert.equal(db.prepare('SELECT COUNT(*) total FROM course_right_credits WHERE user_id=2').get().total,2);

// Seller permanently binds exactly one credit, then Boss publishes the course.
const credit=db.prepare('SELECT id FROM course_right_credits WHERE user_id=2 AND active=1 AND used_course_id IS NULL ORDER BY id LIMIT 1').get();
assert.ok(credit?.id);
assert.equal(db.prepare("UPDATE courses SET license_entitlement_id=?,basket_binding_locked=1,review_status='pending' WHERE id=30 AND owner_user_id=2 AND license_entitlement_id IS NULL").run(-credit.id).changes,1);
assert.equal(db.prepare('UPDATE course_right_credits SET active=0,used_course_id=30 WHERE id=? AND user_id=2 AND active=1 AND used_course_id IS NULL').run(credit.id).changes,1);
assert.equal(db.prepare("UPDATE courses SET review_status='approved',active=1 WHERE id=30 AND review_status='pending'").run().changes,1);
db.prepare("UPDATE products SET status='published' WHERE id=20").run();

// A different account buys the published seller course and receives learning access once.
db.prepare("INSERT INTO orders VALUES(200,'COURSE-200',3,79900,'pending_review','slips/course.jpg','verified',2,30)").run();
db.prepare("INSERT INTO order_items VALUES(2001,200,20,'คอร์สผู้ขาย',79900)").run();
db.prepare("INSERT OR IGNORE INTO entitlements(user_id,product_id,order_id,active) SELECT 3,20,200,1 WHERE EXISTS(SELECT 1 FROM orders WHERE id=200 AND status='pending_review')").run();
assert.equal(db.prepare("UPDATE orders SET status='paid' WHERE id=200 AND status='pending_review'").run().changes,1);
assert.equal(db.prepare("SELECT COUNT(*) total FROM entitlements WHERE user_id=3 AND product_id=20 AND active=1").get().total,1);
assert.equal(db.prepare("SELECT COUNT(*) total FROM courses c JOIN products p ON p.id=c.product_id JOIN entitlements e ON e.product_id=p.id AND e.user_id=3 AND e.active=1 WHERE c.id=30 AND c.active=1 AND c.review_status='approved' AND p.status='published'").get().total,1);

// Lock the production contracts that implement the simulated flow.
const read=file=>fs.readFileSync(file,'utf8');
const grant=read('functions/_orders.js'),publish=read('functions/api/course-seller/[id]/publish.js');
const approve=read('functions/api/admin/course-seller-reviews/[id].js'),access=read('functions/_courses.js');
const orderApi=read('functions/api/orders/index.js');
assert.match(grant,/source_order_item_id/);assert.match(grant,/status='pending_review'/);
assert.match(publish,/basket_binding_locked=1/);assert.match(publish,/used_course_id=\?/);
assert.match(approve,/productStatus:'published'/);assert.match(access,/FROM entitlements WHERE user_id=\? AND product_id=\?/);
assert.match(orderApi,/c\.id seller_course_id/);
console.log('v0.14.86 Vision 5 two-account rights-to-learning E2E passed');
