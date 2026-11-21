import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const logo=readFileSync(new URL('public/assets/spplus-logo.png',root));
assert.equal(createHash('sha256').update(logo).digest('hex').toUpperCase(),
  '2B63FBCA0A95C29775439FBA72E82F8B2ED5774704D5B0E524F619011ABDBF73');
const migration=read('migrations/0151_spplus_brand.sql');

function fixture(price100=249000){
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT,app_name TEXT,app_description TEXT,cover_url TEXT);
    CREATE TABLE products(id INTEGER PRIMARY KEY,slug TEXT,title TEXT,price INTEGER,cover_url TEXT,preview_urls TEXT);
    INSERT INTO vision7_programs VALUES(5,'splus','S+','Shopee Affiliate','/assets/splus-logo.png'),
      (2,'v-record','V-Record','screen recorder','/assets/v-record-logo.png');
    INSERT INTO products VALUES
      (5514,'vbot-key-splus-accounts30','S+ · ตลอดชีพ · 30 บัญชี',99000,'/assets/splus-logo.png','["/assets/splus-logo.png"]'),
      (5515,'vbot-key-splus-accounts50','S+ · ตลอดชีพ · 50 บัญชี',149000,'/assets/splus-logo.png','["/assets/splus-logo.png"]'),
      (5516,'vbot-key-splus-accounts100','S+ · ตลอดชีพ · 100 บัญชี',${price100},'/assets/splus-logo.png','["/assets/splus-logo.png"]'),
      (5289,'vbot-key-v-record-monthly','V-Record · คีย์ 30 วัน',19900,'/assets/v-record-logo.png','["/assets/v-record-logo.png"]');`);
  return db;
}

const db=fixture();
const unrelatedBefore=JSON.stringify(db.prepare("SELECT * FROM vision7_programs WHERE code='v-record'").get())+
  JSON.stringify(db.prepare('SELECT * FROM products WHERE id=5289').get());
assert.match(db.prepare('EXPLAIN QUERY PLAN '+
  "SELECT id FROM products WHERE id=5514 AND slug='vbot-key-splus-accounts30' AND price=99000").all()[0].detail,
  /PRIMARY KEY/);
db.exec(migration);
assert.deepEqual({...db.prepare('SELECT app_name,cover_url FROM vision7_programs WHERE id=5').get()},
  {app_name:'SP+',cover_url:'/assets/spplus-logo.png'});
assert.match(db.prepare('SELECT app_description FROM vision7_programs WHERE id=5').get().app_description,
  /SP\+.*Shopee Affiliate.*ค่าคอมมิชชั่น/);
const rows=db.prepare('SELECT id,title,price,cover_url,preview_urls FROM products WHERE id IN (5514,5515,5516) ORDER BY id').all();
assert.deepEqual(rows.map(row=>row.price),[99000,149000,249000]);
assert.deepEqual(rows.map(row=>row.title),['SP+ · ตลอดชีพ · 30 บัญชี','SP+ · ตลอดชีพ · 50 บัญชี','SP+ · ตลอดชีพ · 100 บัญชี']);
assert.ok(rows.every(row=>row.cover_url==='/assets/spplus-logo.png'&&row.preview_urls==='["/assets/spplus-logo.png"]'));
assert.equal(JSON.stringify(db.prepare("SELECT * FROM vision7_programs WHERE code='v-record'").get())+
  JSON.stringify(db.prepare('SELECT * FROM products WHERE id=5289').get()),unrelatedBefore);
const once=JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all());
db.exec(migration);
assert.equal(JSON.stringify(db.prepare('SELECT * FROM products ORDER BY id').all()),once,'migration is idempotent');
const guarded=fixture(249001);guarded.exec(migration);
assert.equal(guarded.prepare('SELECT title FROM products WHERE id=5516').get().title,'S+ · ตลอดชีพ · 100 บัญชี',
  'wrong price is not relabeled');

for(const [file,oldBrand] of [
  ['public/bots-storefront.js','ไฟล์ติดตั้ง SP+'],['public/cart.js','โปรแกรม SP+'],
  ['public/splus-programs.js','ดาวน์โหลด SP+'],['public/my-programs.html','สิทธิ์ SP+'],
  ['public/vision7-admin.html','SP+ · คีย์ OWNER']])assert.ok(read(file).includes(oldBrand),file);
console.log('SP+ guarded catalog migration, exact prices, logo, V-Record isolation and member/cart copy passed');
