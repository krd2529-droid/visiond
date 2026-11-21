import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ensureDatabase} from '../functions/_schema.js';
import {ensureVision7Schema} from '../functions/_vision7_schema.js';
import {onRequestPost as claim} from '../functions/api/vision7/splus/claim.js';
import {onRequestPost as check} from '../functions/api/vision7/splus/trial-check.js';
import {onRequestGet as entitlements,splusPaidPageSql} from '../functions/api/vision7/splus/entitlements.js';
import {onRequestPost as owner} from '../functions/api/admin/vision7/splus-owner.js';
import {onRequestGet as appDownload} from '../functions/api/vision7/apps/[code]/download.js';
import {onRequestGet as releaseDownload} from '../functions/api/vision7/releases/[id]/download.js';
import {onRequestPost as createOrder} from '../functions/api/orders/index.js';

globalThis.crypto ||= webcrypto;
const db=new DatabaseSync(':memory:');
const statements=[];
const prepare=(sql,args=[])=>({bind(...values){if(sql===splusPaidPageSql)assert.equal(values.length,5,'paid cursor binds every SQL parameter');return prepare(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:result.changes,last_row_id:result.lastInsertRowid}}}});
const pair=generateKeyPairSync('ed25519');
const env={DB:{prepare(sql){statements.push(sql);return prepare(sql)},async batch(list){return Promise.all(list.map(item=>item.run()))},async exec(sql){db.exec(sql)}},FILES:{async get(){return {body:new Uint8Array([1,2,3]),writeHttpMetadata(){}}}},
  SPLUS_SIGNING_SEED:pair.privateKey.export({format:'der',type:'pkcs8'}).subarray(-32).toString('base64'),
  SPLUS_PUBLIC_KEY_B64:pair.publicKey.export({format:'der',type:'spki'}).subarray(-32).toString('base64url'),
  VISION7_LICENSE_ENCRYPTION_KEY:'splus-handler-test-encryption-secret-32-chars'};
