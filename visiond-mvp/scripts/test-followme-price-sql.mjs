import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { ensureDatabase } from '../functions/_schema.js';
import { ensureVision7Schema } from '../functions/_vision7_schema.js';

const db = new DatabaseSync(':memory:');
const wrap = (sql, args = []) => ({
  bind(...values) { return wrap(sql, values); },
  async first() { return db.prepare(sql).get(...args) || null; },
  async all() { return { results: db.prepare(sql).all(...args) }; },
  async run() { return db.prepare(sql).run(...args); },
});
const env = { DB: { prepare: sql => wrap(sql), exec: async sql => db.exec(sql) } };
await ensureDatabase(env);
await ensureVision7Schema(env);
db.exec(`INSERT INTO products(id,slug,title,short_description,description,price,status,source,product_kind,cover_url)
  VALUES(5497,'vbot-key-auto-invite-lifetime','Follow me lifetime','คีย์ตลอดชีพ','คีย์ตลอดชีพ',69000,'draft','vision7','vision7-key','/auto-invite-cover.svg');
  INSERT INTO vision7_programs(id,code,platform_type,app_name) VALUES(4,'auto-invite','windows','Follow me');
  INSERT INTO vision7_plans(id,program_id,product_id,plan_code,name,price,offer_price,active)
  VALUES(8,4,5497,'lifetime','คีย์ตลอดชีพ',690,69000,1);`);
const draft = readFileSync(new URL('./sql/followme-590-1590-draft.sql', import.meta.url), 'utf8');
const publish = readFileSync(new URL('./sql/followme-590-1590-publish.sql', import.meta.url), 'utf8');
db.exec(draft);
db.exec(draft);
const offers = db.prepare(`SELECT q.plan_code,q.price,q.offer_price,p.price product_price,p.status,p.description
  FROM vision7_plans q JOIN products p ON p.id=q.product_id WHERE q.program_id=4 ORDER BY q.plan_code`).all();
assert.deepEqual(offers.map(({ plan_code,price,offer_price,product_price,status }) => ({ plan_code,price,offer_price,product_price,status })), [
  { plan_code:'lifetime',price:1590,offer_price:159000,product_price:159000,status:'draft' },
  { plan_code:'monthly',price:590,offer_price:59000,product_price:59000,status:'draft' },
]);
assert.match(offers[1].description,/30 วัน/);
assert.doesNotMatch(offers[1].description,/ตลอดชีพ/);
db.exec(publish);
assert.equal(db.prepare("SELECT count(*) n FROM products WHERE status='published' AND slug LIKE 'vbot-key-auto-invite-%'").get().n,0,'old release cannot publish new offers');
db.exec(`INSERT INTO vision7_releases(program_id,version,minimum_version,object_key,file_name,file_size,sha256,status)
  VALUES(4,'1.7.4','1.7.4','test/174','FollowMe-Setup-1.7.4.exe',45255055,'a663303c3415ed852aa24f7bd21da71a9b584a5e8793b675b6c11a13263289c9','published');`);
db.exec(publish);
assert.equal(db.prepare("SELECT count(*) n FROM products WHERE status='published' AND slug LIKE 'vbot-key-auto-invite-%'").get().n,2,'both exact offers publish only after new release');
console.log('PASS Follow me price SQL: actual schema, idempotent draft, release-gated publish, 59000/159000');
