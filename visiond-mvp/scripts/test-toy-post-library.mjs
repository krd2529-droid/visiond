import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import * as lines from '../functions/api/admin/toy-post-lines.js';
import * as line from '../functions/api/admin/toy-post-lines/[id].js';
import * as products from '../functions/api/admin/toy-post-products.js';
import * as product from '../functions/api/admin/toy-post-products/[id].js';
import * as photo from '../functions/api/admin/toy-post-products/[id]/photo.js';
import * as compose from '../functions/api/admin/toy-post-compose.js';

const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../migrations/0138_toy_post_library.sql',import.meta.url),'utf8'));
let role='admin';
const DB={prepare(sql){if(sql.includes('FROM sessions s JOIN users u'))return {bind(){return {first:async()=>role?{id:1,role,name:'Test'}:null}}};
  const statement=db.prepare(sql);let args=[];
  return {bind(...values){args=values;return this},async first(){return statement.get(...args)||null},async all(){return {results:statement.all(...args)}},async run(){const result=statement.run(...args);return {meta:{changes:Number(result.changes)}}}};
}};
const objects=new Map();let failDelete=false;
const FILES={async put(key,value){objects.set(key,value)},async get(key){const value=objects.get(key);return value?{body:value}:null},async delete(key){if(failDelete){failDelete=false;throw Error('R2 cleanup unavailable')}objects.delete(key)}};
const env={DB,FILES};
function context(path,method='GET',data,params={}){const headers={'cookie':'vd_session=test'};let body;
  if(data instanceof FormData)body=data;else if(data!==undefined){headers['content-type']='application/json';body=JSON.stringify(data)}
  return {env,params,request:new Request(`https://visiond.test${path}`,{method,headers,body})};
}
async function call(handler,ctx,status=200){const response=await handler(ctx);assert.equal(response.status,status);assert.match(response.headers.get('cache-control')||'',/no-store/);return response.json()}

const a=(await call(lines.onRequestPost,context('/api/admin/toy-post-lines','POST',{name:'กันดั้ม'}),201)).item.id;
const b=(await call(lines.onRequestPost,context('/api/admin/toy-post-lines','POST',{name:'โมเดล'}),201)).item.id;
await call(line.onRequestPut,context(`/api/admin/toy-post-lines/${a}`,'PUT',{name:'กันดั้ม',destinations:[{type:'page',name:'เพจ A',url:'https://www.facebook.com/pageA'}]},{id:String(a)}));
await call(line.onRequestPut,context(`/api/admin/toy-post-lines/${b}`,'PUT',{name:'โมเดล',destinations:[{type:'group',name:'กลุ่ม B',url:'https://www.facebook.com/groups/b'}]},{id:String(b)}));

