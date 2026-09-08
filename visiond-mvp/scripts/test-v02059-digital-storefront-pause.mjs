import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {ensureDatabase} from '../functions/_schema.js';
import {onRequestGet as listProducts} from '../functions/api/products/index.js';
import {onRequestGet as readProduct} from '../functions/api/products/[slug].js';
import {onRequestGet as readSalesPage} from '../functions/s/[slug].js';
import {onRequestPost as savePause} from '../functions/api/admin/basket-visibility.js';
import {onRequestGet as listCategories} from '../functions/api/categories.js';
import {onRequestGet as recommendations} from '../functions/api/recommendations.js';
import {onRequestPost as checkout} from '../functions/api/orders/index.js';
import {ensureSalesPageSchema} from '../functions/_sales_pages.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [helper,listSource,orderSource,salesSource,catalog,cart,adminHtml,adminJs,downloads,version]=await Promise.all([
  'functions/_basket_visibility.js','functions/api/products/index.js','functions/api/orders/index.js','functions/s/[slug].js','public/catalog-sync.js','public/cart.js','public/admin.html','public/admin.js','functions/api/downloads/product/[id].js','VERSION.txt',
].map(read));
assert.match(helper,/visiond_digital_storefront_paused/);
assert.ok(listSource.indexOf('loadDigitalStorefrontPaused')<listSource.indexOf('ensureStorefrontCatalogSchema(ctx.env)'),'pause must be checked before catalog schema/cache/count work');
assert.match(orderSource,/loadDigitalStorefrontPaused[\s\S]+storefront_closed:true/,'stale carts must not create ordinary digital orders while paused');
assert.match(salesSource,/loadDigitalStorefrontPaused[\s\S]+private, no-store/,'public sales pages must short-circuit without cache while paused');
assert.ok(catalog.indexOf('if(data.storefront_closed)')<catalog.indexOf('fetch("/api/categories")'),'closed catalog must not start follow-up list requests');
assert.match(catalog,/หน้าร้านไฟล์ดิจิทัลปิดปรับปรุงชั่วคราว/);
assert.match(cart,/digitalStorefrontPaused&&String\(item\.product_kind\|\|'product'\)==='product'\?\[item\]:\[\]/,'paused hydration must retain stale first-party product and rights cart rows');
assert.match(cart,/รายการเดิมยังอยู่ในตะกร้าแต่ยังสั่งซื้อไม่ได้/);
assert.match(adminHtml,/id="digitalStorefrontEmergency"/);assert.match(adminJs,/loadDigitalStorefrontEmergency/);assert.match(adminJs,/method:'POST'/);
assert.doesNotMatch(downloads,/DigitalStorefrontPaused|digital_storefront_paused/,'existing purchaser downloads must not be gated by the storefront pause');

const sqlite=new DatabaseSync(':memory:'),seen=[];
class Bound{
  constructor(sql){this.sql=sql;this.args=[];seen.push(sql)}
  bind(...args){this.args=args;return this}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const DB={prepare:sql=>new Bound(sql),exec:async sql=>sqlite.exec(sql),async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results}};
