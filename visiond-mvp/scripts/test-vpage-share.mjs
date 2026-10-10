import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import service from '../services/vpage/src/index.js';

const db=new DatabaseSync(':memory:');
const migration=name=>readFileSync(new URL(`../services/vpage/migrations/${name}`,import.meta.url),'utf8');
db.exec('PRAGMA foreign_keys=ON;'+migration('0001_vpage_service.sql')+migration('0002_vpage_editor.sql')+migration('0003_vpage_multi_items.sql')+migration('0004_vpage_styling.sql'));
const id='vp_33333333333333333333333333333333',product='https://shop.example/item?a=1&b=2',contact='https://line.me/R/ti/p/@seller';
db.prepare("INSERT INTO vpage_pages(id,domain_id,owner_ref,slug,display_name,status,create_idempotency_key,create_request_hash,created_at,expires_at,updated_at) VALUES(?,'dom_smartlinkpage',?,'share-example','Share Example','active','share-key','share-hash',CURRENT_TIMESTAMP,datetime('now','+1 day'),CURRENT_TIMESTAMP)").run(id,'a'.repeat(64));
db.prepare("INSERT INTO vpage_content_sets(page_id,set_no,product_image_url,detail_text,background_image_url,revision) VALUES(?,1,'https://images.example/product.jpg','Details','https://images.example/background.jpg',1)").run(id);
db.prepare("INSERT INTO vpage_product_items(page_id,set_no,position,destination_url,image_url) VALUES(?,1,1,?,'')").run(id,product);
db.prepare("INSERT INTO vpage_contact_items(page_id,set_no,position,contact_type,destination_url,image_url) VALUES(?,1,1,'line',?,'')").run(id,contact);
const adapter={prepare(sql){return{bind(...args){return{async first(){return db.prepare(sql).get(...args)||null},async all(){return{results:db.prepare(sql).all(...args)}}}}}}};
try{
  const response=await service.fetch(new Request('https://smartlinkpage.com/share-example'),{VPAGE_DB:adapter});
  assert.equal(response.status,200);
  const body=await response.text(),csp=response.headers.get('content-security-policy');
  const nonce=body.match(/<script nonce="([a-f0-9]+)">/i)?.[1];
  assert.ok(nonce,'public page has nonce-bearing share script');
  assert.ok(csp.includes(`script-src 'nonce-${nonce}'`),'CSP authorizes only the generated script nonce');
  assert.doesNotMatch(csp,/script-src[^;]*unsafe-inline/);
  for(const destination of [product,contact]){
    const encoded=destination.replaceAll('&','&amp;');
    assert.ok(body.includes(`href="${encoded}"`),'original destination link remains');
    assert.ok(body.includes(`data-share-url="${encoded}"`),'share button targets the same destination');
  }
  assert.equal((body.match(/class="share-link"/g)||[]).length,2);
  const script=body.match(/<script nonce="[a-f0-9]+">([\s\S]*?)<\/script>/i)?.[1];
  const status={textContent:''},button={dataset:{shareUrl:product},parentElement:{querySelector:()=>status}},listeners={};
  let copied='',shares=0;
  const navigator={share:async ({url})=>{shares++;assert.equal(url,product)},clipboard:{writeText:async value=>{copied=value}}};
  const document={addEventListener:(name,handler)=>{listeners[name]=handler}};
  vm.runInNewContext(script,{document,navigator});
  await listeners.click({target:{closest:()=>button}});
  assert.equal(shares,1);assert.equal(copied,'');assert.equal(status.textContent,'แชร์ลิงก์แล้ว');
  delete navigator.share;
  await listeners.click({target:{closest:()=>button}});
  assert.equal(copied,product);assert.equal(status.textContent,'คัดลอกลิงก์แล้ว');
  navigator.share=async()=>{throw {name:'AbortError'}};copied='';
  await listeners.click({target:{closest:()=>button}});
  assert.equal(copied,'');assert.equal(status.textContent,'ยกเลิกการแชร์');
  const client=readFileSync(new URL('../public/vpage.js',import.meta.url),'utf8');
  assert.match(client,/link\.href=destination/);assert.match(client,/button\.dataset\.shareUrl=destination/);
  assert.match(client,/createSets\.addEventListener\('input',[\s\S]*?refreshTemplate\(panel\)/);
  assert.match(client,/editorSets\.addEventListener\('input',[\s\S]*?refreshTemplate\(form\)/);
  console.log('PASS Vpage per-link share destinations, native/copy/cancel, preview refresh and nonce CSP');
}finally{db.close()}
