import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {onRequestPost} from '../functions/api/admin/news-channel-cover.js';

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT);
CREATE TABLE sessions(id TEXT,user_id INTEGER,expires_at TEXT);
CREATE TABLE entitlements(user_id INTEGER,product_id INTEGER,active INTEGER);
CREATE TABLE products(id INTEGER,category TEXT);
CREATE TABLE courses(product_id INTEGER,course_type TEXT);
CREATE TABLE course_right_credits(user_id INTEGER);
INSERT INTO users VALUES(1,'admin@example.test','admin','Admin','','admin',CURRENT_TIMESTAMP);
INSERT INTO sessions VALUES('test-session',1,datetime('now','+1 day'));`);
const D1={prepare(sql){const statement=db.prepare(sql);return{bind(...values){return{first:async()=>statement.get(...values)||null,all:async()=>({results:statement.all(...values)}),run:async()=>({meta:{changes:statement.run(...values).changes}})}}}}};
const png=new Uint8Array(256);png.set([137,80,78,71,13,10,26,10]);
const send=(bytes=png,{rights=true,cookie=true,type='image/png',key='fixture-key'}={})=>{const form=new FormData();form.set('rights_confirmed',String(rights));form.set('image',new Blob([bytes],{type}),'licensed.png');return onRequestPost({request:new Request('https://visiondonline.com/api/admin/news-channel-cover',{method:'POST',headers:cookie?{cookie:'vd_session=test-session'}:{},body:form}),env:{DB:D1,GEMINI_API_KEY:key}})};
let providerCalls=0,mode='good';const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{providerCalls++;assert.match(String(url),/gemini-3\.1-flash-image:generateContent$/);assert.equal(options.headers['x-goog-api-key'],'fixture-key');const body=JSON.parse(options.body);assert.equal(body.generationConfig.imageConfig.aspectRatio,'16:9');assert.equal(body.generationConfig.responseModalities[0],'IMAGE');assert.match(body.contents[0].parts[1].text,/clean landscape 16:9 photograph/);assert.match(body.contents[0].parts[1].text,/Remove every existing news outlet logo/);if(mode==='timeout')throw Object.assign(new Error('timeout'),{name:'TimeoutError'});if(mode==='rate')return new Response('{}',{status:429});if(mode==='empty')return Response.json({candidates:[{content:{parts:[{text:'no image'}]}}]});if(mode==='chunked_large')return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(8_000_000));controller.enqueue(new Uint8Array(8_000_001));controller.close()}}));return Response.json({candidates:[{content:{parts:[{inlineData:{mimeType:'image/png',data:Buffer.from(png).toString('base64')}}]}}]})};
try{
  assert.equal((await send(png,{cookie:false})).status,401);assert.equal(providerCalls,0);
  assert.equal((await send(png,{rights:false})).status,422);assert.equal(providerCalls,0);
  assert.equal((await send(new Uint8Array(256))).status,422);assert.equal(providerCalls,0);
  assert.equal((await send(png,{key:''})).status,503);assert.equal(providerCalls,0);
  const good=await send();assert.equal(good.status,200);assert.equal(good.headers.get('cache-control'),'private, no-store');assert.equal(good.headers.get('content-type'),'image/png');assert.deepEqual(new Uint8Array(await good.arrayBuffer()),png);assert.equal(providerCalls,1);
  mode='empty';assert.equal((await send()).status,502);
  mode='rate';assert.equal((await send()).status,429);
  mode='timeout';assert.equal((await send()).status,504);
  mode='chunked_large';assert.equal((await send()).status,502,'chunked provider response is capped without Content-Length');
  mode='good';const large=new Uint8Array(8_000_000);large.set(png.subarray(0,8));assert.equal((await send(large)).status,200);assert.equal(providerCalls,6,'8 MB source reaches the provider without unbounded per-byte string allocations');
  assert.equal((await send(new Uint8Array(8_000_001))).status,422);
  console.log('news-channel cover: auth, rights, input bounds, edit contract, no-store, provider failures PASS');
}finally{globalThis.fetch=originalFetch;db.close()}
