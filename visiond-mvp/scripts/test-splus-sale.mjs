import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,webcrypto,createHash} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {claimSplusPaid,claimSplusTrial,grantSplusOwner,normalizeSplusMachine,splusPaidPurchase,splusReadySql,splusSigner,trialKeyActive} from '../functions/_splus.js';
import {splusPaidPageSql,splusOwnerPageSql} from '../functions/api/vision7/splus/entitlements.js';

globalThis.crypto ||= webcrypto;
const db=new DatabaseSync(':memory:');
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE users(id INTEGER PRIMARY KEY,name TEXT,email TEXT);
CREATE UNIQUE INDEX idx_users_vpage_email_lookup ON users(email COLLATE NOCASE);
CREATE TABLE products(id INTEGER PRIMARY KEY,slug TEXT UNIQUE,title TEXT,short_description TEXT,description TEXT,price INTEGER,cover_url TEXT,preview_urls TEXT,category TEXT,file_type TEXT,pages INTEGER,status TEXT,source TEXT,product_kind TEXT);
CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT UNIQUE,app_name TEXT,app_description TEXT,cover_url TEXT,platform_type TEXT,current_version TEXT,minimum_version TEXT,requires_online INTEGER,max_devices INTEGER,trial_hours INTEGER,active INTEGER);
CREATE TABLE vision7_plans(id INTEGER PRIMARY KEY,program_id INTEGER,plan_code TEXT,name TEXT,price INTEGER,offer_price INTEGER,duration_days INTEGER,active INTEGER,product_id INTEGER,UNIQUE(program_id,plan_code));
CREATE TABLE vision7_releases(id INTEGER PRIMARY KEY,program_id INTEGER,status TEXT,published_at TEXT,version TEXT,file_name TEXT,file_size INTEGER,sha256 TEXT);
CREATE TABLE orders(id INTEGER PRIMARY KEY,user_id INTEGER,status TEXT);
CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,product_id INTEGER,price INTEGER);
CREATE INDEX idx_orders_user_id ON orders(user_id,id DESC);
CREATE INDEX idx_order_items_order_product ON order_items(order_id,product_id);
INSERT INTO users VALUES(1,'Buyer','buyer@example.test'),(2,'Other','other@example.test'),(3,'Boss','boss@example.test');`);
db.exec(readFileSync(new URL('../migrations/0148_splus_draft.sql',import.meta.url),'utf8'));
const cover=new URL('../public/assets/splus-logo.png',import.meta.url);
assert.equal(createHash('sha256').update(readFileSync(cover)).digest('hex').toUpperCase(),'ECEEB8B3B3E079ECACD324E1C9B105224CA61D259BD11BFB0C299D608A54BE8A','storefront uses supplied S+ logo');
assert.equal(existsSync(new URL('../public/assets/splus-offer.png',import.meta.url)),false,'price reference image is not published as a cover');
assert.equal(db.prepare("SELECT cover_url FROM vision7_programs WHERE code='splus'").get().cover_url,'/assets/splus-logo.png');
assert.equal(db.prepare("SELECT COUNT(*) n FROM products WHERE slug LIKE 'vbot-key-splus-%' AND cover_url='/assets/splus-logo.png' AND preview_urls='[\"/assets/splus-logo.png\"]'").get().n,3);
const cartSource=readFileSync(new URL('../public/cart.js',import.meta.url),'utf8');
assert.match(cartSource,/p\.product_kind==='vision7-key'\?vbotSubtitle\(p\)/,'cart row renders its scoped key subtitle');
const cartControls=runInNewContext(`${cartSource.match(/^const vbotControls=.*$/m)?.[0]};vbotControls`,{esc:x=>x,money:()=> '990 บาท',vbotDuration:()=> 'ตลอดชีพ'});
const cartSubtitle=runInNewContext(`${cartSource.match(/^const vbotSubtitle=.*$/m)?.[0]};vbotSubtitle`);
const cartItem={product_kind:'vision7-key',vbot_offers:[],vision7_plan_id:1};
assert.match(cartControls({...cartItem,vbot_app_code:'splus'},0),/เลือกแพ็กเกจ<select/);
assert.match(cartControls({...cartItem,vbot_app_code:'auto-invite'},0),/เลือกอายุคีย์<select/);
assert.equal(cartSubtitle({...cartItem,vbot_app_code:'splus'}),'โปรแกรม SP+ พร้อมคีย์ตลอดชีพตามจำนวนบัญชีที่เลือก');
assert.equal(cartSubtitle({...cartItem,vbot_app_code:'auto-invite'}),'โปรแกรม VBot พร้อมคีย์ตามอายุที่เลือก');
const storefront=readFileSync(new URL('../public/bots-storefront.js',import.meta.url),'utf8');
const appDescription=runInNewContext(`${storefront.match(/^function appDescription\(app\).*$/m)?.[0]};appDescription`);
assert.match(appDescription({code:'splus'}),/Shopee Affiliate.*ค่าคอมมิชชั่น/);
const cardFunctions=['normalizedOffers','durationLabel','offerPrice','appPriceSummary','appCard'].map(name=>{
  const source=storefront.match(new RegExp(`^function ${name}\\(.*$`,'m'))?.[0];
  assert.ok(source,`missing storefront ${name}`);return source;
}).join('\n');
const appCard=runInNewContext(`${cardFunctions};appCard`,{
  esc:value=>String(value),money:cents=>`${Number(cents)/100} บาท`,storePath:'/vtools',placeholder:'/placeholder',
  platformLabel:value=>value,appTitle:app=>app.app_name,appDescription:app=>app.app_description,
});
const splusCard=appCard({code:'splus',app_name:'S+',app_description:'Shopee Affiliate',platform_type:'windows',current_version:'1.0.0',offers:[
  {code:'accounts100',offer_price:249000,product_slug:'splus-100',product_id:3},
  {code:'accounts30',offer_price:99000,product_slug:'splus-30',product_id:1},
  {code:'accounts50',offer_price:149000,product_slug:'splus-50',product_id:2},
]});
assert.match(splusCard,/990 บาท/);
assert.match(splusCard,/สิทธิ์ ตลอดชีพ · 30 บัญชี/,'S+ card entitlement follows its lowest price despite API order');
assert.doesNotMatch(splusCard,/สิทธิ์ ตลอดชีพ · 100 บัญชี/);
const prepare=(sql,args=[])=>({bind(...values){return prepare(sql,values)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:result.changes,last_row_id:result.lastInsertRowid}}}});
const pair=generateKeyPairSync('ed25519');
const seed=pair.privateKey.export({format:'der',type:'pkcs8'}).subarray(-32);
const publicRaw=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32);
const env={DB:{prepare},SPLUS_SIGNING_SEED:seed.toString('base64'),SPLUS_PUBLIC_KEY_B64:publicRaw.toString('base64url'),VISION7_LICENSE_ENCRYPTION_KEY:'splus-test-encryption-secret-32-chars'};
const machine='ABCD-EF12-3456-7890';
assert.equal(normalizeSplusMachine(machine.toLowerCase()),machine);
assert.equal(normalizeSplusMachine('computer-name'),'');
assert.equal((await db.prepare(splusReadySql).get()),undefined,'draft program has no published release');
assert.equal(db.prepare("SELECT COUNT(*) n FROM products WHERE status='draft'").get().n,3);
db.exec("UPDATE vision7_programs SET active=1 WHERE code='splus'; UPDATE products SET status='published' WHERE slug LIKE 'vbot-key-splus-%'; INSERT INTO vision7_releases VALUES(1,1,'published','2026-11-21','1.0.0','SPlus-Setup-1.0.0.exe',123,'hash');");
const signer=await splusSigner(env);
for(const [code,price] of Object.entries({accounts30:99000,accounts50:149000,accounts100:249000})){
  const product=db.prepare('SELECT product_id FROM vision7_plans WHERE plan_code=?').get(code).product_id;
  const orderId=10+Object.keys({accounts30:99000,accounts50:149000,accounts100:249000}).indexOf(code);
  db.prepare("INSERT INTO orders VALUES(?,1,'paid')").run(orderId);
  db.prepare('INSERT INTO order_items VALUES(?,?,?,?)').run(orderId,orderId,product,price);
  const purchase=await splusPaidPurchase(env,orderId,1);
  assert.equal(purchase.plan_code,code);assert.equal(purchase.price,price);
  assert.equal(await splusPaidPurchase(env,orderId,2),null);
  const issued=await claimSplusPaid(env,purchase,machine,signer);
  assert.match(issued.key,/^SPLUS-/);
  assert.equal((await claimSplusPaid(env,await splusPaidPurchase(env,orderId,1),machine,signer)).key,issued.key);
  assert.deepEqual(await claimSplusPaid(env,await splusPaidPurchase(env,orderId,1),'1111-2222-3333-4444',signer),{conflict:true});
  const payload=JSON.parse(Buffer.from(issued.key.slice(6).split('.')[0],'base64url'));
  assert.equal(payload.t,Number(code.slice(8)));assert.equal(payload.m,machine);
}
db.exec("INSERT INTO orders VALUES(20,1,'paid'); INSERT INTO order_items SELECT 20,20,product_id,99100 FROM vision7_plans WHERE plan_code='accounts30';");
assert.equal(await splusPaidPurchase(env,20,1),null,'price substitution cannot claim');
db.exec("INSERT INTO orders VALUES(21,1,'paid'); INSERT INTO order_items SELECT 21,21,product_id,99000 FROM vision7_plans WHERE plan_code='accounts30'; UPDATE products SET status='draft' WHERE slug='vbot-key-splus-accounts30';");
assert.equal((await splusPaidPurchase(env,21,1)).order_item_id,21,'paid ownership survives offer unpublish');
db.exec("UPDATE products SET status='published' WHERE slug='vbot-key-splus-accounts30'");
const trial=await claimSplusTrial(env,{userId:1,name:'Buyer',machine,privateKey:signer});
assert.equal(await trialKeyActive(env,trial.key,trial.id),true);
assert.equal((await claimSplusTrial(env,{userId:1,name:'Buyer',machine,privateKey:signer})).key,trial.key);
assert.deepEqual(await claimSplusTrial(env,{userId:2,name:'Other',machine,privateKey:signer}),{conflict:true},'new signup cannot reset one-machine trial');
assert.deepEqual(await claimSplusTrial(env,{userId:1,name:'Buyer',machine:'1111-2222-3333-4444',privateKey:signer}),{conflict:true});
assert.equal(await trialKeyActive(env,trial.key+'X',trial.id),false);
db.exec("UPDATE splus_trials SET expires_at='2020-01-01T00:00:00Z'");
assert.equal(await trialKeyActive(env,trial.key,trial.id),false);
const owner=await grantSplusOwner(env,{recipient:{id:2,name:'Other',email:'other@example.test'},issuerId:3,machine:'1111-2222-3333-4444',privateKey:signer});
assert.equal(JSON.parse(Buffer.from(owner.key.slice(6).split('.')[0],'base64url')).t,0);
assert.equal((await grantSplusOwner(env,{recipient:{id:2,name:'Other',email:'other@example.test'},issuerId:3,machine:'1111-2222-3333-4444',privateKey:signer})).key,owner.key);
assert.deepEqual(await grantSplusOwner(env,{recipient:{id:1,name:'Buyer'},issuerId:3,machine:'1111-2222-3333-4444',privateKey:signer}),{conflict:true});
for(let id=30;id<80;id++){
  const product=db.prepare("SELECT product_id FROM vision7_plans WHERE plan_code='accounts30'").get().product_id;
  db.prepare("INSERT INTO orders VALUES(?,1,'paid')").run(id);
  db.prepare('INSERT INTO order_items VALUES(?,?,?,99000)').run(id,id,product);
}
let cursor=null,seen=[];
do{
  const rows=db.prepare(splusPaidPageSql).all(1,cursor?.order_id??null,cursor?.order_id??null,cursor?.order_id??null,cursor?.order_item_id??null);
  seen.push(...rows.slice(0,24).map(row=>row.order_item_id));
  cursor=rows.length>24?{order_id:rows[23].order_id,order_item_id:rows[23].order_item_id}:null;
}while(cursor);
assert.equal(new Set(seen).size,seen.length);
assert.equal(seen.length,54);
for(let id=1;id<=50;id++)db.prepare('INSERT INTO splus_owner_grants(recipient_id,issuer_id,machine_id) VALUES(2,3,?)').run(`AAAA-BBBB-CCCC-${id.toString(16).toUpperCase().padStart(4,'0')}`);
let ownerCursor=null,ownerIds=[];
do{const rows=db.prepare(splusOwnerPageSql).all(2,ownerCursor,ownerCursor);ownerIds.push(...rows.slice(0,24).map(row=>row.id));ownerCursor=rows.length>24?rows[23].id:null}while(ownerCursor);
assert.equal(ownerIds.length,51);assert.equal(new Set(ownerIds).size,51);
const explain=(sql,args)=>db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>row.detail).join(' | ');
const paidPlan=explain(splusPaidPageSql,[1,null,null,null,null]);
assert.match(paidPlan,/idx_orders_user_id/);
assert.match(paidPlan,/idx_splus_order_items_order_id_desc/);
assert.doesNotMatch(paidPlan,/TEMP B-TREE/,'customer keyset must not sort all paid items');
assert.match(explain('SELECT * FROM splus_trials WHERE user_id=?',[1]),/sqlite_autoindex_splus_trials_1/);
assert.match(explain('SELECT * FROM splus_owner_grants INDEXED BY idx_splus_owner_recipient WHERE recipient_id=? ORDER BY id DESC LIMIT 24',[2]),/idx_splus_owner_recipient/);
assert.match(explain(splusOwnerPageSql,[2,null,null]),/idx_splus_owner_recipient/);
assert.match(explain('SELECT id,name,email FROM users WHERE email=? COLLATE NOCASE LIMIT 1',['buyer@example.test']),/idx_users_vpage_email_lookup/);
console.log('S+ migration, signer, exact paid prices, owner/trial gates, keyset and indexes passed');
