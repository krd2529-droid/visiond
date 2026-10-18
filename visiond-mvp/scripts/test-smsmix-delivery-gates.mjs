import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost as uploadRelease } from '../functions/api/admin/vision7/releases.js';
import { onRequestGet as downloadRelease } from '../functions/api/vision7/releases/[id]/download.js';
import { onRequestPost as reconcileOrder } from '../functions/api/admin/vision7/smsmix-reconcile.js';
import { onRequestGet as missingOrders } from '../functions/api/admin/vision7/smsmix-missing.js';

const checkoutSource = readFileSync(new URL('../functions/api/orders/index.js', import.meta.url), 'utf8');
const planExpression = checkoutSource.match(/(\(SELECT q\.id FROM vision7_plans q[^\n]*?LIMIT 1\)) vision7_plan_id,/)?.[1];
const priceExpression = checkoutSource.match(/(\(SELECT q\.offer_price FROM vision7_plans q[^\n]*?LIMIT 1\)) vision7_offer_price/)?.[1];
assert.ok(planExpression, 'checkout plan lookup exists');
assert.ok(priceExpression, 'checkout offer price lookup exists');
const saleGate = new DatabaseSync(':memory:');
saleGate.exec(`CREATE TABLE products(id INTEGER PRIMARY KEY,status TEXT);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT,active INTEGER);
CREATE TABLE vision7_plans(id INTEGER PRIMARY KEY,program_id INTEGER,product_id INTEGER,active INTEGER,plan_code TEXT,offer_price INTEGER);
CREATE UNIQUE INDEX idx_sale_gate_plan_product ON vision7_plans(product_id);
INSERT INTO products VALUES(11,'published');
INSERT INTO vision7_programs VALUES(9,'sms-mix',0);
INSERT INTO vision7_plans VALUES(10,9,11,1,'monthly',99900);`);
const eligiblePlan = saleGate.prepare(`SELECT ${planExpression} plan_id,${priceExpression} offer_price FROM products p WHERE p.id=11`);
assert.deepEqual({ ...eligiblePlan.get() }, { plan_id: null, offer_price: null }, 'inactive VSMS program cannot become payable even if a product remains published');
saleGate.prepare('UPDATE vision7_programs SET active=1 WHERE id=9').run();
assert.deepEqual({ ...eligiblePlan.get() }, { plan_id: 10, offer_price: 99900 }, 'published VSMS program exposes the paid plan');
assert.match(saleGate.prepare(`EXPLAIN QUERY PLAN SELECT ${planExpression} plan_id FROM products p WHERE p.id=11`).all().map(row => row.detail).join(' '), /idx_sale_gate_plan_product/, 'checkout probes an indexed product-plan relation');
saleGate.close();

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE vision7_licenses(id TEXT PRIMARY KEY,user_id INTEGER,program_id INTEGER,status TEXT,expires_at TEXT,created_at TEXT);
CREATE TABLE vision7_releases(id INTEGER PRIMARY KEY,program_id INTEGER,status TEXT,object_key TEXT,file_name TEXT,mime_type TEXT,file_size INTEGER,sha256 TEXT,version TEXT);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT UNIQUE,platform_type TEXT);
CREATE TABLE vision7_plans(id INTEGER PRIMARY KEY,program_id INTEGER,product_id INTEGER UNIQUE);
CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_id INTEGER);
CREATE TABLE orders(id INTEGER PRIMARY KEY,user_id INTEGER,status TEXT,order_no TEXT,total INTEGER);
CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT);
CREATE TABLE vision7_order_fulfillments(order_item_id INTEGER PRIMARY KEY,order_id INTEGER,license_id TEXT,action TEXT);
CREATE TABLE vision7_smsmix_bindings(license_id TEXT PRIMARY KEY,device_hash TEXT);
CREATE INDEX idx_order_items_order_product ON order_items(order_id,product_id);
CREATE INDEX idx_order_items_product_retention ON order_items(product_id,order_id);
CREATE INDEX idx_v7_license_program ON vision7_licenses(program_id,status,created_at DESC);
ALTER TABLE vision7_licenses ADD COLUMN key_hash TEXT;
CREATE UNIQUE INDEX idx_v7_license_key_hash ON vision7_licenses(key_hash);
INSERT INTO vision7_releases VALUES(7,9,'published','vsms.apk','VSMS.apk','application/vnd.android.package-archive',3,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','0.5.4');
INSERT INTO vision7_licenses(id,user_id,program_id,status,expires_at,created_at,key_hash) VALUES('old-active',1,9,'active','2099-01-01 00:00:00','2026-01-01 00:00:00','key-one'),('new-refunded',1,9,'refunded','2099-01-01 00:00:00','2026-02-01 00:00:00','key-two');
INSERT INTO vision7_programs VALUES(9,'sms-mix','android');
INSERT INTO vision7_plans VALUES(10,9,11);
INSERT INTO order_items VALUES(801,88,11);
INSERT INTO orders VALUES(88,1,'paid','VSMS-88',99900);
INSERT INTO users VALUES(1,'VSMS buyer','buyer@example.com');`);

let storageWrites = 0, releaseSelect = '', missingSelect = '', reconciled = 0;
const schemaColumns = ['app_name','app_description','cover_url','product_id','offer_price','key_ciphertext','renewed_at','vision7_renew_license_id','participant_ciphertext','last_customer_message_at','last_outbound_at','attempts','last_attempt_at','event_timestamp'];
const env = { FILES: {
  async put() { storageWrites++; },
  async get() { return { body: new Uint8Array([1,2,3]), writeHttpMetadata() {} }; },
}, DB: { prepare(sql) { return {
  bind(...args) { this.args = args; return this; },
  async run() { return { meta: { changes: 0 } }; },
  async all() { if (sql.includes('missing_item_id')) { missingSelect = sql; return { results: sqlite.prepare(sql).all(...this.args) }; } return { results: sql.startsWith('PRAGMA table_info') ? schemaColumns.map(name => ({ name })) : sql.includes('FROM order_items oi JOIN vision7_plans q') ? [{ order_item_id: 801, vision7_renew_license_id: null, plan_id: 10, program_id: 9, plan_code: 'monthly', duration_days: 30, max_devices: 1, platform_type: 'android', program_code: 'sms-mix' }] : [] }; },
  async first() {
    if (sql.includes('runtime_schema_state')) return { version: 999999 };
    if (sql.includes('FROM sessions')) return { id: 1, role: 'boss' };
    if (sql.startsWith('SELECT id,code,active,current_version,minimum_version,force_update FROM vision7_programs')) return { id: 9, code: 'sms-mix', active: 1, current_version:'0.5.4', minimum_version:'0.5.4', force_update:0 };
    if (sql.includes("FROM orders WHERE id=? AND status='paid'")) return this.args[0] === 88 ? { id: 88, user_id: 1, status: 'paid' } : null;
    if (sql.includes("p.code='sms-mix' LIMIT 1")) return { found: 1 };
    if (sql.includes('FROM vision7_order_fulfillments WHERE order_item_id=')) { reconciled++; return { license_id: 'old-active', action: 'issued' }; }
    if (sql.includes('FROM vision7_releases r JOIN vision7_licenses l')) {
      releaseSelect = sql;
      return sqlite.prepare(sql).get(...this.args) || null;
    }
    return null;
  },
}; } } };
const adminHeaders = { cookie: 'vd_session=test' };
const form = new FormData(); form.set('program_id','9'); form.set('version','0.5.4'); form.set('minimum_version','0.5.4'); form.set('file',new File([new Uint8Array([1])],'VSMS.apk',{type:'application/vnd.android.package-archive'}));
const upload = await uploadRelease({ env, request: new Request('https://visiondonline.com/api/admin/vision7/releases', { method:'POST', headers:adminHeaders, body:form }) });
assert.equal(upload.status, 409, 'generic VSMS release upload blocked');
assert.equal(storageWrites, 0, 'rejected upload never writes APK');
const request = body => ({ env, request: new Request('https://visiondonline.com/api/admin/vision7/smsmix-reconcile', { method:'POST', headers:{ ...adminHeaders, 'content-type':'application/json' }, body:JSON.stringify(body) }) });
const missingRequest = cursor => ({ env, request: new Request('https://visiondonline.com/api/admin/vision7/smsmix-missing' + (cursor ? `?cursor=${cursor}` : ''), { headers: adminHeaders }) });
assert.equal((await (await missingOrders(missingRequest())).json()).items[0].order_id, 88, 'paid order without key appears in Boss exception queue');
const missingPlan = sqlite.prepare('EXPLAIN QUERY PLAN ' + missingSelect).all(null,null).map(row => row.detail).join(' ');
assert.match(missingPlan, /idx_order_items_product_retention/, 'missing-key exception query uses product/order index');
assert.equal((await reconcileOrder(request({ order_id: 87 }))).status, 409, 'unpaid order cannot reconcile');
const recovered = await reconcileOrder(request({ order_id: 88 }));
assert.equal(recovered.status, 200);
assert.equal((await recovered.json()).items[0].existing, true, 'paid retry returns prior key marker without duplication');
assert.equal(reconciled, 1);
sqlite.prepare("INSERT INTO vision7_order_fulfillments VALUES(801,88,'old-active','issued')").run();
assert.equal((await (await missingOrders(missingRequest())).json()).items.length, 0, 'fulfilled order leaves exception queue');
for (let i=0;i<26;i++) {
  sqlite.prepare("INSERT INTO orders VALUES(?,1,'paid',?,99900)").run(100+i,`VSMS-${100+i}`);
  sqlite.prepare('INSERT INTO order_items VALUES(?,?,11)').run(1000+i,100+i);
}
const firstPage = await (await missingOrders(missingRequest())).json();
const secondPage = await (await missingOrders(missingRequest(firstPage.next_cursor))).json();
assert.equal(firstPage.items.length, 24);
assert.equal(secondPage.items.length, 2);
assert.equal(new Set([...firstPage.items,...secondPage.items].map(item => item.missing_item_id)).size, 26, 'keyset queue has no duplicate or missing paid items');
assert.equal(secondPage.next_cursor, null);
const download = await downloadRelease({ env, params:{ id:'7' }, request:new Request('https://visiondonline.com/api/vision7/releases/7/download', { headers:adminHeaders }) });
assert.equal(download.status, 200, 'older active key still permits APK download');
assert.match(releaseSelect, /ORDER BY CASE WHEN l\.status IN \('active','trial'\).*THEN 0 ELSE 1 END/);
assert.equal(sqlite.prepare(releaseSelect).get(7,1).license_id, 'old-active', 'query selects valid older key over newer refunded key');
const keyPlan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT l.id FROM vision7_licenses l JOIN vision7_programs p ON p.id=l.program_id LEFT JOIN vision7_smsmix_bindings b ON b.license_id=l.id WHERE l.key_hash=? AND p.code='sms-mix'").all('key-one');
assert.match(keyPlan.map(row => row.detail).join(' '), /idx_v7_license_key_hash/, 'key lookup uses unique index');
const orderPlan = sqlite.prepare("EXPLAIN QUERY PLAN SELECT 1 FROM order_items oi JOIN vision7_plans q ON q.product_id=oi.product_id JOIN vision7_programs p ON p.id=q.program_id WHERE oi.order_id=? AND p.code='sms-mix' LIMIT 1").all(88);
assert.match(orderPlan.map(row => row.detail).join(' '), /idx_order_items_order_product/, 'paid reconcile uses order-item index');
assert.equal(download.headers.get('cache-control'), 'private, no-store');
sqlite.close();
console.log('SMS Mix generic update, paid reconcile and active-older release download gates PASS');
