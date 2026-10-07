import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import vpageService from '../services/vpage/src/index.js';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
assert.ok(chromium,'installed Chrome required');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const encoder=new TextEncoder(),secret='browser-domain-one-secret-at-least-32-chars',keyId='visiond-main-v1';
const hex=value=>[...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const ownerRef=await digest('visiond-vpage-owner-v1:20');

class Bound{
  constructor(sqlite,sql){this.sqlite=sqlite;this.sql=sql;this.args=[]}
  bind(...args){this.args=args;return this}
  async first(){return this.sqlite.prepare(this.sql).get(...this.args)||null}
  async all(){return{results:this.sqlite.prepare(this.sql).all(...this.args)}}
  async run(){const result=this.sqlite.prepare(this.sql).run(...this.args);return{meta:{changes:Number(result.changes)}}}
}
const d1=sqlite=>({prepare(sql){return new Bound(sqlite,sql)},async batch(statements){sqlite.exec('BEGIN');try{const out=[];for(const statement of statements)out.push(await statement.run());sqlite.exec('COMMIT');return out}catch(error){sqlite.exec('ROLLBACK');throw error}}});
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'});res.end(JSON.stringify(body))};
const readBody=async req=>{let raw='';for await(const chunk of req)raw+=chunk;return raw};

async function runScenario(browser,viewport,suffix){
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync(path.join(publicRoot,'../services/vpage/migrations/0001_vpage_service.sql'),'utf8')+fs.readFileSync(path.join(publicRoot,'../services/vpage/migrations/0002_vpage_editor.sql'),'utf8')+fs.readFileSync(path.join(publicRoot,'../services/vpage/migrations/0003_vpage_multi_items.sql'),'utf8'));
  const serviceEnv={VPAGE_DB:d1(sqlite),VPAGE_SHARED_SECRET:secret,VPAGE_KEY_ID:keyId};
  const state={balance:0,credits:[],order:0,page:null,slug:`domain-one-${suffix}`,localId:`vpl_${suffix.repeat(32).slice(0,32)}`};
  async function signed(method,apiPath,{body=null,key='',actorKind='owner'}={}){
    const raw=body===null?'':JSON.stringify(body),timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID().replaceAll('-',''),canonical=['vpage-v1',method,apiPath,keyId,timestamp,nonce,ownerRef,await digest(raw)].join('\n'),cryptoKey=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']),signature=hex(await crypto.subtle.sign('HMAC',cryptoKey,encoder.encode(canonical)));
    return vpageService.fetch(new Request(`https://vpage.local${apiPath}`,{method,headers:{'content-type':'application/json','x-vpage-key-id':keyId,'x-vpage-timestamp':timestamp,'x-vpage-nonce':nonce,'x-vpage-owner-ref':ownerRef,'x-vpage-signature':signature,...(key?{'idempotency-key':key}:{})},body:raw||undefined}),serviceEnv);
  }
  const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/api/auth/me')return json(res,200,{user:{id:20,name:'Flow Owner',role:'customer'}});
    if(url.pathname==='/api/vpage/offer')return json(res,200,{item:{slug:'vpage-credit',price:99900}});
    if(url.pathname==='/api/vpage/domains')return json(res,200,{items:[{id:'dom_smartlinkpage',hostname:'smartlinkpage.com'}]});
    if(url.pathname==='/api/vpage/credits')return json(res,200,{balance:state.balance,items:state.credits.map((item,index)=>({id:index+1,status:item,service_days:30,granted_at:'2026-10-07 10:00:00',consumed_at:item==='consumed'?'2026-10-07 10:01:00':null,order_no:`VP-${index+1}`})).reverse(),pagination:{limit:24,has_more:false,next_cursor:null}});
    if(url.pathname==='/api/orders'&&req.method==='POST'){state.order++;return json(res,201,{id:state.order,orderNo:`VP-BROWSER-${state.order}`,total:99900,bank:{bank_name:'Test Bank',account_name:'VisionD Test',account_number:'000000'}})}
    if(/^\/api\/orders\/\d+\/slip$/.test(url.pathname)&&req.method==='POST'){await readBody(req);state.balance++;state.credits.push('available');return json(res,200,{ok:true,auto_approved:true,count:1})}
    if(url.pathname==='/api/vpage/availability')return json(res,200,{available:!state.page,public_url:`https://smartlinkpage.com/${state.slug}`});
    if(url.pathname==='/api/vpage/pages'&&req.method==='GET'){const item=state.page?{id:state.localId,vpage_id:state.page.id,domain_id:'dom_smartlinkpage',slug:state.slug,display_name:'ร้าน Browser Flow',status:state.page.status,lifecycle_status:state.page.status==='active'&&new Date(state.page.expires_at)<=new Date()?'expired':state.page.status,public_url:`https://smartlinkpage.com/${state.slug}`,expires_at:state.page.expires_at,renewal_state:null}:null;return json(res,200,{items:item?[item]:[],pagination:{limit:24,has_more:false,next_cursor:null}})}
    if(url.pathname==='/api/vpage/pages'&&req.method==='POST'){const body=JSON.parse(await readBody(req)),remote=await signed('POST','/api/v1/pages',{body,key:req.headers['idempotency-key']});const payload=await remote.json();state.page=payload.item;state.balance--;const credit=state.credits.indexOf('available');state.credits[credit]='consumed';return json(res,remote.status,{item:{...payload.item,id:state.localId,vpage_id:payload.item.id},replayed:payload.replayed})}
    if(url.pathname===`/api/vpage/pages/${state.localId}/editor`){const remote=await signed('GET',`/api/v1/pages/${state.page.id}/editor`);const payload=await remote.json();return json(res,remote.status,{item:{...payload.item,id:state.localId,vpage_id:state.page.id}})}
    const save=url.pathname.match(new RegExp(`^/api/vpage/pages/${state.localId}/content-sets/([12])$`));if(save&&req.method==='PUT'){const body=JSON.parse(await readBody(req)),remote=await signed('PUT',`/api/v1/pages/${state.page.id}/content-sets/${save[1]}`,{body,key:req.headers['idempotency-key']});return json(res,remote.status,await remote.json())}
    if(url.pathname===`/api/vpage/pages/${state.localId}/active-set`&&req.method==='POST'){const input=JSON.parse(await readBody(req)),remote=await signed('POST',`/api/v1/pages/${state.page.id}/active-set`,{body:{active_set:input.active_set,actor_ref:ownerRef,actor_kind:'owner'},key:req.headers['idempotency-key']});return json(res,remote.status,await remote.json())}
    if(url.pathname===`/api/vpage/pages/${state.localId}/renew`&&req.method==='POST'){if(state.balance<1)return json(res,409,{error:'ไม่มีเครดิต Vpage ที่พร้อมใช้สำหรับต่ออายุ',code:'VPAGE_CREDIT_REQUIRED'});let remote=await signed('POST',`/api/v1/pages/${state.page.id}/renew`,{body:{},key:req.headers['idempotency-key']});let payload=await remote.json();if(payload.item?.status==='suspended'){remote=await signed('POST',`/api/v1/pages/${state.page.id}/resume`,{body:{},key:`resume-${suffix}-renew`});payload=await remote.json()}state.page=payload.item;state.balance--;state.credits[state.credits.indexOf('available')]='consumed';return json(res,200,{item:{...payload.item,id:state.localId,lifecycle_status:'active'},replayed:false})}
    if(url.pathname==='/__test/expire'){sqlite.prepare("UPDATE vpage_pages SET expires_at=datetime('now','-1 day') WHERE id=?").run(state.page.id);state.page={...state.page,expires_at:new Date(Date.now()-86400000).toISOString()};return json(res,200,{ok:true})}
    if(url.pathname===`/${state.slug}`){const response=await vpageService.fetch(new Request(`https://smartlinkpage.com/${state.slug}`),serviceEnv),body=Buffer.from(await response.arrayBuffer());res.writeHead(response.status,Object.fromEntries(response.headers));return res.end(body)}
    const relative=url.pathname==='/'?'/vpage.html':url.pathname,local=path.resolve(publicRoot,`.${relative}`);if(!local.startsWith(publicRoot)||!fs.existsSync(local)){res.writeHead(404);return res.end('not found')}const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(local)]||'application/octet-stream';res.writeHead(200,{'content-type':type});res.end(fs.readFileSync(local));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,context=await browser.newContext({viewport});
  await context.route('https://images.example/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZKJ8AAAAASUVORK5CYII=','base64')}));
  const page=await context.newPage(),errors=[],consoleErrors=[],failed=[],bad=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});page.on('requestfailed',request=>failed.push(`${request.method()} ${request.url()}`));page.on('response',response=>{if(response.status()>=400)bad.push(`${response.status()} ${response.url()}`)});
  try{
    await page.goto(`${base}/vpage.html`);await page.waitForFunction(()=>document.querySelector('#vpageBalance')?.textContent==='0');await page.getByRole('button',{name:'ซื้อ 1 เครดิต'}).click();await page.waitForSelector('#vpagePayment[open]');await page.locator('#vpageSlipForm input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from('synthetic-slip')});await page.getByRole('button',{name:'อัปโหลดสลิป'}).click();await page.waitForFunction(()=>document.querySelector('#vpageBalance')?.textContent==='1',{timeout:5000});
    await page.locator('#vpageDisplayName').fill('ร้าน Browser Flow');await page.locator('#vpageSlug').fill(state.slug);await page.waitForFunction(()=>document.querySelector('#vpageAvailability')?.dataset.available==='true');await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).click();await page.waitForSelector('[data-edit-page]');assert.equal(await page.locator('#vpageBalance').innerText(),'0');
    await page.getByRole('button',{name:'จัดการเนื้อหา'}).click();await page.waitForSelector('#vpageEditor[open]');for(const setNo of [1,2]){await page.getByRole('tab',{name:`ชุดเนื้อหา ${setNo}`}).click();const form=page.locator(`[data-content-set="${setNo}"]`);await form.locator('[name="product_image_url"]').fill(`https://images.example/${suffix}-${setNo}-hero.png`);await form.locator('[name="detail_text"]').fill(`รายละเอียด browser ${setNo}`);await form.locator('[data-item-list="product"] [data-item-field="destination_url"]').fill(`https://shop.example/${suffix}-${setNo}`);await form.locator('[data-item-list="contact"] [data-item-field="contact_type"]').selectOption('line');await form.locator('[data-item-list="contact"] [data-item-field="destination_url"]').fill(`https://line.me/R/ti/p/@${suffix}${setNo}`);await form.locator('[name="background_image_url"]').fill(`https://images.example/${suffix}-${setNo}-background.png`);await form.getByRole('button',{name:`บันทึกชุด ${setNo}`}).click();await page.waitForFunction(number=>document.querySelector('#vpageEditorMessage')?.textContent===`บันทึกชุด ${number} แล้ว`,setNo)}
    await page.locator('[data-content-set="2"]').getByRole('button',{name:'แสดงชุด 2'}).click();await page.waitForFunction(()=>document.querySelector('#vpageEditorMessage')?.textContent.includes('ชุด 2'));const publicPage=await context.newPage();await publicPage.goto(`${base}/${state.slug}`);assert.equal(await publicPage.locator('main').getAttribute('data-active-set'),'2');assert.equal(await publicPage.locator('.detail').innerText(),'รายละเอียด browser 2');assert.equal(await publicPage.locator('iframe,.video').count(),0);await publicPage.close();
    await page.evaluate(()=>fetch('/__test/expire'));await page.reload();await page.waitForSelector('[data-status="expired"]');assert.equal(await page.locator('[data-status="expired"]').innerText(),'หมดอายุ');assert.equal(await page.locator('[data-edit-page]').count(),0);assert.equal(await page.getByRole('button',{name:'ใช้ 1 เครดิตต่ออายุ 30 วัน'}).count(),1);
    await page.getByRole('button',{name:'ซื้อ 1 เครดิต'}).click();await page.locator('#vpageSlipForm input[type=file]').setInputFiles({name:'synthetic-renew.png',mimeType:'image/png',buffer:Buffer.from('synthetic-renewal-slip')});await page.getByRole('button',{name:'อัปโหลดสลิป'}).click();await page.waitForFunction(()=>document.querySelector('#vpageBalance')?.textContent==='1',{timeout:5000});await page.getByRole('button',{name:'ใช้ 1 เครดิตต่ออายุ 30 วัน'}).click();await page.waitForSelector('[data-status="active"]');assert.equal(await page.locator('[data-status="active"]').innerText(),'เปิดใช้งาน');assert.equal(await page.locator('#vpageBalance').innerText(),'0');assert.equal(await page.locator('[data-edit-page]').count(),1);const renewedPublic=await page.request.get(`${base}/${state.slug}`);assert.equal(renewedPublic.status(),200);assert.match(await renewedPublic.text(),/รายละเอียด browser 2/);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failed,[]);assert.deepEqual(bad,[]);
  }finally{await context.close();await new Promise(resolve=>server.close(resolve));sqlite.close()}
}

const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{await runScenario(browser,{width:1440,height:900},'d');await runScenario(browser,{width:390,height:844},'e');console.log('PASS Vpage continuous installed-Chrome desktop/mobile purchase, create, two-set switch, expire, credit renewal and restored public/edit flow with clean console/network')}
finally{await browser.close()}
