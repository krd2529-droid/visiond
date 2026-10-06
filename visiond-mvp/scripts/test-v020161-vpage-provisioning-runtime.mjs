import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import vpageService from '../services/vpage/src/index.js';
import {onRequestGet as domainsRoute} from '../functions/api/vpage/domains.js';
import {onRequestGet as availabilityRoute} from '../functions/api/vpage/availability.js';
import {onRequestGet as creditsRoute} from '../functions/api/vpage/credits.js';
import {onRequestGet as listPages,onRequestPost as createPage} from '../functions/api/vpage/pages/index.js';
import {onRequestPost as repairPage} from '../functions/api/vpage/pages/[id]/repair.js';
import {clearVpageCaches,vpageOwnerRef} from '../functions/_vpage-provisioning.js';

const adapter=(sqlite,control={})=>({
  prepare(sql){const state={args:[]};return{bind(...args){state.args=args;return this},async first(){return sqlite.prepare(sql).get(...state.args)||null},async all(){return{results:sqlite.prepare(sql).all(...state.args)}},async run(){const result=sqlite.prepare(sql).run(...state.args);return{meta:{changes:Number(result.changes)}}},get __sql(){return sql},get __args(){return state.args}}},
  async batch(statements){if(control.failFinalOnce&&statements.some(statement=>statement.__sql.includes('UPDATE vpage_pages SET vpage_id='))){control.failFinalOnce=false;throw new Error('simulated local commit uncertainty')}sqlite.exec('BEGIN');try{const results=statements.map(statement=>{const result=sqlite.prepare(statement.__sql).run(...statement.__args);return{meta:{changes:Number(result.changes)}}});sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}
});
const serviceSqlite=new DatabaseSync(':memory:'),visionSqlite=new DatabaseSync(':memory:');
serviceSqlite.exec('PRAGMA foreign_keys=ON;'+readFileSync(new URL('../services/vpage/migrations/0001_vpage_service.sql',import.meta.url),'utf8')+readFileSync(new URL('../services/vpage/migrations/0002_vpage_editor.sql',import.meta.url),'utf8'));
visionSqlite.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE runtime_schema_state(schema_key TEXT PRIMARY KEY,version INTEGER NOT NULL);INSERT INTO runtime_schema_state VALUES('core',66);
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE products(id INTEGER PRIMARY KEY AUTOINCREMENT,slug TEXT NOT NULL UNIQUE,title TEXT NOT NULL,short_description TEXT,description TEXT,price INTEGER NOT NULL,cover_url TEXT,preview_urls TEXT DEFAULT '[]',category TEXT,file_type TEXT,pages INTEGER DEFAULT 0,status TEXT,source TEXT,product_kind TEXT DEFAULT 'product',updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,order_no TEXT UNIQUE,user_id INTEGER,total INTEGER,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,product_id INTEGER,product_title TEXT,price INTEGER);
INSERT INTO users(id,email,username,name,role) VALUES(1,'one@test','one','One','user'),(2,'two@test','two','Two','user'),(3,'three@test','three','Three','user'),(4,'four@test','four','Four','user'),(5,'five@test','five','Five','user'),(6,'six@test','six','Six','user');
INSERT INTO sessions VALUES('one',1,datetime('now','+1 day'),CURRENT_TIMESTAMP),('two',2,datetime('now','+1 day'),CURRENT_TIMESTAMP),('three',3,datetime('now','+1 day'),CURRENT_TIMESTAMP),('four',4,datetime('now','+1 day'),CURRENT_TIMESTAMP),('five',5,datetime('now','+1 day'),CURRENT_TIMESTAMP),('six',6,datetime('now','+1 day'),CURRENT_TIMESTAMP);
INSERT INTO orders(id,order_no,user_id,total,status) VALUES(1,'ONE',1,99900,'paid'),(2,'TWO',2,99900,'paid'),(3,'THREE',3,99900,'paid'),(4,'FOUR',4,99900,'paid'),(5,'FIVE',5,99900,'paid'),(6,'SIX',6,99900,'paid');
INSERT INTO order_items(id,order_id,product_id,product_title,price) VALUES(1,1,1,'Vpage',99900),(2,2,1,'Vpage',99900),(3,3,1,'Vpage',99900),(4,4,1,'Vpage',99900),(5,5,1,'Vpage',99900),(6,6,1,'Vpage',99900);`);
visionSqlite.exec(readFileSync(new URL('../migrations/0123_vpage_credit_purchase.sql',import.meta.url),'utf8'));
visionSqlite.exec("INSERT INTO vpage_credits(user_id,order_id,source_order_item_id) VALUES(1,1,1),(2,2,2),(3,3,3),(4,4,4),(5,5,5),(6,6,6)");
visionSqlite.exec(readFileSync(new URL('../migrations/0124_vpage_provisioning.sql',import.meta.url),'utf8'));

const secret='local-test-secret-that-is-at-least-32-characters',keyId='visiond-main-v1';
const serviceEnv={VPAGE_DB:adapter(serviceSqlite),VPAGE_SHARED_SECRET:secret,VPAGE_KEY_ID:keyId};
const visionControl={},env={DB:adapter(visionSqlite,visionControl),VPAGE_API_BASE:'https://vpage.local',VPAGE_SHARED_SECRET:secret,VPAGE_KEY_ID:keyId};
const nativeFetch=globalThis.fetch;let failNextCreate=false,failAfterNextCreate=false,capturedDomainRequest=null,domainCalls=0;
globalThis.fetch=async(url,init={})=>{
  const request=new Request(url,init),path=new URL(request.url).pathname;
  if(path==='/api/v1/domains'){domainCalls++;if(!capturedDomainRequest)capturedDomainRequest={url:String(url),headers:new Headers(init.headers)}}
  if(failNextCreate&&request.method==='POST'&&path==='/api/v1/pages'){failNextCreate=false;throw new Error('simulated network loss')}
  const response=await vpageService.fetch(request,serviceEnv);if(failAfterNextCreate&&request.method==='POST'&&path==='/api/v1/pages'){failAfterNextCreate=false;throw new Error('simulated response loss after remote commit')}return response;
};
const visionRequest=(path,{method='GET',session='one',body,key}={})=>new Request(`https://visiond.test${path}`,{method,headers:{cookie:`vd_session=${session}`,...(body?{'content-type':'application/json'}:{}),...(key?{'idempotency-key':key}:{})},body:body?JSON.stringify(body):undefined});
const result=async response=>({status:response.status,data:await response.json(),headers:response.headers});
const encoder=new TextEncoder(),hex=value=>[...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
async function signedService(method,path,ownerRef,{body=null,key='',nonce=crypto.randomUUID().replaceAll('-','')}={}){
  const raw=body===null?'':JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000)),canonical=['vpage-v1',method,path,keyId,timestamp,nonce,ownerRef,await digest(raw)].join('\n'),cryptoKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=hex(await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(canonical)));
  return vpageService.fetch(new Request(`https://vpage.local${path}`,{method,headers:{'content-type':'application/json','x-vpage-key-id':keyId,'x-vpage-timestamp':timestamp,'x-vpage-nonce':nonce,'x-vpage-owner-ref':ownerRef,'x-vpage-signature':signature,...(key?{'idempotency-key':key}:{})},body:raw||undefined}),serviceEnv);
}

