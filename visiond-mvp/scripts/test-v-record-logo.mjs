import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const asset=readFileSync(new URL('../public/assets/v-record-logo.png',import.meta.url));
assert.equal(asset.subarray(1,4).toString(),'PNG');
assert.equal(asset.readUInt32BE(16),1024);
assert.equal(asset.readUInt32BE(20),1024);
assert.equal(createHash('sha256').update(asset).digest('hex').toUpperCase(),
  '7DFCA7AFAC6D7F4EA96F44D07AD03220C1CF1B1547DE124407F99BDF72118400');

const old='/api/media/vision7/apps/v-record/cover-3e3488cb-4ab2-44c5-a643-db0b5fb8b292.png';
const next='/assets/v-record-logo.png';
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT,cover_url TEXT);
CREATE TABLE products(id INTEGER PRIMARY KEY,slug TEXT,price INTEGER,cover_url TEXT,preview_urls TEXT);`);
db.prepare('INSERT INTO vision7_programs VALUES(?,?,?)').run(2,'v-record',old);
db.prepare('INSERT INTO vision7_programs VALUES(?,?,?)').run(3,'other',old);
for(const [id,slug,price] of [
  [5289,'vbot-key-v-record-monthly',19900],
  [5290,'vbot-key-v-record-yearly',99900],
  [5291,'unrelated',99900],
]) db.prepare('INSERT INTO products VALUES(?,?,?,?,?)').run(id,slug,price,old,JSON.stringify([old]));
const migration=readFileSync(new URL('../migrations/0150_v_record_logo.sql',import.meta.url),'utf8');
db.exec(migration);
db.exec(migration);
assert.equal(db.prepare('SELECT cover_url FROM vision7_programs WHERE id=2').get().cover_url,next);
assert.equal(db.prepare('SELECT cover_url FROM vision7_programs WHERE id=3').get().cover_url,old);
for(const id of [5289,5290]){
  const row=db.prepare('SELECT cover_url,preview_urls FROM products WHERE id=?').get(id);
  assert.equal(row.cover_url,next);
  assert.equal(row.preview_urls,JSON.stringify([next]));
}
assert.equal(db.prepare('SELECT cover_url FROM products WHERE id=5291').get().cover_url,old);
db.prepare('UPDATE products SET cover_url=?,preview_urls=? WHERE id=5289').run(old,'["custom"]');
db.exec(migration);
assert.equal(db.prepare('SELECT cover_url FROM products WHERE id=5289').get().cover_url,old,
  'custom preview must not be overwritten');
const plan=db.prepare("EXPLAIN QUERY PLAN UPDATE products SET cover_url=? WHERE id=5289 AND slug='vbot-key-v-record-monthly'").all(next);
assert.ok(plan.some(row=>/SEARCH products USING INTEGER PRIMARY KEY/.test(row.detail)));
console.log('V-Record logo asset and guarded migration PASS');