const firstIds=[];
for(let i=0;i<26;i++){
  const detail=i===0?'สินค้า1 รายละเอียด1':i===1?'สินค้า2 รายละเอียด2':`สินค้า${i+1}`;
  const created=await call(products.onRequestPost,context('/api/admin/toy-post-products','POST',{line_id:a,detail}),201);
  const id=created.item.id;firstIds.push(id);
  db.prepare('UPDATE toy_post_products SET photo_key=?,photo_type=? WHERE id=?').run(`toy-post/${id}.jpg`,'image/jpeg',id);
  objects.set(`toy-post/${id}.jpg`,new Uint8Array([255,216,255]));
}
const other=await call(products.onRequestPost,context('/api/admin/toy-post-products','POST',{line_id:b,detail:'ข้ามไลน์'}),201);
db.prepare('UPDATE toy_post_products SET photo_key=?,photo_type=? WHERE id=?').run('toy-post/other.jpg','image/jpeg',other.item.id);
objects.set('toy-post/other.jpg',new Uint8Array([255,216,255]));
const page1=await call(products.onRequestGet,context(`/api/admin/toy-post-products?line_id=${a}`));
const page2=await call(products.onRequestGet,context(`/api/admin/toy-post-products?line_id=${a}&cursor=${page1.next_cursor}`));
assert.equal(page1.items.length,24);assert.equal(page2.items.length,2);assert.equal(page2.next_cursor,null);
assert.deepEqual([...page1.items,...page2.items].map(x=>x.id),firstIds);
let result=await call(compose.onRequestPost,context('/api/admin/toy-post-compose','POST',{line_id:a,heading:'มือ1 รวมส่ง'}));
assert.equal(result.count,26);assert.equal(result.photos.length,26);assert.equal(new Set(result.photos.map(x=>x.product_id)).size,26);
assert.equal(result.text.split('\n\n').slice(0,3).join('\n\n'),'มือ1 รวมส่ง\n\nสินค้า1 รายละเอียด1\n\nสินค้า2 รายละเอียด2');
assert.ok(!result.text.includes('ข้ามไลน์'));assert.equal(result.line.destinations[0].name,'เพจ A');assert.equal(result.published,false);
const photoResponse=await photo.onRequestGet(context(`/api/admin/toy-post-products/${firstIds[0]}/photo`,'GET',undefined,{id:String(firstIds[0])}));
assert.equal(photoResponse.status,200);assert.match(photoResponse.headers.get('cache-control'),/no-store/);
const form=new FormData();form.append('file',new File([new Uint8Array([255,216,255])],'new.jpg',{type:'image/jpeg'}));
await call(photo.onRequestPost,context(`/api/admin/toy-post-products/${firstIds[0]}/photo`,'POST',form,{id:String(firstIds[0])}));
assert.equal(objects.has(`toy-post/${firstIds[0]}.jpg`),false);
await call(product.onRequestPut,context(`/api/admin/toy-post-products/${firstIds[0]}`,'PUT',{line_id:b,expected_line_id:a,detail:'ย้ายแล้ว'},{id:String(firstIds[0])}));
await call(product.onRequestPut,context(`/api/admin/toy-post-products/${firstIds[0]}`,'PUT',{line_id:a,expected_line_id:a,detail:'แก้จากแท็บเก่า'},{id:String(firstIds[0])}),409);
await call(product.onRequestDelete,context(`/api/admin/toy-post-products/${firstIds[0]}?line_id=${a}`,'DELETE',undefined,{id:String(firstIds[0])}),409);
await call(product.onRequestDelete,context(`/api/admin/toy-post-products/${firstIds[1]}?line_id=${a}`,'DELETE',undefined,{id:String(firstIds[1])}));
assert.equal(objects.has(`toy-post/${firstIds[1]}.jpg`),true);
assert.equal((await photo.onRequestGet(context(`/api/admin/toy-post-products/${firstIds[1]}/photo`,'GET',undefined,{id:String(firstIds[1])}))).status,404);
const secondForm=new FormData();secondForm.append('file',new File([new Uint8Array([255,216,255])],'next.jpg',{type:'image/jpeg'}));
failDelete=true;const warning=await call(photo.onRequestPost,context(`/api/admin/toy-post-products/${firstIds[0]}/photo`,'POST',secondForm,{id:String(firstIds[0])}));
assert.match(warning.warning,/รูปเก่า/);
result=await call(compose.onRequestPost,context('/api/admin/toy-post-compose','POST',{line_id:a,heading:'หัวใหม่'}));
assert.equal(result.count,24);assert.ok(!result.text.includes('ย้ายแล้ว'));assert.ok(!result.text.includes('สินค้า2 รายละเอียด2'));
const moved=await call(compose.onRequestPost,context('/api/admin/toy-post-compose','POST',{line_id:b,heading:'B'}));
assert.equal(moved.count,2);assert.ok(moved.text.includes('ย้ายแล้ว'));assert.equal(moved.line.destinations[0].name,'กลุ่ม B');
const exactLine=(await call(lines.onRequestPost,context('/api/admin/toy-post-lines','POST',{name:'สองชิ้น'}),201)).item.id;
for(const detail of ['สินค้า1 รายละเอียด1','สินค้า2 รายละเอียด2']){
  const item=await call(products.onRequestPost,context('/api/admin/toy-post-products','POST',{line_id:exactLine,detail}),201);
  db.prepare('UPDATE toy_post_products SET photo_key=?,photo_type=? WHERE id=?').run(`toy-post/exact-${item.item.id}.jpg`,'image/jpeg',item.item.id);
}
const exact=await call(compose.onRequestPost,context('/api/admin/toy-post-compose','POST',{line_id:exactLine,heading:'มือ1 รวมส่ง'}));
assert.equal(exact.text,'มือ1 รวมส่ง\n\nสินค้า1 รายละเอียด1\n\nสินค้า2 รายละเอียด2');
for(let i=0;i<23;i++)await call(lines.onRequestPost,context('/api/admin/toy-post-lines','POST',{name:`ไลน์ทดสอบ ${i}`}),201);
const linePage1=await call(lines.onRequestGet,context('/api/admin/toy-post-lines'));
const linePage2=await call(lines.onRequestGet,context(`/api/admin/toy-post-lines?cursor=${linePage1.next_cursor}`));
assert.equal(linePage1.items.length,24);assert.equal(linePage2.items.length,2);
assert.equal(new Set([...linePage1.items,...linePage2.items].map(x=>x.id)).size,26);
role='user';assert.equal((await products.onRequestGet(context(`/api/admin/toy-post-products?line_id=${a}`))).status,403);assert.equal((await photo.onRequestGet(context(`/api/admin/toy-post-products/${firstIds[0]}/photo`,'GET',undefined,{id:String(firstIds[0])}))).status,403);
role=null;assert.equal((await compose.onRequestPost(context('/api/admin/toy-post-compose','POST',{line_id:a,heading:'x'}))).status,401);
const plans=[
  db.prepare('EXPLAIN QUERY PLAN SELECT id FROM toy_post_lines WHERE id>? ORDER BY id LIMIT 25').all(0),
  db.prepare('EXPLAIN QUERY PLAN SELECT id FROM toy_post_products WHERE line_id=? AND deleted_at IS NULL AND id>? ORDER BY id LIMIT 25').all(a,0),
  db.prepare('EXPLAIN QUERY PLAN SELECT id FROM toy_post_products WHERE line_id=? AND deleted_at IS NULL AND id>? ORDER BY id LIMIT 100').all(a,0)
];
assert.ok(plans[0].some(row=>String(row.detail).includes('INTEGER PRIMARY KEY')),JSON.stringify(plans[0]));
for(const plan of plans.slice(1))assert.ok(plan.some(row=>String(row.detail).includes('toy_post_products_line_active_id')),JSON.stringify(plan));
console.log('toy post library: CRUD, auth, 24+2 product/line paging, 26-item compose, exact text, photo lifecycle/privacy and index plans passed');
