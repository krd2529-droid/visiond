import assert from 'node:assert/strict';
import vm from 'node:vm';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {ensureDatabase,ensureStorefrontCatalogSchema} from '../functions/_schema.js';
import {onRequestGet as listProducts} from '../functions/api/products/index.js';
import {onRequestGet as readProduct} from '../functions/api/products/[slug].js';
import {onRequestGet as listCategories} from '../functions/api/admin/categories/index.js';
import {claimMaintenanceLease,releaseMaintenanceLease} from '../functions/_maintenance.js';
import {maintainAnalyticsRetention,runAnalyticsMaintenance} from '../functions/_analytics.js';
import {permanentlyDeleteProduct,purgeExpiredTrash} from '../functions/_trash.js';
import {purgeExpiredElonData} from '../functions/_elon.js';
import {ensureElonWebSchema} from '../functions/_elon_databases.js';
import {onRequestPost as runElonRetention} from '../functions/api/internal/elon-retention.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const sqlite=new DatabaseSync(':memory:'),seen=[];
class Bound{
  constructor(sql){this.sql=sql;this.args=[];seen.push(this)}
  bind(...args){this.args=args;return this}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const DB={prepare:sql=>new Bound(sql),exec:async sql=>sqlite.exec(sql),async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results}};
const deletedObjects=[];
const env={DB,FILES:{async delete(key){deletedObjects.push(key)}}};
await ensureDatabase(env);
const migration88=await read('migrations/0088_tiktok_analyzer_pagination.sql');sqlite.exec(migration88.slice(migration88.indexOf('INSERT OR IGNORE INTO settings')));
sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_products_slug_nocase ON products(slug COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_product_slug_history_old_nocase ON product_slug_history(old_slug COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_categories_public_order ON categories(active,sort_order,id);`);

// Migration is deliberately incomplete after 1,200 rows, then resumes from its
// persisted per-row checkpoint. A ready=0 observation must recover in-isolate.
sqlite.exec('BEGIN');
const insertBefore=sqlite.prepare("INSERT INTO products(slug,title,price,category,status,product_kind) VALUES(?,?,100,'worksheet','published','product')");
for(let i=1;i<=1205;i++)insertBefore.run(`backfill-${i}`,`Backfill ${i}`);
sqlite.exec('COMMIT');
sqlite.exec(await read('migrations/0090_catalog_metadata_and_retention.sql'));
sqlite.exec(await read('migrations/0091_catalog_metadata_backfill.sql'));
assert.equal(sqlite.prepare('SELECT ready FROM storefront_catalog_metadata_state WHERE id=1').get().ready,0);
assert.equal(await ensureStorefrontCatalogSchema(env),false,'partially backfilled catalog must fail visibly');
sqlite.exec(await read('scripts/sql/storefront-catalog-backfill-resume.sql'));
assert.equal(sqlite.prepare('SELECT ready FROM storefront_catalog_metadata_state WHERE id=1').get().ready,1);
assert.equal(await ensureStorefrontCatalogSchema(env),true,'same isolate must recover after readiness changes');
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM products WHERE storefront_meta_version<>1').get().n,0);

const legacyGroup=({slug,title,category,parent=''})=>{
  const c=String(category||'').toLowerCase(),p=String(parent||'').toLowerCase(),t=String(title||''),tl=t.toLowerCase();
  if(c.includes('tattoo')||p.includes('tattoo')||t.includes('รอยสัก')||t.includes('แบบสัก'))return 'tattoo';
  if(c.includes('coloring')||p.includes('coloring')||t.includes('ระบายสี'))return 'coloring';
  if(c.includes('development-game')||p.includes('development-game')||t.includes('เกมเสริมพัฒนาการ')||tl.includes('maze')||t.includes('เขาวงกต'))return 'development-game';
  if(c.includes('paper-doll')||p.includes('paper-doll')||t.includes('ตุ๊กตากระดาษ'))return 'paper-doll';
  if(category==='resale-rights'||slug==='course-selling-rights')return 'resale-rights';
  return 'worksheet';
};
const categories=[['child-tattoo','Tattoo child','tattoo-family'],['coloring-set','Coloring',null],['game-set','Game',null],['paper-set','Paper',null],['inactive-set','Inactive',null]];
for(const [slug,name,parent] of categories)sqlite.prepare('INSERT INTO categories(slug,name,parent_slug,active,sort_order) VALUES(?,?,?,?,?)').run(slug,name,parent,slug==='inactive-set'?0:1,10);
const cases=[
  ['meta-tattoo','Plain','child-tattoo','tattoo-family'],['meta-color','ภาพระบายสี','worksheet',''],['meta-game','Maze Game','worksheet',''],
  ['meta-paper','ตุ๊กตากระดาษ','worksheet',''],['meta-resale','สิทธิ์ขายต่อ','resale-rights',''],['meta-default','ใบงาน','worksheet','']
];
for(const [slug,title,category] of cases)sqlite.prepare("INSERT INTO products(slug,title,price,category,status,product_kind) VALUES(?,?,100,?,'published','product')").run(slug,title,category);
for(const [slug,title,category,parent] of cases){const row=sqlite.prepare('SELECT storefront_group,storefront_sort_rank FROM products WHERE slug=?').get(slug),expected=legacyGroup({slug,title,category,parent});assert.equal(row.storefront_group,expected,slug);assert.equal(row.storefront_sort_rank,expected==='tattoo'?1:0,slug)}

// Category parent mutations recompute all affected metadata yet rotate the
// public revision only once, not once per product.
sqlite.exec("CREATE TABLE revision_audit(n INTEGER); CREATE TRIGGER audit_catalog_revision AFTER UPDATE ON settings WHEN NEW.key='storefront_catalog_revision' BEGIN INSERT INTO revision_audit VALUES(1); END;");
sqlite.prepare("INSERT INTO categories(slug,name,parent_slug) VALUES('many-products','Many',NULL)").run();
sqlite.exec('BEGIN');const insertMany=sqlite.prepare("INSERT INTO products(slug,title,price,category,status,product_kind) VALUES(?,?,100,'many-products','published','product')");for(let i=0;i<300;i++)insertMany.run(`many-${i}`,`Many ${i}`);sqlite.exec('COMMIT');
sqlite.exec('DELETE FROM revision_audit');sqlite.prepare("UPDATE categories SET parent_slug='tattoo-root' WHERE slug='many-products'").run();
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM products WHERE category='many-products' AND storefront_group='tattoo'").get().n,300);
assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM revision_audit').get().n,1,'category mutation must rotate revision once');
sqlite.prepare("UPDATE categories SET slug='many-products-renamed' WHERE slug='many-products'").run();sqlite.prepare("UPDATE products SET category='many-products-renamed' WHERE category='many-products'").run();
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM products WHERE category='many-products-renamed' AND storefront_group='tattoo'").get().n,300,'rename flow must preserve canonical metadata');

sqlite.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(6201,'admin62@example.invalid','Admin','x','admin'),(6202,'owner62@example.invalid','Owner','x','user'),(6203,'member62@example.invalid','Member','x','user')").run();
sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('admin62',6201,datetime('now','+1 day')),('owner62',6202,datetime('now','+1 day')),('member62',6203,datetime('now','+1 day'))").run();
sqlite.prepare("INSERT INTO settings(key,value) VALUES('visiond_digital_storefront_paused','0') ON CONFLICT(key) DO UPDATE SET value='0'").run();

// Count cache is canonical across group/cursor pages. A delayed Cache API put
// keeps the in-flight aggregate joinable until it is durable.
const cacheRows=new Map();let holdPut=true,releasePut;const heldPut=new Promise(resolve=>{releasePut=resolve});
globalThis.caches={default:{async match(key){const value=cacheRows.get(key.url);return value?.clone()||null},async put(key,response){if(holdPut)await heldPut;cacheRows.set(key.url,response.clone())}}};
const request=path=>new Request(`https://visiondonline.com${path}`);
seen.length=0;const pageOne=listProducts({env,request:request('/api/products?limit=24')}),groupPage=listProducts({env,request:request('/api/products?limit=24&group=worksheet')});
await new Promise(resolve=>setTimeout(resolve,0));assert.equal(seen.filter(x=>x.sql.includes('GROUP BY p.storefront_group')).length,1,'concurrent pages must join one count query');
holdPut=false;releasePut();const [pageOneResponse,groupResponse]=await Promise.all([pageOne,groupPage]),pageOneData=await pageOneResponse.json(),groupData=await groupResponse.json();
assert.equal(groupData.pagination.total,groupData.category_counts.worksheet);
seen.length=0;const pageTwoData=await (await listProducts({env,request:request(`/api/products?limit=24&cursor=${encodeURIComponent(pageOneData.pagination.next_cursor)}`)})).json(),pageTwoQueries=[...seen];assert.equal(seen.filter(x=>x.sql.includes('GROUP BY p.storefront_group')).length,0,'next cursor page must reuse canonical count cache');assert.equal(pageTwoData.pagination.total,pageOneData.pagination.total);
assert.equal(new Set([...pageOneData.items,...pageTwoData.items].map(x=>x.id)).size,pageOneData.items.length+pageTwoData.items.length,'keyset pages must not duplicate rows');
seen.length=0;await listProducts({env,request:request('/api/products?limit=24&q=Backfill')});assert.equal(seen.filter(x=>x.sql.includes('GROUP BY p.storefront_group')).length,1,'search scope must have an isolated count key');
seen.length=0;await listProducts({env,request:request('/api/products?slugs=backfill-1,backfill-2')});assert.equal(seen.filter(x=>x.sql.includes('GROUP BY p.storefront_group')).length,1,'lookup scope must have an isolated count key');
const beforeRevision=sqlite.prepare("SELECT value FROM settings WHERE key='storefront_catalog_revision'").get().value;sqlite.prepare("UPDATE products SET title='Backfill changed' WHERE slug='backfill-1'").run();const afterRevision=sqlite.prepare("SELECT value FROM settings WHERE key='storefront_catalog_revision'").get().value;assert.notEqual(afterRevision,beforeRevision);seen.length=0;await listProducts({env,request:request('/api/products?limit=24&q=Backfill')});assert.equal(seen.filter(x=>x.sql.includes('GROUP BY p.storefront_group')).length,1,'catalog mutation revision must force recount');

// The split rank cursor seeks directly inside the current rank and only then
// opens the next rank. It never walks already-seen rank-0 rows.
const pageSql=pageTwoQueries.find(x=>x.sql.includes('p.storefront_sort_rank=?')&&x.sql.includes('p.id<?'))?.sql;
assert.ok(pageSql?.includes('p.storefront_sort_rank=?')&&pageSql.includes('p.id<?'));
const plan=(sql,...args)=>sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>String(row.detail));
assert.ok(plan("SELECT id FROM products WHERE storefront_meta_version=1 AND status='published' AND deleted_at IS NULL AND COALESCE(product_kind,'product')='product' AND (category<>'resale-rights' OR slug='course-selling-rights') AND storefront_sort_rank=? AND id<? ORDER BY storefront_sort_rank,id DESC LIMIT ?",0,1000,25).some(x=>x.includes('idx_products_storefront_default')&&x.includes('storefront_sort_rank=?')));

// Lightweight category options do not touch product/count tables and include
// every inactive dictionary value. Counts remain an explicit lazy request.
seen.length=0;let response=await listCategories({env,request:new Request('https://visiondonline.com/api/admin/categories?purpose=options',{headers:{cookie:'vd_session=admin62'}})}),data=await response.json();assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(data.items.some(x=>x.slug==='inactive-set'&&Number(x.active)===0));assert.ok(seen.every(x=>!/(?:FROM|JOIN)\s+products\b|COUNT\(|GROUP BY/i.test(x.sql)),seen.map(x=>x.sql).join('\n'));
seen.length=0;response=await listCategories({env,request:new Request('https://visiondonline.com/api/admin/categories?purpose=counts',{headers:{cookie:'vd_session=admin62'}})});assert.equal(response.status,200);assert.equal(seen.filter(x=>x.sql.includes('GROUP BY category')).length,1);

// Current slug wins a collision with another product's old slug; fallback is
// one indexed history seek. Pause and existing ownership remain unchanged.
sqlite.prepare("INSERT INTO products(id,slug,title,price,category,status,product_kind) VALUES(6210,'collision','Current',100,'worksheet','published','product'),(6211,'canonical-old','History',100,'worksheet','published','product')").run();
sqlite.prepare("INSERT INTO product_slug_history(product_id,old_slug) VALUES(6211,'collision'),(6211,'old-history')").run();
seen.length=0;data=await (await readProduct({env,params:{slug:'collision'},request:request('/api/products/collision')})).json();assert.equal(data.item.id,6210);assert.equal(seen.filter(x=>/SELECT \* FROM products WHERE slug=/.test(x.sql)).length,1);assert.equal(seen.filter(x=>x.sql.includes('FROM product_slug_history h')).length,0);
seen.length=0;data=await (await readProduct({env,params:{slug:'old-history'},request:request('/api/products/old-history')})).json();assert.equal(data.item.slug,'canonical-old');assert.equal(seen.filter(x=>/SELECT \* FROM products WHERE slug=|FROM product_slug_history h/.test(x.sql)).length,2);
assert.ok(plan("SELECT id FROM products WHERE slug=? COLLATE NOCASE AND status='published' AND deleted_at IS NULL LIMIT 1",'collision').some(x=>x.includes('idx_products_public_slug_nocase')));
assert.ok(plan("SELECT p.id FROM product_slug_history h JOIN products p ON p.id=h.product_id WHERE h.old_slug=? COLLATE NOCASE AND p.status='published' AND p.deleted_at IS NULL LIMIT 1",'old-history').some(x=>x.includes('idx_product_slug_history_old_nocase')));
sqlite.prepare("UPDATE settings SET value='1' WHERE key='visiond_digital_storefront_paused'").run();assert.equal((await readProduct({env,params:{slug:'collision'},request:request('/api/products/collision')})).status,503);
sqlite.prepare("INSERT INTO orders(id,order_no,user_id,total,status) VALUES(6201,'V62-OWNER',6202,100,'paid')").run();sqlite.prepare("INSERT INTO entitlements(user_id,product_id,order_id,active) VALUES(6202,6210,6201,1)").run();assert.equal((await readProduct({env,params:{slug:'collision'},request:new Request('https://visiondonline.com/api/products/collision',{headers:{cookie:'vd_session=owner62'}})})).status,200);
sqlite.prepare("INSERT INTO orders(id,order_no,user_id,total,status) VALUES(6203,'V62-MEMBER',6203,100,'paid')").run();sqlite.prepare("INSERT INTO category_memberships(user_id,category_slug,order_id,expires_at,active) VALUES(6203,'worksheet',6203,datetime('now','+1 day'),1)").run();assert.equal((await readProduct({env,params:{slug:'collision'},request:new Request('https://visiondonline.com/api/products/collision',{headers:{cookie:'vd_session=member62'}})})).status,200);

// Durable leases permit one winner and impose an idempotency interval after a
// successful run, including a retry whose prior response was lost.
const clock={value:Date.parse('2026-09-08T00:00:00Z'),now(){return this.value}};
const [leaseA,leaseB]=await Promise.all([claimMaintenanceLease(DB,'lease-test',{now:()=>clock.value,minIntervalMs:300000}),claimMaintenanceLease(DB,'lease-test',{now:()=>clock.value,minIntervalMs:300000})]);assert.equal([leaseA,leaseB].filter(Boolean).length,1);await releaseMaintenanceLease(DB,'lease-test',leaseA||leaseB,{now:()=>clock.value,completed:true});assert.equal(await claimMaintenanceLease(DB,'lease-test',{now:()=>clock.value,minIntervalMs:300000}),null);clock.value+=300001;assert.ok(await claimMaintenanceLease(DB,'lease-test',{now:()=>clock.value,minIntervalMs:300000}));

sqlite.prepare("INSERT INTO page_views(path,visitor_key,viewed_at) VALUES('/old','v-old',datetime('now','-100 days')),('/new','v-new',datetime('now','-1 day'))").run();sqlite.prepare("INSERT INTO customer_events(event_type,created_at) VALUES('old',datetime('now','-100 days')),('new',datetime('now','-1 day'))").run();
let tick=0;const retention=await maintainAnalyticsRetention(env,{batchSize:1,maxBatches:1,deadlineMs:100,now:()=>tick++?200:0});assert.ok(retention.backfilled<=1&&retention.removed<=1&&retention.customer_events_removed<=1);assert.equal(retention.has_more,true);const resumed=await maintainAnalyticsRetention(env,{batchSize:10,maxBatches:2});assert.ok(resumed.backfilled>=1);assert.equal(sqlite.prepare("SELECT COALESCE(SUM(views),0) n FROM analytics_daily WHERE path IN('/old','/new')").get().n,2,'replay-safe aggregation must count each raw view once');
const runClock=()=>Date.parse('2026-09-08T01:00:00Z');await runAnalyticsMaintenance(env,{batchSize:1,maxBatches:1,now:runClock,minIntervalMs:300000});assert.equal((await runAnalyticsMaintenance(env,{batchSize:1,maxBatches:1,now:runClock,minIntervalMs:300000})).busy,true,'lost-response retry must not start another logical run');

// A source file sold indirectly through a purchased bundle remains a hidden
// tombstone, and an image referenced by another product is never removed from R2.
sqlite.prepare("UPDATE settings SET value='0' WHERE key='visiond_digital_storefront_paused'").run();
sqlite.prepare("INSERT INTO products(id,slug,title,price,category,status,product_kind,deleted_at,cover_url,preview_urls) VALUES(6301,'source-sold','Source',100,'worksheet','draft','product',datetime('now','-31 days'),'/api/media/shared.jpg','[]'),(6302,'sold-bundle','Bundle',100,'worksheet','published','product',NULL,'/api/media/shared.jpg','[]')").run();
sqlite.prepare("INSERT INTO product_files(id,product_id,label,object_key) VALUES(6301,6301,'Source file','source.zip')").run();sqlite.prepare('INSERT INTO product_bundle_items(bundle_product_id,source_product_id) VALUES(6302,6301)').run();sqlite.prepare("INSERT INTO orders(id,order_no,user_id,total,status) VALUES(6302,'V62-BUNDLE',6202,100,'paid')").run();sqlite.prepare("INSERT INTO order_items(order_id,product_id,price) VALUES(6302,6302,100)").run();sqlite.prepare("INSERT INTO entitlements(user_id,product_id,order_id,active) VALUES(6202,6302,6302,1)").run();
await permanentlyDeleteProduct(env,sqlite.prepare('SELECT * FROM products WHERE id=6301').get());assert.equal(sqlite.prepare('SELECT deleted_at FROM products WHERE id=6301').get().deleted_at,'9999-12-31 23:59:59');assert.ok(sqlite.prepare('SELECT 1 FROM product_files WHERE id=6301').get());assert.ok(!deletedObjects.includes('source.zip'));
sqlite.prepare("INSERT INTO trash_items(item_type,title,product_id,object_key,expires_at) VALUES('product_image','Shared',6301,'shared.jpg',datetime('now','-1 day'))").run();await purgeExpiredTrash(env,{trashBatchSize:1,productBatchSize:1});assert.ok(sqlite.prepare("SELECT 1 FROM trash_items WHERE object_key='shared.jpg'").get());assert.ok(!deletedObjects.includes('shared.jpg'));
assert.ok(sqlite.prepare("SELECT expires_at>datetime('now') deferred FROM trash_items WHERE object_key='shared.jpg'").get().deferred,'referenced trash must be durably deferred');
for(let i=0;i<20;i++)sqlite.prepare("INSERT INTO trash_items(item_type,title,product_id,object_key,expires_at) VALUES('product_image','Referenced',6301,'shared.jpg',datetime('now','-2 day'))").run();sqlite.prepare("INSERT INTO trash_items(item_type,title,product_id,object_key,expires_at) VALUES('product_file','Deletable',6301,'unused-old.zip',datetime('now','-1 day'))").run();await purgeExpiredTrash(env,{trashBatchSize:20,productBatchSize:1});await purgeExpiredTrash(env,{trashBatchSize:20,productBatchSize:1});assert.equal(sqlite.prepare("SELECT 1 FROM trash_items WHERE object_key='unused-old.zip'").get(),undefined,'deferred referenced rows must not starve the next expired item');assert.ok(deletedObjects.includes('unused-old.zip'));
sqlite.prepare("INSERT INTO products(id,slug,title,price,category,status,product_kind,deleted_at,cover_url,preview_urls) VALUES(6303,'source-shared','Source shared',100,'worksheet','draft','product',datetime('now','-31 days'),'/api/media/live-shared.jpg','[]'),(6304,'live-shared','Live shared',100,'worksheet','published','product',NULL,'/api/media/live-shared.jpg','[]')").run();await permanentlyDeleteProduct(env,sqlite.prepare('SELECT * FROM products WHERE id=6303').get());assert.equal(sqlite.prepare('SELECT 1 FROM products WHERE id=6303').get(),undefined);assert.ok(!deletedObjects.includes('live-shared.jpg'),'whole-product purge must preserve media referenced by another live product');
sqlite.prepare("INSERT INTO products(id,slug,title,price,category,status,product_kind,deleted_at) VALUES(6305,'unsold-source','Unsold source',100,'worksheet','draft','product',datetime('now','-31 days')),(6306,'unsold-live-bundle','Unsold live bundle',100,'worksheet','published','product',NULL)").run();sqlite.prepare("INSERT INTO product_files(id,product_id,label,object_key) VALUES(6305,6305,'Unsold source file','unsold-source.zip')").run();sqlite.prepare('INSERT INTO product_bundle_items(bundle_product_id,source_product_id) VALUES(6306,6305)').run();const dependencyResult=await permanentlyDeleteProduct(env,sqlite.prepare('SELECT * FROM products WHERE id=6305').get());assert.equal(dependencyResult.preserved_bundle,true);assert.ok(sqlite.prepare('SELECT 1 FROM product_bundle_items WHERE bundle_product_id=6306 AND source_product_id=6305').get());assert.ok(sqlite.prepare('SELECT 1 FROM product_files WHERE id=6305').get());assert.ok(!deletedObjects.includes('unsold-source.zip'));

for(const [sql,args,index] of [
  ["SELECT id FROM page_views WHERE aggregated_at IS NULL ORDER BY id LIMIT ?",[10],'idx_page_views_'],
  ["SELECT id FROM page_views WHERE aggregated_at IS NOT NULL AND viewed_at<datetime('now','-90 days') ORDER BY viewed_at,id LIMIT ?",[10],'idx_page_views_expired_retention'],
  ["SELECT id FROM customer_events WHERE created_at<datetime('now','-90 days') ORDER BY created_at,id LIMIT ?",[10],'idx_customer_events_retention']
])assert.ok(plan(sql,...args).some(x=>x.includes(index)),`${index}: ${plan(sql,...args).join('\n')}`);

// ELON lives on its own optional binding. Its cleanup uses the same durable
// lease/batch/deadline contract, while an unconfigured production boundary is
// explicit and never falls back to the main DB.
const elonSqlite=new DatabaseSync(':memory:');class ElonBound{constructor(sql){this.sql=sql;this.args=[]}bind(...args){this.args=args;return this}async first(){return elonSqlite.prepare(this.sql).get(...this.args)||null}async all(){return{results:elonSqlite.prepare(this.sql).all(...this.args)}}async run(){const result=elonSqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes)}}}}
const ELON_DB={prepare:sql=>new ElonBound(sql),exec:async sql=>elonSqlite.exec(sql),async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results}},elonEnv={ELON_WEB_DB:ELON_DB};await ensureElonWebSchema(elonEnv);elonSqlite.exec(await read('elon-web-migrations/0002_bounded_retention.sql'));
elonSqlite.prepare("INSERT INTO elon_web_conversations(id,subject_type,subject_id,created_at,updated_at) VALUES('ew_old','member','1',datetime('now','-70 days'),datetime('now','-70 days'))").run();for(let i=0;i<3;i++)elonSqlite.prepare("INSERT INTO elon_web_messages(conversation_id,subject_id,role,content,created_at) VALUES('ew_old','1','user','old',datetime('now','-70 days'))").run();for(let i=0;i<3;i++){elonSqlite.prepare("INSERT INTO elon_web_rate_limits(subject_id,window_start,hits) VALUES(?,datetime('now','-2 days'),1)").run(`old-${i}`);elonSqlite.prepare("INSERT INTO elon_web_usage_limits(rate_key,window_start,hits) VALUES(?,date('now','-3 days'),1)").run(`old-${i}`)}
let elonNow=Date.parse('2026-09-08T02:00:00Z');const elonOptions={batchSize:1,maxBatches:1,now:()=>elonNow};const [elonA,elonB]=await Promise.all([purgeExpiredElonData(elonEnv,elonOptions),purgeExpiredElonData(elonEnv,elonOptions)]);assert.equal([elonA,elonB].filter(x=>x.ran).length,1);assert.equal([elonA,elonB].filter(x=>x.busy).length,1);const winner=[elonA,elonB].find(x=>x.ran);assert.ok(winner.messages_removed<=1&&winner.rate_limits_removed<=1&&winner.usage_limits_removed<=1);assert.equal(winner.has_more,true);elonNow+=60*60*1000+1;const elonResume=await purgeExpiredElonData(elonEnv,{...elonOptions,maxBatches:4});assert.ok(elonResume.messages_removed<=3&&elonResume.rate_limits_removed<=3&&elonResume.usage_limits_removed<=3);
const elonPlan=(sql,...args)=>elonSqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args).map(row=>String(row.detail));for(const [sql,args,index] of [["SELECT id FROM elon_web_messages WHERE created_at<datetime('now','-60 days') ORDER BY created_at,id LIMIT ?",[10],'idx_elon_web_messages_retention'],["SELECT subject_id,window_start FROM elon_web_rate_limits WHERE window_start<datetime('now','-1 day') ORDER BY window_start,subject_id LIMIT ?",[10],'idx_elon_web_rate_limits_retention'],["SELECT rate_key,window_start FROM elon_web_usage_limits WHERE window_start<date('now','-2 days') ORDER BY window_start,rate_key LIMIT ?",[10],'idx_elon_web_usage_limits_retention']])assert.ok(elonPlan(sql,...args).some(x=>x.includes(index)),`${index}: ${elonPlan(sql,...args).join('\n')}`);
const unconfigured=await runElonRetention({env:{FILES:{get:async()=>null},ELON_CLEANUP_TOKEN:'x'.repeat(32)},request:new Request('https://visiondonline.com/api/internal/elon-retention',{method:'POST',headers:{authorization:`Bearer ${'x'.repeat(32)}`}})});assert.equal(unconfigured.status,503);assert.equal((await unconfigured.json()).error,'ELON_WEB_DB_BINDING_REQUIRED');

