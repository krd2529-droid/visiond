import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, generateKeyPairSync, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { autoInvitePurchase, autoInviteSigner, claimAutoInvite, ensureAutoInviteSchema, normalizeAutoInviteMachineId, signAutoInviteKey, AUTO_INVITE_PUBLIC_KEY_B64 } from '../functions/_auto_invite.js';
import { autoInviteCustomerPageSql } from '../functions/api/vision7/my-programs.js';
import { autoInviteAdminPageSql } from '../functions/api/admin/vision7/auto-invite-issues.js';

globalThis.crypto ||= webcrypto;
const sqlite = new DatabaseSync(':memory:');
sqlite.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,username TEXT,email TEXT);
CREATE TABLE orders(id INTEGER PRIMARY KEY,user_id INTEGER,status TEXT);
CREATE TABLE products(id INTEGER PRIMARY KEY);
CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_id INTEGER,price INTEGER);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT);
CREATE TABLE vision7_plans(id INTEGER PRIMARY KEY,program_id INTEGER,product_id INTEGER,plan_code TEXT,active INTEGER);
INSERT INTO users VALUES(1,'Customer','customer','a@example.test'),(2,'Other','other','b@example.test');
INSERT INTO products VALUES(10);
INSERT INTO vision7_programs VALUES(7,'auto-invite');
INSERT INTO vision7_plans VALUES(8,7,10,'lifetime',1);
INSERT INTO orders VALUES(1,1,'awaiting_payment');
INSERT INTO order_items VALUES(20,1,10,69000);`);
sqlite.exec(`CREATE INDEX idx_orders_user_id ON orders(user_id,id DESC);
CREATE INDEX idx_order_items_order_product ON order_items(order_id,product_id);
CREATE UNIQUE INDEX idx_v7_plan_product ON vision7_plans(product_id) WHERE product_id IS NOT NULL;`);
const wrap=(sql,args=[])=>({
  bind(...values){return wrap(sql,values)},
  async first(){return sqlite.prepare(sql).get(...args)||null},
  async all(){return {results:sqlite.prepare(sql).all(...args)}},
  async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:r.changes,last_row_id:r.lastInsertRowid}}},
});
const env={DB:{prepare:sql=>wrap(sql)},VISION7_LICENSE_ENCRYPTION_KEY:'test-only-auto-invite-encryption-key-32-chars'};
await ensureAutoInviteSchema(env);
assert.equal(normalizeAutoInviteMachineId('abcd-ef12-3456-7890'),'ABCD-EF12-3456-7890');
assert.equal(normalizeAutoInviteMachineId('computer-name'),'');
assert.equal(await autoInvitePurchase(env,20,1),null,'unpaid order cannot claim');
assert.equal(await autoInvitePurchase(env,20,2),null,'another customer cannot inspect purchase');
sqlite.exec("UPDATE orders SET status='paid' WHERE id=1");
const purchase=await autoInvitePurchase(env,20,1);
assert.equal(purchase.order_item_id,20);
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const signer=await crypto.subtle.importKey('pkcs8',privateKey.export({format:'der',type:'pkcs8'}),{name:'Ed25519'},false,['sign']);
const machine='ABCD-EF12-3456-7890';
const first=await claimAutoInvite(env,purchase,machine,signer);
const [payloadPart,signaturePart]=first.key.split('.');
const payload=Buffer.from(payloadPart,'base64url');
assert.deepEqual(JSON.parse(payload.toString()),{m:machine,e:'',n:'Customer'});
assert.equal(await crypto.subtle.verify('Ed25519',await crypto.subtle.importKey('spki',publicKey.export({format:'der',type:'spki'}),{name:'Ed25519'},false,['verify']),Buffer.from(signaturePart,'base64url'),payload),true);
const issued=await autoInvitePurchase(env,20,1);
assert.equal((await claimAutoInvite(env,issued,machine,null)).key,first.key,'same machine receives same key');
assert.deepEqual(await claimAutoInvite(env,issued,'1111-2222-3333-4444',null),{conflict:true},'different machine cannot reissue');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM auto_invite_issues').get().n,1,'only one issuance row');
sqlite.exec('UPDATE vision7_plans SET active=0 WHERE id=8');
assert.equal((await autoInvitePurchase(env,20,1)).machine_id,machine,'paid customer survives future sales pause');
sqlite.exec(`ALTER TABLE orders ADD COLUMN order_no TEXT;
ALTER TABLE order_items ADD COLUMN product_title TEXT;
ALTER TABLE vision7_programs ADD COLUMN current_version TEXT;
CREATE TABLE vision7_releases(id INTEGER PRIMARY KEY,program_id INTEGER,status TEXT,published_at TEXT,version TEXT,file_name TEXT,file_size INTEGER,sha256 TEXT);
CREATE INDEX idx_v7_release_program ON vision7_releases(program_id,status,published_at DESC);
INSERT INTO vision7_releases VALUES(1,7,'published','2026-01-01','1.7.0','FollowMe-Setup-1.7.0.exe',45244334,'sha');`);
for(let n=21;n<=72;n++){
  sqlite.prepare("INSERT INTO orders(id,user_id,status,order_no) VALUES(?,1,'paid',?)").run(n,`ORDER-${n}`);
  sqlite.prepare("INSERT INTO order_items(id,order_id,product_id,price,product_title) VALUES(?,?,10,69000,'AutoInvite')").run(n,n);
}
sqlite.exec("UPDATE orders SET status='refunded' WHERE id=1");
sqlite.exec('ANALYZE');
const pageIds=(sql,args)=>sqlite.prepare(sql).all(...args).map(row=>row.order_item_id);
const collect=(sql,argsForCursor)=>{
  let cursor=null,all=[];
  do{const args=argsForCursor(cursor),rows=pageIds(sql,args),page=rows.slice(0,24);all.push(...page);cursor=rows.length>24?page.at(-1):null}while(cursor);
  return all;
};
const customerIds=collect(autoInviteCustomerPageSql,cursor=>[1,cursor,cursor]);
assert.deepEqual(customerIds,Array.from({length:52},(_,i)=>72-i),'customer keyset has no missing or repeated paid item');
const adminIds=collect(autoInviteAdminPageSql,cursor=>[cursor,cursor]);
assert.deepEqual(adminIds,[...customerIds,20],'admin keyset includes historical refunded issue exactly once');
const explain=(sql,args)=>sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>String(row.detail)).join(' | ');
const customerPlan=explain(autoInviteCustomerPageSql,[1,null,null]);
assert.match(customerPlan,/idx_orders_user_id/,'customer list uses user index');
assert.match(customerPlan,/idx_order_items_order_product/,'customer list uses order item index');
assert.match(customerPlan,/idx_v7_release_program/,'customer release lookup uses index');
const claimPlan=explain(`SELECT oi.id FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.id=? AND o.user_id=? AND o.status='paid'`,[30,1]);
assert.match(claimPlan,/SEARCH oi USING INTEGER PRIMARY KEY/,'claim lookup uses order item primary key');
assert.match(claimPlan,/SEARCH o USING INTEGER PRIMARY KEY/,'claim lookup uses order primary key');
const adminPlan=explain(autoInviteAdminPageSql,[null,null]);
assert.match(adminPlan,/idx_auto_invite_order_items_product/,'admin list uses AutoInvite product index');
if (process.env.FOLLOWME_CUSTOMER_SETUP) {
  const file=readFileSync(process.env.FOLLOWME_CUSTOMER_SETUP);
  assert.equal(file.length,45244334,'customer installer has approved byte count');
  assert.equal(createHash('sha256').update(file).digest('hex'),'2c3292e8d05a7d43ebc40f2e186d596685b0081e3daa639e3fea8db458372288','customer installer matches approved SHA-256');
  const setupSource=readFileSync(new URL('../functions/api/admin/vision7/programs.js',import.meta.url),'utf8');
  assert.ok(setupSource.includes('FollowMe-Setup-1.7.0.exe') && setupSource.includes('2c3292e8d05a7d43ebc40f2e186d596685b0081e3daa639e3fea8db458372288'));
}
assert.equal((await signAutoInviteKey(signer,machine,'Customer')).split('.').length,2);
if (process.env.AUTO_INVITE_TEST_SEED_FILE) {
  const productionSigner = await autoInviteSigner({AUTO_INVITE_SIGNING_SEED:readFileSync(process.env.AUTO_INVITE_TEST_SEED_FILE,'utf8')});
  const signed = await signAutoInviteKey(productionSigner,machine,'Customer');
  const [message,signature] = signed.split('.');
  const publicKey = await crypto.subtle.importKey('raw',Buffer.from(AUTO_INVITE_PUBLIC_KEY_B64,'base64'),{name:'Ed25519'},false,['verify']);
  assert.equal(await crypto.subtle.verify('Ed25519',publicKey,Buffer.from(signature,'base64url'),Buffer.from(message,'base64url')),true);
  if (process.env.AUTO_INVITE_TEST_PYTHON && process.env.AUTO_INVITE_TEST_SOURCE) {
    const python = process.env.AUTO_INVITE_TEST_PYTHON,cwd=process.env.AUTO_INVITE_TEST_SOURCE;
    const idRun=spawnSync(python,['-c','import licensing; print(licensing.machine_id())'],{cwd,encoding:'utf8'});
    assert.equal(idRun.status,0,'desktop machine ID is available');
    const actualMachine=idRun.stdout.trim();
    const check=key=>{
      const run=spawnSync(python,['-c','import licensing,sys; print(licensing.check_key(sys.stdin.read())[0])'],{cwd,input:key,encoding:'utf8'});
      assert.equal(run.status,0,'desktop verifier completes');
      return run.stdout.trim()==='True';
    };
    const actualKey=await signAutoInviteKey(productionSigner,actualMachine,'Customer');
    assert.equal(check(actualKey),true,'unmodified desktop accepts server key');
    assert.equal(check(await signAutoInviteKey(productionSigner,machine==='ABCD-EF12-3456-7890'&&actualMachine===machine?'1111-2222-3333-4444':machine,'Customer')),false,'other machine fails');
    assert.equal(check(`${actualKey[0]==='A'?'B':'A'}${actualKey.slice(1)}`),false,'tampered payload fails');
  }
}
console.log('AutoInvite claim, desktop signature, machine lock, keyset pagination and indexed query plans passed');