const env={DB};await ensureDatabase(env);
sqlite.prepare("INSERT INTO products(id,slug,title,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind) VALUES(9001,'pause-test','งานทดสอบพักหน้าร้าน',5000,'/api/media/cover-pause.png','[]','coloring','ZIP',10,'published','test','product')").run();
sqlite.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(9001,'pause-admin@example.invalid','Pause Admin','x','admin'),(9002,'pause-buyer@example.invalid','Pause Buyer','x','user')").run();
sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('pause-admin',9001,datetime('now','+1 day')),('pause-buyer',9002,datetime('now','+1 day'))").run();
sqlite.prepare("INSERT INTO orders(id,order_no,user_id,total,status) VALUES(9001,'PAUSE-OWNER',9002,5000,'paid')").run();
sqlite.prepare("INSERT INTO entitlements(user_id,product_id,order_id,active) VALUES(9002,9001,9001,1)").run();
sqlite.prepare("INSERT INTO settings(key,value) VALUES('visiond_digital_storefront_paused','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();

const request=(path,options={})=>new Request(`https://visiondonline.com${path}`,options);
let cacheMatches=0;const oldCaches=globalThis.caches;globalThis.caches={default:{async match(){cacheMatches++;return new Response(JSON.stringify({items:[{id:-1}]}))},async put(){}}};
try{
  seen.length=0;const closedResponse=await listProducts({env,request:request('/api/products?limit=24')});const closed=await closedResponse.json();
  assert.equal(closedResponse.status,200);assert.equal(closed.storefront_closed,true);assert.deepEqual(closed.items,[]);assert.equal(closedResponse.headers.get('cache-control'),'private, no-store');assert.equal(cacheMatches,0,'paused request must bypass stale open Cache API entries');
  assert.ok(seen.some(sql=>sql.includes('settings WHERE key=?')));assert.ok(seen.every(sql=>!sql.includes('WITH candidates AS')&&!sql.includes("schema_key='storefront_catalog'")),seen.join('\n'));
}finally{if(oldCaches===undefined)delete globalThis.caches;else globalThis.caches=oldCaches}

seen.length=0;const pausedCategories=await listCategories({env,request:request('/api/categories')});assert.equal((await pausedCategories.json()).storefront_closed,true);assert.ok(seen.every(sql=>!sql.includes('FROM categories WHERE active=1')));
seen.length=0;const pausedRecommendations=await recommendations({env,request:request('/api/recommendations')});assert.deepEqual((await pausedRecommendations.json()).items,[]);assert.ok(seen.every(sql=>!sql.includes('customer_events')&&!sql.includes('FROM products WHERE status')));

await ensureSalesPageSchema(env);
const templateId=sqlite.prepare("SELECT id FROM sales_page_templates WHERE slug='ad-shortcut-standard'").get().id;
sqlite.prepare("INSERT INTO sales_pages(id,page_type,template_id,slug,title,status,robots_index,created_by,updated_by) VALUES('pause-page','ad_shortcut',?,'pause-test','Pause Test','published',0,9001,9001)").run(templateId);
sqlite.prepare("INSERT INTO sales_page_products(page_id,product_id,sort_order) VALUES('pause-page',9001,0)").run();
seen.length=0;const pausedSales=await readSalesPage({env,request:request('/s/pause-test'),params:{slug:'pause-test'}});assert.equal(pausedSales.status,503);assert.match(await pausedSales.text(),/ปิดปรับปรุงชั่วคราว/);assert.ok(seen.every(sql=>!sql.includes('SELECT p.id,p.slug,p.title,p.short_description')),'paused page must stop before product card/image query');
sqlite.prepare("INSERT INTO products(id,slug,title,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind) VALUES(9004,'rights-test','สิทธิ์ลงขายคอร์ส',5000,'/assets/product-placeholder.svg','[]','resale-rights','สิทธิ์',1,'published','test','product')").run();
sqlite.prepare("INSERT INTO sales_pages(id,page_type,template_id,slug,title,status,robots_index,created_by,updated_by) VALUES('rights-page','ad_shortcut',?,'rights-only','Rights Test','published',0,9001,9001)").run(templateId);
sqlite.prepare("INSERT INTO sales_page_products(page_id,product_id,sort_order) VALUES('rights-page',9004,0)").run();
const rightsSales=await readSalesPage({env,request:request('/s/rights-only'),params:{slug:'rights-only'}});assert.equal(rightsSales.status,200,'resale-rights-only sales page stays available');
const guestDetail=await readProduct({env,request:request('/api/products/pause-test'),params:{slug:'pause-test'}});assert.equal(guestDetail.status,503);assert.equal((await guestDetail.json()).storefront_closed,true);
const ownerDetail=await readProduct({env,request:request('/api/products/pause-test',{headers:{cookie:'vd_session=pause-buyer'}}),params:{slug:'pause-test'}});assert.equal(ownerDetail.status,200,'existing entitled buyer must retain product access');
sqlite.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(9003,'pause-member@example.invalid','Pause Member','x','user')").run();sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('pause-member',9003,datetime('now','+1 day'))").run();sqlite.prepare("INSERT INTO category_memberships(user_id,category_slug,order_id,starts_at,expires_at,active) VALUES(9003,'coloring',9001,CURRENT_TIMESTAMP,datetime('now','+1 day'),1)").run();
const memberDetail=await readProduct({env,request:request('/api/products/pause-test',{headers:{cookie:'vd_session=pause-member'}}),params:{slug:'pause-test'}});assert.equal(memberDetail.status,200,'active category membership must retain product access');

sqlite.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(9005,'pause-cart@example.invalid','Pause Cart','x','user')").run();sqlite.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES('pause-cart',9005,datetime('now','+1 day'))").run();
const orderRequest=slugs=>request('/api/orders',{method:'POST',headers:{cookie:'vd_session=pause-cart','content-type':'application/json'},body:JSON.stringify({productSlugs:slugs})}),ordersBefore=sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n;
const staleCart=await checkout({env,request:orderRequest(['pause-test'])});assert.equal(staleCart.status,503);assert.equal((await staleCart.json()).storefront_closed,true);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,ordersBefore,'paused stale cart must write no order');
const mixedCart=await checkout({env,request:orderRequest(['pause-test','rights-test'])});assert.equal(mixedCart.status,503);assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,ordersBefore,'paused mixed cart must write no order');
sqlite.prepare("INSERT INTO settings(key,value) VALUES('vision5_rights_auto_verify','0') ON CONFLICT(key) DO UPDATE SET value='0'").run();
const rightsOnlyOrder=await checkout({env,request:orderRequest(['rights-test'])});assert.notEqual(rightsOnlyOrder.status,503,'resale-rights order must not be stopped by ordinary digital pause');assert.equal(rightsOnlyOrder.status,201,JSON.stringify(await rightsOnlyOrder.clone().json()));assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM orders').get().n,ordersBefore+1);

const unauthorized=await savePause({env,request:request('/api/admin/basket-visibility',{method:'POST',headers:{'content-type':'application/json'},body:'{"paused":false}'})});assert.equal(unauthorized.status,401);assert.equal(sqlite.prepare("SELECT value FROM settings WHERE key='visiond_digital_storefront_paused'").get().value,'1');
const reopened=await savePause({env,request:request('/api/admin/basket-visibility',{method:'POST',headers:{cookie:'vd_session=pause-admin','content-type':'application/json'},body:'{"paused":false}'})});assert.equal(reopened.status,200);assert.equal((await reopened.json()).storefront_paused,false);assert.equal(sqlite.prepare("SELECT value FROM settings WHERE key='visiond_digital_storefront_paused'").get().value,'0');
const reclosed=await savePause({env,request:request('/api/admin/basket-visibility',{method:'POST',headers:{cookie:'vd_session=pause-admin','content-type':'application/json'},body:'{"paused":true}'})});assert.equal(reclosed.status,200);assert.equal((await reclosed.json()).storefront_paused,true);
assert.equal(version.trim(),'v0.20.60');
console.log('v0.20.60 urgent digital storefront pause regression: short-circuit, stale-cache bypass, access preservation and authorization PASS');