const [adminSource,trashSource,elonSource,version]=await Promise.all(['public/admin.js','functions/_trash.js','functions/_elon.js','VERSION.txt'].map(read));
assert.match(adminSource,/productCategoryOptions\(p\.category \|\| ""\)/);assert.match(adminSource,/categoryCountsGeneration/);assert.doesNotMatch(elonSource,/Math\.random\(\)<0\.02/);assert.match(trashSource,/product_bundle_items b/);assert.equal(version.trim(),'v0.20.71');

// Browser-side dictionary/count cache behavior: sequential tab opens reuse the
// same options/count snapshots; invalidation prevents an older response from
// replacing a newer count; count failure renders an explicit state.
const categoryBlock=adminSource.slice(adminSource.indexOf('function categoryOptions'),adminSource.indexOf("let previewExportCursor='';"));
const categoryCalls=[],categoryPending=[];const node=()=>({innerHTML:'',value:'',options:[]});
const categoryContext={Date,Map,Set,console,fetch:async url=>{categoryCalls.push(url);if(url.includes('purpose=counts')&&categoryContext.deferCounts){let resolve;const promise=new Promise(done=>{resolve=done});categoryPending.push(resolve);return promise}if(url.includes('purpose=counts')&&categoryContext.failCounts)return{ok:false,json:async()=>({error:'count failed'})};return{ok:true,json:async()=>url.includes('purpose=counts')?{items:[{category:'active',product_count:3}]}:{items:[{id:1,slug:'active',name:'Active',active:1,sort_order:1},{id:2,slug:'inactive',name:'Inactive',active:0,sort_order:2}]}}},document:{querySelectorAll:()=>[]},categoryAdminList:node(),previewExportCategory:node(),productCategorySelect:node(),parentCategorySelect:node(),productEditor:{elements:{id:{value:''}}},starterCategorySlugs:new Set(),esc:value=>String(value),loadPreviewBatches:async()=>{},updateProductSlugPreview:()=>{},CATEGORY_COUNTS_TTL:30000,CATEGORY_OPTIONS_TTL:300000,categories:[],categoryCounts:new Map(),categoryCountsLoadedAt:0,categoryCountsPromise:null,categoryCountsGeneration:0,categoryOptionsPromise:null,categoryOptionsLoadedAt:0,deferCounts:false,failCounts:false};
vm.createContext(categoryContext);vm.runInContext(`${categoryBlock};globalThis.h={loadCategories,loadCategoryCounts,invalidateCategoryCounts,productCategoryOptions,get counts(){return categoryCounts}}`,categoryContext);const categoryHarness=categoryContext.h;
await categoryHarness.loadCategories(true);await categoryHarness.loadCategories(true);assert.equal(categoryCalls.filter(url=>url.includes('purpose=options')).length,1);assert.equal(categoryCalls.filter(url=>url.includes('purpose=counts')).length,1);assert.match(categoryHarness.productCategoryOptions('inactive'),/value="inactive"/);
categoryHarness.invalidateCategoryCounts();categoryContext.deferCounts=true;const staleCounts=categoryHarness.loadCategoryCounts();categoryHarness.invalidateCategoryCounts();categoryContext.deferCounts=false;const freshCounts=categoryHarness.loadCategoryCounts();await freshCounts;categoryPending.shift()({ok:true,json:async()=>({items:[{category:'active',product_count:99}]})});await staleCounts;assert.equal(categoryHarness.counts.get('active'),3,'stale count response must not replace the post-invalidation snapshot');
categoryHarness.invalidateCategoryCounts();categoryContext.failCounts=true;await categoryHarness.loadCategories(true);assert.match(categoryContext.categoryAdminList.innerHTML,/count failed/,'count failure must render visibly');
console.log('PASS v0.20.63 remaining D1: persisted catalog/count cache, light categories, indexed slug and leased bounded retention');
