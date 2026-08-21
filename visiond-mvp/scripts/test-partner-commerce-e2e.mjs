import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPost as createOrder} from '../functions/api/partner/v1/commerce/orders/index.js';
import {onRequestGet as readOrder} from '../functions/api/partner/v1/commerce/orders/[externalId].js';
import {onRequestPost as fulfillOrder} from '../functions/api/admin/partner-websites/[id]/commerce/[orderId]/fulfill.js';
import {onRequestPost as consumeClaim} from '../functions/api/commerce/claim.js';
import {partnerSecretHash} from '../functions/_partner_api.js';

const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(`
CREATE TABLE runtime_schema_state(schema_key TEXT PRIMARY KEY,version INTEGER NOT NULL);
INSERT INTO runtime_schema_state VALUES('core',68);
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);
CREATE TABLE products(id INTEGER PRIMARY KEY,slug TEXT,title TEXT,price INTEGER,status TEXT,deleted_at TEXT,product_kind TEXT,category TEXT);
CREATE TABLE courses(id INTEGER PRIMARY KEY,product_id INTEGER,course_type TEXT);
CREATE TABLE orders(id INTEGER PRIMARY KEY,order_no TEXT,user_id INTEGER,total INTEGER,status TEXT);
CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_id INTEGER,product_title TEXT,price INTEGER);
CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,order_id INTEGER,active INTEGER DEFAULT 1,UNIQUE(user_id,product_id,order_id));
CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER);
CREATE TABLE partner_websites(id TEXT PRIMARY KEY,name TEXT,domain TEXT,status TEXT,scopes TEXT,client_id TEXT,secret_hash TEXT,last_used_at TEXT);
CREATE TABLE partner_api_audit(id TEXT PRIMARY KEY,website_id TEXT,request_id TEXT UNIQUE,method TEXT,path TEXT,required_scope TEXT,response_status INTEGER,ip_hash TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE partner_customers(id TEXT PRIMARY KEY,website_id TEXT,external_customer_id TEXT,status TEXT);
CREATE TABLE partner_idempotency(website_id TEXT,idempotency_key TEXT,request_hash TEXT,resource_type TEXT,external_id TEXT,response_status INTEGER,response_body TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(website_id,idempotency_key));
CREATE TABLE partner_commerce_orders(id TEXT PRIMARY KEY,website_id TEXT,external_order_id TEXT,external_customer_id TEXT,status TEXT,currency TEXT,subtotal INTEGER,discount INTEGER,total INTEGER,native_order_id INTEGER UNIQUE,fulfilled_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(website_id,external_order_id));
CREATE TABLE partner_commerce_order_items(order_id TEXT,line_index INTEGER,product_id INTEGER,title TEXT,quantity INTEGER,unit_price INTEGER,line_total INTEGER,PRIMARY KEY(order_id,line_index));
CREATE TABLE partner_commerce_claims(claim_hash TEXT PRIMARY KEY,order_id TEXT UNIQUE,token_ciphertext TEXT,user_id INTEGER,expires_at TEXT,consumed_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

const metrics={prepared:0,executed:0};
class BoundStatement{
  constructor(sql){this.sql=sql;this.args=[]}
  bind(...args){this.args=args;return this}
  async first(){metrics.executed++;return sqlite.prepare(this.sql).get(...this.args)}
  async all(){metrics.executed++;return{results:sqlite.prepare(this.sql).all(...this.args)}}
  async run(){metrics.executed++;const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes)}}}
}
const DB={prepare(sql){metrics.prepared++;return new BoundStatement(sql)},async exec(sql){metrics.executed++;sqlite.exec(sql)},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}};
const env={DB,VISIOND_PARTNER_ENCRYPTION_KEY:'e2e-only-secret-key-with-at-least-32-characters'};
const secret='vds_e2e_secret_long_enough_for_contract';
sqlite.prepare('INSERT INTO users(id,email,username,name,phone,role) VALUES(1,?,?,?,?,?),(2,?,?,?,?,?),(3,?,?,?,?,?)').run('boss@example.invalid','boss','Boss','','boss','owner@example.invalid','owner','Owner','','member','wrong@example.invalid','wrong','Wrong','','member');
sqlite.prepare("INSERT INTO sessions VALUES('boss-session',1,datetime('now','+1 day')),('owner-session',2,datetime('now','+1 day')),('wrong-session',3,datetime('now','+1 day'))").run();
sqlite.prepare("INSERT INTO products VALUES(101,'digital-one','Digital One',9900,'published',NULL,'product','worksheet')").run();
sqlite.prepare('INSERT INTO partner_websites(id,name,domain,status,scopes,client_id,secret_hash) VALUES(?,?,?,?,?,?,?)').run('site_e2e','Web2 E2E','https://web2.example.invalid','active',JSON.stringify(['products:read','customers:write','commerce:read','commerce:write']),'vdw_e2e',await partnerSecretHash('vdw_e2e',secret));
sqlite.prepare("INSERT INTO partner_customers VALUES('pc_e2e','site_e2e','CUSTOMER-E2E','active')").run();

const partnerHeaders=(extra={})=>({'x-visiond-client-id':'vdw_e2e',authorization:`Bearer ${secret}`,'x-request-id':crypto.randomUUID(),...extra});
const ctx=(url,{method='GET',headers={},body,params={}}={})=>({env,params,request:new Request(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)})});
const json=response=>response.json();
async function budget(name,limit,work){const before=metrics.executed,result=await work(),used=metrics.executed-before;assert.ok(used<=limit,`${name} statement budget exceeded: ${used}/${limit}`);return{result,used}}

const payload={external_order_id:'CHECKOUT-E2E',external_customer_id:'CUSTOMER-E2E',items:[{product_id:101,quantity:1}]};
const first=await budget('create',14,()=>createOrder(ctx('https://visiondonline.com/api/partner/v1/commerce/orders',{method:'POST',headers:partnerHeaders({'content-type':'application/json','idempotency-key':'commerce-e2e-0001'}),body:payload})));
assert.equal(first.result.status,201);const created=await json(first.result);assert.equal(created.order.status,'pending_payment');assert.equal(created.order.total,9900);assert.equal(created.order.entitlement_ready,false);

const replay=await budget('replay',7,()=>createOrder(ctx('https://visiondonline.com/api/partner/v1/commerce/orders',{method:'POST',headers:partnerHeaders({'content-type':'application/json','idempotency-key':'commerce-e2e-0001'}),body:payload})));
assert.equal(replay.result.status,201);assert.equal((await json(replay.result)).idempotent_replay,true);

const pending=await budget('status-pending',8,()=>readOrder(ctx('https://visiondonline.com/api/partner/v1/commerce/orders/CHECKOUT-E2E',{headers:partnerHeaders(),params:{externalId:'CHECKOUT-E2E'}})));
assert.equal((await json(pending.result)).order.claim_url,null);

sqlite.prepare("INSERT INTO orders VALUES(501,'VD-E2E-501',2,9900,'paid')").run();
sqlite.prepare("INSERT INTO order_items(order_id,product_id,product_title,price) VALUES(501,101,'Digital One',9900)").run();
sqlite.prepare('INSERT INTO entitlements(user_id,product_id,order_id,active) VALUES(2,101,501,1)').run();
const fulfilled=await budget('fulfill',12,()=>fulfillOrder(ctx(`https://visiondonline.com/api/admin/partner-websites/site_e2e/commerce/${created.order.id}/fulfill`,{method:'POST',headers:{cookie:'vd_session=boss-session','content-type':'application/json'},body:{native_order_id:501,confirmed:true},params:{id:'site_e2e',orderId:created.order.id}})));
assert.equal(fulfilled.result.status,200);assert.equal((await json(fulfilled.result)).claim_returned,false);

const ready=await budget('status-fulfilled',9,()=>readOrder(ctx('https://visiondonline.com/api/partner/v1/commerce/orders/CHECKOUT-E2E',{headers:partnerHeaders(),params:{externalId:'CHECKOUT-E2E'}})));
const readyBody=await json(ready.result);assert.equal(readyBody.order.entitlement_ready,true);assert.match(readyBody.order.claim_url,/^https:\/\/visiondonline\.com\/partner-commerce-claim\.html#token=vdc_[a-f0-9]{64}$/);const token=new URL(readyBody.order.claim_url).hash.slice('#token='.length);

const wrong=await budget('claim-wrong-account',4,()=>consumeClaim(ctx('https://visiondonline.com/api/commerce/claim',{method:'POST',headers:{cookie:'vd_session=wrong-session','content-type':'application/json'},body:{token}})));
assert.equal(wrong.result.status,403);
const claimed=await budget('claim-owner',7,()=>consumeClaim(ctx('https://visiondonline.com/api/commerce/claim',{method:'POST',headers:{cookie:'vd_session=owner-session','content-type':'application/json'},body:{token}})));
assert.equal(claimed.result.status,200);const claimedBody=await json(claimed.result);assert.equal(claimedBody.items.length,1);assert.equal(claimedBody.items[0].entitlement_url,'/api/downloads/product/101');assert.equal('object_key' in claimedBody.items[0],false);
const reused=await budget('claim-reuse',4,()=>consumeClaim(ctx('https://visiondonline.com/api/commerce/claim',{method:'POST',headers:{cookie:'vd_session=owner-session','content-type':'application/json'},body:{token}})));
assert.equal(reused.result.status,403);

console.log(`PASS PARTNER COMMERCE E2E — create=${first.used} replay=${replay.used} pending=${pending.used} fulfill=${fulfilled.used} ready=${ready.used} wrong=${wrong.used} claim=${claimed.used} reuse=${reused.used}`);