try{
  const root=await vpageService.fetch(new Request('https://smartlinkpage.com/'),serviceEnv);assert.equal(root.status,200);assert.match(await root.text(),/บริการเซลเพจเพื่อธุรกิจออนไลน์/);
  assert.equal((await vpageService.fetch(new Request('https://vpage.local/api/v1/domains'),serviceEnv)).status,401,'Vpage API rejects unsigned callers');
  const unauth=await result(await domainsRoute({env,request:new Request('https://visiond.test/api/vpage/domains')}));assert.equal(unauth.status,401);
  const [domains,domainsDuplicate]=await Promise.all([domainsRoute({env,request:visionRequest('/api/vpage/domains')}),domainsRoute({env,request:visionRequest('/api/vpage/domains')})]).then(responses=>Promise.all(responses.map(result)));assert.equal(domains.status,200);assert.equal(domainsDuplicate.status,200);assert.equal(domainCalls,1,'concurrent domain reads share one signed request');assert.deepEqual(domains.data.items,[{id:'dom_smartlinkpage',slot:1,hostname:'smartlinkpage.com'}]);
  const replay=await vpageService.fetch(new Request(capturedDomainRequest.url,{headers:capturedDomainRequest.headers}),serviceEnv);assert.equal(replay.status,409,'nonce replay is rejected');
  const reserved=await result(await availabilityRoute({env,request:visionRequest('/api/vpage/availability?domain_id=dom_smartlinkpage&slug=admin')}));assert.equal(reserved.status,400);
  const valid=await result(await availabilityRoute({env,request:visionRequest('/api/vpage/availability?domain_id=dom_smartlinkpage&slug=mali-shop')}));assert.equal(valid.status,200);assert.equal(valid.data.available,true);assert.equal(valid.data.public_url,'https://smartlinkpage.com/mali-shop');

  const payload={display_name:'ร้านของขวัญคุณมะลิ',domain_id:'dom_smartlinkpage',slug:'mali-shop'},createKey='create-mali-0001';
  const created=await result(await createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',body:payload,key:createKey})}));assert.equal(created.status,201);assert.equal(created.data.item.public_url,'https://smartlinkpage.com/mali-shop');assert.equal(created.data.item.status,'active');
  assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=1').get().status,'consumed');assert.equal(serviceSqlite.prepare('SELECT COUNT(*) count FROM vpage_pages').get().count,1);
  const unavailableAfterCreate=await result(await availabilityRoute({env,request:visionRequest('/api/vpage/availability?domain_id=dom_smartlinkpage&slug=mali-shop')}));assert.equal(unavailableAfterCreate.data.available,false,'successful create invalidates only the affected availability cache');
  const replayed=await result(await createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',body:payload,key:createKey})}));assert.equal(replayed.status,200);assert.equal(serviceSqlite.prepare('SELECT COUNT(*) count FROM vpage_pages').get().count,1,'create replay never duplicates page');
  const publicPage=await vpageService.fetch(new Request('https://smartlinkpage.com/mali-shop'),serviceEnv);assert.equal(publicPage.status,200);assert.match(await publicPage.text(),/ร้านของขวัญคุณมะลิ/);

  const conflict=await result(await createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',session:'two',key:'create-conflict-0002',body:{...payload,display_name:'ร้านสอง'}})}));assert.equal(conflict.status,409);assert.equal(conflict.data.code,'VPAGE_SLUG_CONFLICT');assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=2').get().status,'available','slug conflict retains credit');assert.equal(visionSqlite.prepare("SELECT COUNT(*) count FROM vpage_credit_claims WHERE credit_id=(SELECT id FROM vpage_credits WHERE user_id=2)").get().count,0,'local conflict rolls the claim back atomically');

  failNextCreate=true;const repairKey='create-repair-0003',repairPayload={display_name:'ร้านสาม',domain_id:'dom_smartlinkpage',slug:'third-shop'};
  const uncertain=await result(await createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',session:'three',key:repairKey,body:repairPayload})}));assert.equal(uncertain.status,202);assert.equal(uncertain.data.code,'VPAGE_REPAIR_REQUIRED');assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=3').get().status,'available','timeout does not consume credit');assert.equal(visionSqlite.prepare("SELECT state FROM vpage_credit_claims WHERE credit_id=(SELECT id FROM vpage_credits WHERE user_id=3)").get().state,'held','ambiguous timeout holds the same credit for repair');
  const heldLedger=await result(await creditsRoute({env,request:visionRequest('/api/vpage/credits',{session:'three'})}));assert.equal(heldLedger.data.balance,0,'held repair credit is retained but cannot be double-spent');assert.equal(heldLedger.data.items[0].status,'provisioning');
  const repairId=uncertain.data.item.id;
  const crossOwnerRepair=await result(await repairPage({env,params:{id:repairId},request:visionRequest(`/api/vpage/pages/${repairId}/repair`,{method:'POST',session:'two'})}));assert.equal(crossOwnerRepair.status,404,'another owner cannot repair the held page');
  const changedRepair=await result(await repairPage({env,params:{id:repairId},request:visionRequest(`/api/vpage/pages/${repairId}/repair`,{method:'POST',session:'three',body:{slug:'changed-shop'}})}));assert.equal(changedRepair.status,400);assert.equal(changedRepair.data.code,'VPAGE_REPAIR_BODY_FORBIDDEN','repair never accepts changed browser payload');
  const repairedResponses=await Promise.all([repairPage({env,params:{id:repairId},request:visionRequest(`/api/vpage/pages/${repairId}/repair`,{method:'POST',session:'three'})}),repairPage({env,params:{id:repairId},request:visionRequest(`/api/vpage/pages/${repairId}/repair`,{method:'POST',session:'three'})})]);const repaired=await result(repairedResponses[0]),repairedRace=await result(repairedResponses[1]);assert.deepEqual([repaired.status,repairedRace.status],[200,200]);assert.equal(repaired.data.item.public_url,'https://smartlinkpage.com/third-shop');assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=3').get().status,'consumed');assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='third-shop'").get().count,1,'concurrent owner repairs create exactly one remote page');
  const repeatedRepair=await result(await repairPage({env,params:{id:repairId},request:visionRequest(`/api/vpage/pages/${repairId}/repair`,{method:'POST',session:'three'})}));assert.equal(repeatedRepair.status,200);assert.equal(repeatedRepair.data.replayed,true);assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='third-shop'").get().count,1,'repair replay never duplicates remote page');

  failAfterNextCreate=true;const lostResponse=await result(await createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',session:'five',key:'remote-committed-key-5',body:{display_name:'ร้านห้า',domain_id:'dom_smartlinkpage',slug:'five-shop'}})}));assert.equal(lostResponse.status,202);assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='five-shop'").get().count,1,'remote committed before response loss');const lostResponseId=lostResponse.data.item.id;
  const recoveredExisting=await result(await repairPage({env,params:{id:lostResponseId},request:visionRequest(`/api/vpage/pages/${lostResponseId}/repair`,{method:'POST',session:'five'})}));assert.equal(recoveredExisting.status,200);assert.equal(recoveredExisting.data.replayed,true);assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=5').get().status,'consumed');assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='five-shop'").get().count,1);

  visionControl.failFinalOnce=true;const localUncertain=await result(await createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',session:'six',key:'local-uncertain-key-6',body:{display_name:'ร้านหก',domain_id:'dom_smartlinkpage',slug:'six-shop'}})}));assert.equal(localUncertain.status,202);assert.equal(localUncertain.data.code,'VPAGE_REPAIR_REQUIRED');assert.equal(visionSqlite.prepare("SELECT status FROM vpage_pages WHERE user_id=6").get().status,'repair_required');assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=6').get().status,'available');const localUncertainId=visionSqlite.prepare('SELECT id FROM vpage_pages WHERE user_id=6').get().id;
  const localRecovered=await result(await repairPage({env,params:{id:localUncertainId},request:visionRequest(`/api/vpage/pages/${localUncertainId}/repair`,{method:'POST',session:'six'})}));assert.equal(localRecovered.status,200);assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=6').get().status,'consumed');assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='six-shop'").get().count,1);

  const [creditRaceA,creditRaceB]=await Promise.all([
    createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',session:'four',key:'credit-race-key-a',body:{display_name:'ร้านสี่ A',domain_id:'dom_smartlinkpage',slug:'four-shop-a'}})}),
    createPage({env,request:visionRequest('/api/vpage/pages',{method:'POST',session:'four',key:'credit-race-key-b',body:{display_name:'ร้านสี่ B',domain_id:'dom_smartlinkpage',slug:'four-shop-b'}})})
  ]);assert.deepEqual([creditRaceA.status,creditRaceB.status].sort(),[201,409],'one credit can provision only one page under concurrency');assert.equal(visionSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE user_id=4 AND status='active'").get().count,1);assert.equal(visionSqlite.prepare('SELECT status FROM vpage_credits WHERE user_id=4').get().status,'consumed');

  const ownerRef=await vpageOwnerRef(1),otherRef=await vpageOwnerRef(2),remoteId=created.data.item.vpage_id;
  const crossRead=await signedService('GET',`/api/v1/pages/${remoteId}/status`,otherRef);assert.equal(crossRead.status,404,'remote read is owner-isolated');
  const suspended=await result(await signedService('POST',`/api/v1/pages/${remoteId}/suspend`,ownerRef,{body:{},key:'suspend-mali-0001'}));assert.equal(suspended.status,200);assert.equal(suspended.data.item.status,'suspended');
  const oldExpiry=suspended.data.item.expires_at,renewed=await result(await signedService('POST',`/api/v1/pages/${remoteId}/renew`,ownerRef,{body:{},key:'renew-mali-000001'}));assert.equal(renewed.status,200);assert.ok(new Date(renewed.data.item.expires_at)>new Date(oldExpiry));
  const renewedReplay=await result(await signedService('POST',`/api/v1/pages/${remoteId}/renew`,ownerRef,{body:{},key:'renew-mali-000001'}));assert.equal(renewedReplay.data.replayed,true);assert.equal(renewedReplay.data.item.expires_at,renewed.data.item.expires_at,'renew retry does not extend twice');
  const resumed=await result(await signedService('POST',`/api/v1/pages/${remoteId}/resume`,ownerRef,{body:{},key:'resume-mali-0001'}));assert.equal(resumed.data.item.status,'active');

  for(let index=0;index<30;index++)visionSqlite.prepare("INSERT INTO vpage_pages(id,user_id,domain_id,slug,display_name,status,create_idempotency_key,create_request_hash) VALUES(?,1,'dom_smartlinkpage',?,?,'failed',?,?)").run(`vpl_${String(index).padStart(32,'0')}`,`failed-${index}`,`ทดสอบ ${index}`,`failed-key-${String(index).padStart(8,'0')}`,String(index).padStart(64,'0'));
  const first=await result(await listPages({env,request:visionRequest('/api/vpage/pages?limit=99')}));assert.equal(first.data.pagination.limit,24);assert.equal(first.data.items.length,24);assert.equal(first.data.pagination.has_more,true);
  const second=await result(await listPages({env,request:visionRequest(`/api/vpage/pages?limit=24&cursor=${first.data.pagination.next_cursor}`)}));const pageIds=[...first.data.items,...second.data.items].map(item=>item.id);assert.equal(new Set(pageIds).size,pageIds.length,'keyset pages have no duplicates');assert.equal(pageIds.length,31);
  const plan=visionSqlite.prepare('EXPLAIN QUERY PLAN SELECT * FROM vpage_pages WHERE user_id=? AND id<? ORDER BY id DESC LIMIT ?').all(1,'zzzz',25).map(row=>row.detail).join(' ');assert.match(plan,/idx_vpage_pages_owner_cursor/);
  const remotePlan=serviceSqlite.prepare('EXPLAIN QUERY PLAN SELECT id FROM vpage_pages WHERE domain_id=? AND slug=? LIMIT 1').all('dom_smartlinkpage','mali-shop').map(row=>row.detail).join(' ');assert.match(remotePlan,/sqlite_autoindex_vpage_pages_3|domain_id.*slug/i,'remote availability uses the atomic domain+slug index');

  const [raceA,raceB]=await Promise.all([
    signedService('POST','/api/v1/pages',await vpageOwnerRef(20),{body:{domain_id:'dom_smartlinkpage',slug:'atomic-shop',display_name:'A'},key:'atomic-create-a1'}),
    signedService('POST','/api/v1/pages',await vpageOwnerRef(21),{body:{domain_id:'dom_smartlinkpage',slug:'atomic-shop',display_name:'B'},key:'atomic-create-b1'})
  ]);assert.deepEqual([raceA.status,raceB.status].sort(),[201,409],'domain+slug is atomically unique');assert.equal(serviceSqlite.prepare("SELECT COUNT(*) count FROM vpage_pages WHERE slug='atomic-shop'").get().count,1);
  const deleted=await result(await signedService('POST',`/api/v1/pages/${remoteId}/delete`,ownerRef,{body:{},key:'delete-mali-0001'}));assert.equal(deleted.data.item.status,'deleted');assert.equal((await vpageService.fetch(new Request('https://smartlinkpage.com/mali-shop'),serviceEnv)).status,404);
  console.log('PASS Vpage signed provisioning, replay, conflict, repair, lifecycle, pagination and atomic uniqueness');
}finally{globalThis.fetch=nativeFetch;clearVpageCaches();serviceSqlite.close();visionSqlite.close()}