await ensureDatabase(env);await ensureVision7Schema(env);
db.exec(readFileSync(new URL('../migrations/0087_storefront_catalog_indexes.sql',import.meta.url),'utf8'));
db.exec(readFileSync(new URL('../migrations/0148_splus_draft.sql',import.meta.url),'utf8'));
db.exec(`INSERT INTO users(email,username,name,password_hash,role) VALUES
  ('boss@example.test','boss','Boss','x','boss'),('buyer@example.test','buyer','Buyer','x','user'),('other@example.test','other','Other','x','user');
INSERT INTO sessions(id,user_id,expires_at) VALUES('boss',1,'2999-01-01'),('buyer',2,'2999-01-01'),('other',3,'2999-01-01');`);
const request=(path,session,body)=>new Request(`https://visiondonline.com${path}`,{method:body?'POST':'GET',headers:{...(session?{cookie:`vd_session=${session}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
const ctx=(path,session,body,params={})=>({env,request:request(path,session,body),params});
const machine='ABCD-EF12-3456-7890';
const ownerBody={email:'other@example.test',machine_id:'1111-2222-3333-4444'};
assert.equal((await owner(ctx('/api/admin/vision7/splus-owner',null,ownerBody))).status,401);
assert.equal((await owner(ctx('/api/admin/vision7/splus-owner','buyer',ownerBody))).status,403);
assert.equal((await claim(ctx('/api/vision7/splus/claim',null,{kind:'trial',machine_id:machine}))).status,401);
assert.equal((await claim(ctx('/api/vision7/splus/claim','buyer',{kind:'trial',machine_id:machine}))).status,409,'draft program cannot issue');
db.exec("UPDATE vision7_programs SET active=1 WHERE code='splus'; UPDATE products SET status='published' WHERE slug LIKE 'vbot-key-splus-%';");
const program=db.prepare("SELECT id FROM vision7_programs WHERE code='splus'").get().id;
db.prepare("INSERT INTO vision7_releases(program_id,version,minimum_version,object_key,file_name,file_size,sha256,status,published_at) VALUES(?,'1.0.0','1.0.0','splus/test','SPlus-Setup.exe',3,'hash','published',CURRENT_TIMESTAMP)").run(program);
const releaseId=db.prepare("SELECT id FROM vision7_releases WHERE program_id=?").get(program).id;
for(const [code,price] of Object.entries({accounts30:99000,accounts50:149000,accounts100:249000})){
  const orderResponse=await createOrder(ctx('/api/orders','buyer',{productSlugs:[`vbot-key-splus-${code}`]}));
  const order=await orderResponse.json();assert.equal(orderResponse.status,201,`${code}: ${JSON.stringify(order)}`);
  assert.equal(order.subtotal,price);assert.equal(order.total,price);
  assert.equal(order.items[0].price,price);
}
const trialResponse=await claim(ctx('/api/vision7/splus/claim','buyer',{kind:'trial',machine_id:machine}));
assert.equal(trialResponse.status,200);assert.equal(trialResponse.headers.get('cache-control'),'private, no-store');
const trial=await trialResponse.json();assert.match(trial.key,/^SPLUS-/);
trial.id=JSON.parse(Buffer.from(trial.key.slice(6).split('.')[0],'base64url')).s;
assert.equal((await claim(ctx('/api/vision7/splus/claim','buyer',{kind:'trial',machine_id:machine}))).status,200);
assert.equal((await claim(ctx('/api/vision7/splus/claim','other',{kind:'trial',machine_id:machine}))).status,409);
statements.length=0;
assert.equal((await check(ctx('/api/vision7/splus/trial-check',null,{key:'random',trial_id:trial.id}))).status,400);
assert.equal(statements.length,0,'invalid trial key does not touch D1');
assert.equal((await check(ctx('/api/vision7/splus/trial-check',null,{key:'x'.repeat(3000),trial_id:1}))).status,413);
assert.equal(statements.length,0,'oversized trial check does not touch D1');
assert.equal((await check(ctx('/api/vision7/splus/trial-check',null,{key:trial.key,trial_id:trial.id}))).status,200);
const own=await owner(ctx('/api/admin/vision7/splus-owner','boss',ownerBody));
assert.equal(own.status,200);const ownerKey=(await own.json()).key;
assert.match(ownerKey,/^SPLUS-/);
const buyerPage=await entitlements(ctx('/api/vision7/splus/entitlements','buyer'));
assert.equal(buyerPage.status,200);assert.equal(buyerPage.headers.get('cache-control'),'private, no-store');
assert.equal((await buyerPage.json()).trial.key,trial.key);
const otherPage=await entitlements(ctx('/api/vision7/splus/entitlements','other'));
const otherData=await otherPage.json();assert.equal(otherData.trial,null);assert.equal(otherData.owner[0].key,ownerKey);
assert.ok(!(JSON.stringify(otherData)).includes(trial.key));
statements.length=0;
const ownerCursorPage=await entitlements(ctx('/api/vision7/splus/entitlements?owner_cursor=999','other'));
assert.equal(ownerCursorPage.status,200);assert.equal((await ownerCursorPage.json()).owner[0].key,ownerKey);
assert.ok(!statements.some(sql=>sql.includes('FROM orders o INDEXED BY')||sql.includes('FROM splus_trials')),'owner cursor skips unrelated queries');
const paidProduct=db.prepare("SELECT product_id FROM vision7_plans WHERE plan_code='accounts30' AND program_id=?").get(program).product_id;
db.prepare("INSERT INTO orders(order_no,user_id,total,status) VALUES('SPLUS-TEST',2,99000,'paid')").run();
const orderId=db.prepare("SELECT id FROM orders WHERE order_no='SPLUS-TEST'").get().id;
db.prepare("INSERT INTO order_items(order_id,product_id,price) VALUES(?,?,99000)").run(orderId,paidProduct);
const itemId=db.prepare('SELECT id FROM order_items WHERE order_id=?').get(orderId).id;
assert.equal((await claim(ctx('/api/vision7/splus/claim','other',{kind:'paid',machine_id:machine,order_item_id:itemId}))).status,403);
const paid=await claim(ctx('/api/vision7/splus/claim','buyer',{kind:'paid',machine_id:machine,order_item_id:itemId}));assert.equal(paid.status,200);
assert.equal((await claim(ctx('/api/vision7/splus/claim','buyer',{kind:'paid',machine_id:'9999-2222-3333-4444',order_item_id:itemId}))).status,409);
for(let n=0;n<30;n++)db.prepare('INSERT INTO order_items(order_id,product_id,price) VALUES(?,?,99000)').run(orderId,paidProduct);
for(let n=1;n<=50;n++){
  db.prepare("INSERT INTO orders(order_no,user_id,total,status) VALUES(?,2,99000,'paid')").run(`SPLUS-PAGE-${n}`);
  const id=db.prepare('SELECT id FROM orders WHERE order_no=?').get(`SPLUS-PAGE-${n}`).id;
  db.prepare('INSERT INTO order_items(order_id,product_id,price) VALUES(?,?,99000)').run(id,paidProduct);
}
let cursor=null,seen=[];
do{
  statements.length=0;
  const suffix=cursor?`?cursor=${encodeURIComponent(cursor)}`:'';
  const response=await entitlements(ctx(`/api/vision7/splus/entitlements${suffix}`,'buyer'));
  assert.equal(response.status,200);const page=await response.json();
  assert.ok(page.paid.length<=24);seen.push(...page.paid.map(item=>item.order_item_id));cursor=page.next_cursor;
  if(suffix)assert.ok(!statements.some(sql=>sql.includes('FROM splus_trials')||sql.includes('FROM splus_owner_grants')),'paid cursor skips unrelated reads');
}while(cursor);
assert.equal(seen.length,81);assert.equal(new Set(seen).size,81);
assert.equal((await entitlements(ctx('/api/vision7/splus/entitlements?cursor=bad','buyer'))).status,400);
const app=(session)=>appDownload(ctx('/api/vision7/apps/splus/download',session,null,{code:'splus'}));
const release=(session)=>releaseDownload(ctx(`/api/vision7/releases/${releaseId}/download`,session,null,{id:String(releaseId)}));
assert.equal((await app(null)).status,401);assert.equal((await app('buyer')).status,302);
assert.equal((await release(null)).status,401);assert.equal((await release('other')).status,200,'authenticated member can download before trial key claim');
db.exec("UPDATE splus_trials SET expires_at='2020-01-01T00:00:00Z'");
assert.equal((await check(ctx('/api/vision7/splus/trial-check',null,{key:trial.key,trial_id:trial.id}))).status,403);
console.log('S+ claim/admin/recipient/download handlers, no-store and invalid-key D1 guard passed');
