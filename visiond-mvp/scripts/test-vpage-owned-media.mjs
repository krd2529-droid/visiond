import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import worker from '../services/vpage/src/index.js';

const database=new DatabaseSync(':memory:');database.exec('PRAGMA foreign_keys=ON');
for(const number of ['0001_vpage_service','0002_vpage_editor','0003_vpage_multi_items','0004_vpage_styling','0005_vpage_compensation','0006_vpage_media'])database.exec(readFileSync(new URL(`../services/vpage/migrations/${number}.sql`,import.meta.url),'utf8'));
const VPAGE_DB={prepare(sql){const statement=database.prepare(sql);const bound=args=>({bind(...values){return bound(values)},async first(){return statement.get(...args)||null},async all(){return{results:statement.all(...args)}},async run(){const result=statement.run(...args);return{meta:{changes:result.changes}}}});return bound([])},async batch(statements){database.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());database.exec('COMMIT');return results}catch(error){database.exec('ROLLBACK');throw error}}};
const objects=new Map(),VPAGE_MEDIA={async head(key){const item=objects.get(key);return item?{size:item.bytes.length,customMetadata:{sha256:item.hash},httpMetadata:{contentType:'image/webp'}}:null},async get(key){const item=objects.get(key);return item?{size:item.bytes.length,customMetadata:{sha256:item.hash},httpMetadata:{contentType:'image/webp'},body:new Blob([item.bytes]).stream()}:null},async put(key,body,options){objects.set(key,{bytes:new Uint8Array(body),hash:options.customMetadata.sha256})},async delete(key){objects.delete(key)}};
const secret='vpage-test-secret-'.repeat(3),env={VPAGE_DB,VPAGE_MEDIA,VPAGE_KEY_ID:'test-key',VPAGE_SHARED_SECRET:secret},owner='a'.repeat(64);
const hex=bytes=>Buffer.from(bytes).toString('hex');
async function signed(method,path,body=null,{ownerRef=owner,headers={}}={}){
  const bytes=body instanceof Uint8Array?body:body===null?new Uint8Array():new TextEncoder().encode(JSON.stringify(body));
  const timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID().replaceAll('-',''),digest=hex(await crypto.subtle.digest('SHA-256',bytes)),canonical=['vpage-v1',method,path,env.VPAGE_KEY_ID,timestamp,nonce,ownerRef,digest].join('\n');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(canonical)));
  return worker.fetch(new Request(`https://smartlinkpage.com${path}`,{method,headers:{'x-vpage-key-id':env.VPAGE_KEY_ID,'x-vpage-timestamp':timestamp,'x-vpage-nonce':nonce,'x-vpage-owner-ref':ownerRef,'x-vpage-signature':signature,...(body instanceof Uint8Array?{'content-type':'image/webp','content-length':String(bytes.length),'x-vpage-image-width':'10','x-vpage-image-height':'10'}:{'content-type':'application/json'}),...headers},body:method==='GET'||method==='HEAD'?undefined:bytes}),env);
}
const imageId='vpm_'+'b'.repeat(32),imageUrl=`https://smartlinkpage.com/media/${imageId}`,imageBytes=new Uint8Array([1,2,3,4,5]);
const otherIds=['e','f','c','d'].map(letter=>`vpm_${letter.repeat(32)}`),otherUrls=otherIds.map(id=>`https://smartlinkpage.com/media/${id}`);
const wrongLength=await signed('PUT',`/api/v1/media/${'vpm_'+'c'.repeat(32)}`,imageBytes,{headers:{'content-length':'2'}});assert.equal(wrongLength.status,400,'actual body length must match declared length');
const oversized=await signed('PUT',`/api/v1/media/${'vpm_'+'d'.repeat(32)}`,new Uint8Array(5*1024*1024+1),{headers:{'content-length':'1'}});assert.equal(oversized.status,413,'oversized body must be rejected before signature/body allocation');
assert.equal((await worker.fetch(new Request(imageUrl),env)).status,404,'unreferenced media is private');
const upload=await signed('PUT',`/api/v1/media/${imageId}`,imageBytes);assert.equal(upload.status,201,await upload.text());
assert.equal((await worker.fetch(new Request(imageUrl),env)).status,404,'uploaded media remains private until page commit');
const replay=await signed('PUT',`/api/v1/media/${imageId}`,imageBytes);assert.equal(replay.status,200);
for(const id of otherIds){const response=await signed('PUT',`/api/v1/media/${id}`,imageBytes);assert.equal(response.status,201)}
const set=setNo=>({set_no:setNo,product_image_url:imageUrl,background_image_url:otherUrls[0],detail_text:`set ${setNo}`,text_size:'medium',text_style:'normal',youtube_url:'',product_items:[{destination_url:'https://shop.example/product',image_url:otherUrls[1]}],contact_items:[{contact_type:'line',destination_url:'https://line.me/example',image_url:setNo===1?otherUrls[2]:otherUrls[3]}]});
const wrongOwner=await signed('POST','/api/v1/pages',{domain_id:'dom_smartlinkpage',slug:'other-owner',display_name:'Test',active_set:1,content_sets:[set(1),set(2)]},{ownerRef:'9'.repeat(64),headers:{'idempotency-key':'test-owner-mismatch'}});assert.equal(wrongOwner.status,409,'media owner must match page owner');
const external=setNo=>({...set(setNo),product_image_url:'https://images.example/old.png',background_image_url:'https://images.example/background.png',product_items:[{destination_url:'https://shop.example/product',image_url:'https://images.example/product.png'}],contact_items:[{contact_type:'line',destination_url:'https://line.me/example',image_url:'https://images.example/contact.png'}]});
for(const setNo of [1,2])for(const slot of ['hero','background','product','contact']){
  const sets=[set(1),set(2)],content=sets[setNo-1];
  if(slot==='hero')content.product_image_url=external(setNo).product_image_url;
  if(slot==='background')content.background_image_url=external(setNo).background_image_url;
  if(slot==='product')content.product_items=external(setNo).product_items;
  if(slot==='contact')content.contact_items=external(setNo).contact_items;
  const refused=await signed('POST','/api/v1/pages',{domain_id:'dom_smartlinkpage',slug:`external-${setNo}-${slot}`,display_name:'Test',active_set:1,content_sets:sets},{headers:{'idempotency-key':`test-external-${setNo}-${slot}`}});assert.equal(refused.status,409,`new create rejects external ${slot} in set ${setNo}`);
  assert.equal(database.prepare('SELECT count(*) n FROM vpage_pages').get().n,0,'rejection creates no page');
}
const missing=await signed('POST','/api/v1/pages',{domain_id:'dom_smartlinkpage',slug:'missing-image',display_name:'Test',active_set:1,content_sets:[{...set(1),product_image_url:'https://smartlinkpage.com/media/vpm_'+'0'.repeat(32)},set(2)]},{headers:{'idempotency-key':'test-create-missing-image'}});assert.equal(missing.status,409,'owned references still require ready media');
const created=await signed('POST','/api/v1/pages',{domain_id:'dom_smartlinkpage',slug:'owned-image',display_name:'Test',active_set:1,content_sets:[set(1),set(2)]},{headers:{'idempotency-key':'test-create-owned-image'}});const createdPayload=await created.json();assert.equal(created.status,201,JSON.stringify(createdPayload));
const publicGet=await worker.fetch(new Request(imageUrl),env);assert.equal(publicGet.status,200);assert.equal(publicGet.headers.get('cache-control'),'private, no-store');assert.deepEqual(new Uint8Array(await publicGet.arrayBuffer()),imageBytes);
assert.equal((await worker.fetch(new Request(otherUrls[3]),env)).status,404,'inactive-only image is not public');
const publicHead=await worker.fetch(new Request(imageUrl,{method:'HEAD'}),env);assert.equal(publicHead.status,200);assert.equal(publicHead.headers.get('content-length'),String(imageBytes.length));assert.equal((await publicHead.arrayBuffer()).byteLength,0);
const refused=await signed('DELETE',`/api/v1/media/${imageId}`,{});assert.equal(refused.status,409,'referenced media cannot be deleted');
const pageId=createdPayload.item.id;
const bossSave=await signed('PUT',`/api/v1/pages/${pageId}/content-sets/2`,{...set(2),detail_text:'boss saved',expected_revision:1},{ownerRef:'system',headers:{'idempotency-key':'test-boss-save-owned'}});assert.equal(bossSave.status,200,await bossSave.text());
const page=await worker.fetch(new Request('https://smartlinkpage.com/owned-image'),env);assert.equal(page.status,200);const html=await page.text();assert(html.includes(imageUrl));assert(!html.includes('visiondonline.com/api/vpage/media'));
for(const url of otherUrls.slice(0,3))assert(html.includes(url),'all active hero/background/button images use Vpage URL');assert(!html.includes(otherUrls[3]),'inactive button image is not on public page');
const compatibleSave=await signed('PUT',`/api/v1/pages/${pageId}/content-sets/2`,{...external(2),product_image_url:'https://images.example/new.png',expected_revision:2},{headers:{'idempotency-key':'test-save-external-image'}});assert.equal(compatibleSave.status,200,'existing-page edits retain external HTTPS compatibility');
// Seed a committed pre-upload receipt with its original canonical request hash.
const legacySets=[1,2].map(setNo=>{const value=external(setNo);return{set_no:setNo,product_image_url:value.product_image_url,detail_text:value.detail_text,text_size:value.text_size,text_style:value.text_style,youtube_url:'',product_url:value.product_items[0].destination_url,contact_url:value.contact_items[0].destination_url,background_image_url:value.background_image_url,product_items:value.product_items.map((item,index)=>({position:index+1,...item})),contact_items:value.contact_items.map((item,index)=>({position:index+1,...item}))}});
const legacyBody={display_name:'Legacy',domain_id:'dom_smartlinkpage',slug:'legacy-receipt',owner_ref:owner,active_set:1,content_sets:legacySets},legacyHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(legacyBody)))),legacyId='vp_'+'1'.repeat(32);
database.prepare("INSERT INTO vpage_pages(id,domain_id,owner_ref,slug,display_name,status,active_set,create_idempotency_key,create_request_hash,created_at,expires_at,updated_at) VALUES(?,'dom_smartlinkpage',?,'legacy-receipt','Legacy','active',1,'legacy-receipt-key',?,CURRENT_TIMESTAMP,datetime('now','+30 days'),CURRENT_TIMESTAMP)").run(legacyId,owner,legacyHash);
for(const content of legacySets)database.prepare('INSERT INTO vpage_content_sets(page_id,set_no,product_image_url,detail_text,background_image_url) VALUES(?,?,?,?,?)').run(legacyId,content.set_no,content.product_image_url,content.detail_text,content.background_image_url);
const beforeLegacy=database.prepare('SELECT * FROM vpage_pages ORDER BY id').all(),beforeContent=database.prepare('SELECT * FROM vpage_content_sets ORDER BY page_id,set_no').all();
const legacyReplay=await signed('POST','/api/v1/pages',legacyBody,{headers:{'idempotency-key':'legacy-receipt-key'}});assert.equal(legacyReplay.status,200,'exact legacy create receipt replays after strict new-create release');assert.equal((await legacyReplay.json()).replayed,true);assert.deepEqual(database.prepare('SELECT * FROM vpage_pages ORDER BY id').all(),beforeLegacy);assert.deepEqual(database.prepare('SELECT * FROM vpage_content_sets ORDER BY page_id,set_no').all(),beforeContent);
const legacyConflict=await signed('POST','/api/v1/pages',{...legacyBody,display_name:'Changed'},{headers:{'idempotency-key':'legacy-receipt-key'}});assert.equal(legacyConflict.status,409,'legacy replay still enforces exact request hash');
console.log('PASS Vpage signed binary ingest/replay, private unreferenced media, owned create, public GET/HEAD and referenced delete guard');
