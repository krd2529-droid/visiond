import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {ensureDatabase} from '../functions/_schema.js';
import {onRequestGet as listStorefront} from '../functions/api/products/index.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const [products,cart,catalog,status,schema,migration,indexHtml,adminHtml,digitalHtml,cartHtml,version]=await Promise.all([
  read('functions/api/products/index.js'),read('public/cart.js'),read('public/catalog-sync.js'),
  read('functions/api/orders/product-status.js'),read('functions/_schema.js'),
  read('migrations/0087_storefront_catalog_indexes.sql'),read('public/index.html'),
  read('public/admin.html'),read('public/digital-products.html'),read('public/cart.html'),read('VERSION.txt'),
]);

assert.match(products,/MAX_PAGE=24,MAX_LOOKUP=30/,'catalog must have strict page and cart lookup limits');
assert.match(products,/parseCursor/,'catalog must use a keyset cursor');
assert.doesNotMatch(products,/OFFSET\s+/i,'catalog must not use offset pagination');
assert.match(products,/LIMIT \?/,'catalog query must be bounded in SQL');
assert.match(products,/params\.get\('q'\)/,'catalog must filter search on the server');
assert.match(products,/params\.get\('group'\)/,'catalog must filter category on the server');
assert.match(products,/params\.get\('slugs'\)/,'cart must be able to batch-fetch current slugs');
assert.match(products,/new Set\(url\.searchParams\.keys\(\)\)/,'cache key must include canonical query parameters');

assert.match(cart,/api\/products\?slugs=/,'cart must not load the full product catalog');
assert.match(cart,/api\/orders\/product-status\?slugs=/,'cart must request compact status only for current slugs');
assert.doesNotMatch(cart,/for\s*\(let page=0;page<20/,'cart must not page through 2,000 orders');
assert.doesNotMatch(catalog,/fetch\(`\/api\/orders\?/,'catalog must not fetch full order history');
assert.match(catalog,/limit:'24'/,'storefront must request only 24 items');
assert.match(catalog,/pagination\?\.next_cursor/,'storefront must expose the next keyset page');

assert.match(status,/slice\(0,30\)/,'order status lookup must be bounded');
assert.match(status,/o\.user_id=\?/,'order status must be scoped to the signed-in user');
assert.match(status,/private, no-store/,'order status must never be publicly cached');
assert.match(schema,/storefront_catalog/,'schema compatibility must persist its applied state');
assert.match(schema,/idx_products_public_preview_1/,'media lookup index must be installed');
assert.match(migration,/idx_orders_user_id/,'order user lookup index must be deployable');
assert.match(migration,/idx_order_items_order_product/,'order item lookup index must be deployable');

for(const html of [indexHtml,adminHtml])assert.match(html,/v0\.20\.54/);
for(const html of [indexHtml,digitalHtml])assert.match(html,/catalog-sync\.js\?v=02054/);
assert.match(cartHtml,/cart\.js\?v=02054/);
assert.equal(version.trim(),'v0.20.54');

const sqlite=new DatabaseSync(':memory:');
class Bound{
  constructor(sql){this.sql=sql;this.args=[]}
  bind(...args){this.args=args;return this}
  async first(){return sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return{results:sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const result=sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}
}
const DB={prepare:sql=>new Bound(sql),exec:async sql=>sqlite.exec(sql),async batch(statements){const results=[];for(const statement of statements)results.push(await statement.run());return results}};
const env={DB};await ensureDatabase(env);
for(let index=1;index<=55;index++)sqlite.prepare("INSERT INTO products(slug,title,short_description,price,cover_url,preview_urls,category,file_type,pages,status,source,product_kind) VALUES(?,?,?,5000,'/assets/product-placeholder.svg','[]',?,'ZIP',50,'published','test','product')").run(`tha1-${index}`,index===44?'โจรสลัด 100%':`งาน ${index}`,'พร้อมใช้',index%7===0?'tattoo':'coloring');
const request=path=>new Request(`https://visiondonline.com${path}`);
const first=await listStorefront({env,request:request('/api/products?limit=24')});assert.equal(first.status,200);const firstData=await first.json();assert.equal(firstData.items.length,24);assert.equal(firstData.pagination.has_more,true);
const second=await listStorefront({env,request:request(`/api/products?limit=24&cursor=${firstData.pagination.next_cursor}`)});const secondData=await second.json();assert.equal(new Set([...firstData.items,...secondData.items].map(item=>item.id)).size,firstData.items.length+secondData.items.length,'keyset pages must not duplicate products');
const search=await listStorefront({env,request:request('/api/products?q=%E0%B9%82%E0%B8%88%E0%B8%A3%E0%B8%AA%E0%B8%A5%E0%B8%B1%E0%B8%94%20100%25')});const searchData=await search.json();assert.equal(searchData.items.length,1,'literal wildcard search must stay exact');
const lookup=await listStorefront({env,request:request('/api/products?slugs=tha1-1,tha1-55')});const lookupData=await lookup.json();assert.deepEqual(new Set(lookupData.items.map(item=>item.slug)),new Set(['tha1-1','tha1-55']),'batch lookup must preserve old cart products outside the first page');
console.log('v0.20.54 ฐ1 catalog regression tests passed');
