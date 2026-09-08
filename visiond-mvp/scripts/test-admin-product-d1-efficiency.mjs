import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {ensureDatabase} from '../functions/_schema.js';
import {onRequestGet as listProducts} from '../functions/api/admin/products/index.js';
import {onRequestGet as readMedia} from '../functions/api/media/[key].js';

const sqlite=new DatabaseSync(':memory:');
let listSql='',listArgs=[];
const seenSql=[];
class Bound{
  constructor(sql){this.sql=sql;this.args=[];seenSql.push(sql)}
  bind(...args){this.args=args;return this}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){if(this.sql.startsWith('WITH page AS')){listSql=this.sql;listArgs=this.args}return{results:sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const DB={prepare:sql=>new Bound(sql),exec:async sql=>sqlite.exec(sql),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}};
const fileBody=new Uint8Array([1,2,3]);
const env={DB,FILES:{async get(){return{body:fileBody,httpEtag:'etag-test',httpMetadata:{contentType:'image/png'},writeHttpMetadata(headers){headers.set('content-type','image/png')}}}}};
await ensureDatabase(env);
sqlite.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(1,'boss@example.invalid','Boss','x','boss')").run();
sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('admin-session',1,datetime('now','+1 day'))").run();
for(let index=1;index<=70;index++){
  const status=index%5===0?'draft':'published',source=index===70?'vision4':'admin',title=index===68?'งาน 100% พร้อมใช้':`สินค้า ${index}`;
  const result=sqlite.prepare("INSERT INTO products(slug,title,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind) VALUES(?,?,?,?,?,'coloring','ZIP',50,?,?, 'product')").run(`product-${index}`,title,5000,index===1?'/api/media/cover-test.png':'/assets/product-placeholder.svg',index===2?'[\"/api/media/preview-2-test.png\"]':'[]',status,source);
  sqlite.prepare("INSERT INTO product_files(product_id,label,object_key,mime_type,file_size) VALUES(?,? ,?,'application/zip',100)").run(Number(result.lastInsertRowid),'ไฟล์',`product-${index}.zip`);
}
const request=path=>new Request(`https://visiondonline.com${path}`,{headers:{cookie:'vd_session=admin-session'}});
const first=await listProducts({env,request:request('/api/admin/products?status=published&limit=24')});
assert.equal(first.status,200);const firstData=await first.json();assert.equal(firstData.items.length,24);assert.equal(firstData.pagination.has_more,true);assert.ok(firstData.items.every(item=>item.status==='published'&&item.source!=='vision4'));
const second=await listProducts({env,request:request(`/api/admin/products?status=published&limit=24&cursor=${firstData.pagination.next_cursor}`)});const secondData=await second.json(),pagedSql=listSql,pagedArgs=[...listArgs];assert.ok(secondData.items.length>0);assert.equal(new Set([...firstData.items,...secondData.items].map(item=>item.id)).size,firstData.items.length+secondData.items.length);
const literal=await listProducts({env,request:request('/api/admin/products?status=published&q=100%25&limit=24')});const literalData=await literal.json();assert.equal(literalData.items.length,1);assert.equal(literalData.items[0].title,'งาน 100% พร้อมใช้');
assert.match(pagedSql,/WITH page AS/);assert.match(pagedSql,/LIMIT \?/);assert.match(pagedSql,/p\.id<\?/);
const plans=sqlite.prepare(`EXPLAIN QUERY PLAN ${pagedSql}`).all(...pagedArgs).map(row=>String(row.detail));
assert.ok(plans.some(detail=>detail.includes('idx_product_files_product_latest')),plans.join('\n'));
seenSql.length=0;const cover=await readMedia({env,params:{key:'cover-test.png'}});assert.equal(cover.status,200);assert.ok(seenSql.some(sql=>sql.includes('cover_url=?')));assert.ok(seenSql.every(sql=>!sql.includes('json_each')));
seenSql.length=0;const preview=await readMedia({env,params:{key:'preview-2-test.png'}});assert.equal(preview.status,200);assert.ok(seenSql.some(sql=>sql.includes("json_extract(preview_urls,'$[0]')")),seenSql.join('\n'));assert.ok(seenSql.every(sql=>!sql.includes('json_each')));
const [ui,html,version]=await Promise.all(['../public/admin.js','../public/admin.html','../VERSION.txt'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
for(const token of ['PRODUCT_LIST_TTL','productListInflight','productListLoadedAt','loadMoreProducts','status, limit: "24"','invalidateProductList'])assert.ok(ui.includes(token),token);
const sampleArchive=await readFile(new URL('../public/product-sample-archive.js',import.meta.url),'utf8');assert.match(sampleArchive,/purpose:'sample'/);
assert.match(html,/คลังงาน/);assert.match(html,/admin\.js\?v=02063/);assert.equal(version.trim(),'v0.20.64');
console.log('PASS admin product D1 efficiency: indexed keyset pagination, literal search, bounded page and indexed media lookup');
