import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {onRequestGet as adminList,onRequestPost as createProduct} from '../functions/api/admin/toys-center/index.js';
import {onRequestPut as updateProduct} from '../functions/api/admin/toys-center/[id].js';
import {onRequestGet as publicProducts} from '../functions/api/toys-center/products.js';
import {ensureToysCenterSchema} from '../functions/_toys_center.js';

const read=path=>fs.readFile(new URL(`../${path}`,import.meta.url),'utf8');
const baseMigration=await read('migrations/0071_toys_center.sql');
const migration=await read('migrations/0105_toys_center_product_line_series.sql');
const galleryMigration=await read('migrations/0106_toys_center_product_images.sql');
const costMigration=await read('migrations/0107_toys_center_product_cost.sql');
const sqlite=new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT);CREATE TABLE entitlements(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER,active INTEGER);CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT);CREATE TABLE courses(product_id INTEGER,course_type TEXT);CREATE TABLE course_right_credits(id INTEGER PRIMARY KEY,user_id INTEGER,product_id INTEGER);`);
sqlite.exec(baseMigration);
sqlite.prepare(`INSERT INTO toys_center_products(meta_id,slug,title,description,brand,image_1_key,image_2_key) VALUES('LEGACY','legacy','สินค้าเดิม','รายละเอียด','VisionD','one.jpg','two.jpg')`).run();
sqlite.exec(migration);
sqlite.exec(galleryMigration);
sqlite.exec(costMigration);
const legacyDefaults=sqlite.prepare(`SELECT product_line,series FROM toys_center_products WHERE meta_id='LEGACY'`).get();assert.equal(legacyDefaults.product_line,'','migration default preserves existing product line');assert.equal(legacyDefaults.series,'','migration default preserves existing series');
assert.throws(()=>sqlite.prepare(`UPDATE toys_center_products SET product_line=? WHERE meta_id='LEGACY'`).run('x'.repeat(121)),/CHECK/);
sqlite.prepare(`UPDATE toys_center_products SET product_line='  Legacy   Line  ',series='  Series  Zero  ' WHERE meta_id='LEGACY'`).run();
const fresh=new DatabaseSync(':memory:');await ensureToysCenterSchema({DB:{exec:sql=>fresh.exec(sql)}});const freshColumns=fresh.prepare('PRAGMA table_info(toys_center_products)').all().map(row=>row.name);assert.ok(freshColumns.includes('product_line'));assert.ok(freshColumns.includes('series'));fresh.close();

const seen=[];class Bound{constructor(sql,args=[]){this.sql=sql;this.args=args}bind(...args){return new Bound(this.sql,args)}first(){seen.push(this.sql);return sqlite.prepare(this.sql).get(...this.args)}all(){seen.push(this.sql);return{results:sqlite.prepare(this.sql).all(...this.args)}}run(){seen.push(this.sql);const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}}
const puts=[];const db={prepare:sql=>new Bound(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const results=statements.map(statement=>statement.run());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}};const env={DB:db,FILES:{put:async(...args)=>puts.push(args),delete:async()=>{}}};
sqlite.prepare(`INSERT INTO users(id,email,username,name,phone,role) VALUES(1,'boss@test','boss','Boss','','boss')`).run();
sqlite.prepare(`INSERT INTO sessions(id,user_id,expires_at) VALUES('session',1,'2099-01-01 00:00:00')`).run();
const jpeg=new File([new Uint8Array([0xff,0xd8,0xff,0xd9])],'toy.jpg',{type:'image/jpeg'});
const form=(fields={},images=true)=>{const data=new FormData();for(const[name,value]of Object.entries({meta_id:'TOY-LINE',title:'สินค้าใหม่',description:'รายละเอียดสินค้า',availability:'in stock',condition:'used',price:'250',quantity:'3',brand:'VisionD',status:'published',product_line:'  Transformers\u00a0 Generations  ',series:'  Studio\tSeries  ',...fields}))data.set(name,value);if(images){data.set('image_1',jpeg,jpeg.name);data.set('image_2',jpeg,jpeg.name)}return data};
const request=(url,method,body)=>new Request(url,{method,headers:{cookie:'vd_session=session'},body});

let response=await createProduct({env,request:request('https://fixture.test/api/admin/toys-center','POST',form())});assert.equal(response.status,201);const created=await response.json();assert.equal(puts.length,2);
let stored=sqlite.prepare('SELECT product_line,series FROM toys_center_products WHERE id=?').get(created.id);assert.equal(stored.product_line,'Transformers Generations');assert.equal(stored.series,'Studio Series');
seen.length=0;response=await adminList({env,request:request('https://fixture.test/api/admin/toys-center?page=1','GET')});let data=await response.json();let item=data.items.find(row=>row.id===created.id);assert.equal(item.product_line,'Transformers Generations');assert.equal(item.series,'Studio Series');const legacyRead=data.items.find(row=>row.meta_id==='LEGACY');assert.equal(legacyRead.product_line,'Legacy Line');assert.equal(legacyRead.series,'Series Zero');assert.equal(seen.filter(sql=>/toys_center_(?:settings|products)/.test(sql)).length,3,'admin list retains its settings/count/page query count');
seen.length=0;response=await publicProducts({env,request:new Request(`https://fixture.test/api/toys-center/products?slug=${item.slug}`)});data=await response.json();assert.equal(data.item.product_line,'Transformers Generations');assert.equal(data.item.series,'Studio Series');assert.equal(seen.filter(sql=>/toys_center_product_images/.test(sql)).length,2,'public detail uses one joined product lookup and one bounded gallery query');
response=await updateProduct({env,params:{id:String(created.id)},request:request(`https://fixture.test/api/admin/toys-center/${created.id}`,'PUT',form({product_line:'  Masterpiece  ',series:'S'.repeat(140)},false))});assert.equal(response.status,200);stored=sqlite.prepare('SELECT product_line,series,image_1_key,image_2_key FROM toys_center_products WHERE id=?').get(created.id);assert.equal(stored.product_line,'Masterpiece');assert.equal(stored.series.length,120);assert.ok(stored.image_1_key);assert.ok(stored.image_2_key);

const html=await read('public/toys-center-admin.html'),adminSource=await read('public/toys-center-admin.js'),publicSource=await read('public/toyscenter.js'),feed=await read('functions/api/toys-center/feed.csv.js');
assert.match(html,/name="product_line"[^>]*maxlength="120"/);assert.match(html,/name="series"[^>]*maxlength="120"/);assert.match(adminSource,/['"]product_line['"]/);assert.match(adminSource,/['"]series['"]/);assert.match(publicSource,/detailRow\('ไลน์สินค้า'/);assert.match(publicSource,/detailRow\('ซีรีส์'/);assert.doesNotMatch(feed,/product_line|series/,'Meta feed remains unchanged');
assert.equal((await read('VERSION.txt')).trim(),'v0.20.112');assert.match(html,/v0\.20\.112/);assert.match(html,/toys-center-admin\.js\?v=020112/);assert.match(await read('public/toyscenter.html'),/toyscenter\.js\?v=020112/);
sqlite.close();
console.log('PASS v0.20.110 Toys Center product line/series migration, normalization, create/update/read and preservation');
