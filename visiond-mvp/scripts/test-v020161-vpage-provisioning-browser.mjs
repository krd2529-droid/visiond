import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
assert.ok(chromium,'installed Chrome required');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
let balance=1,pages=[],createCalls=0,repairCalls=0,createKey='',creditStatus='available',ambiguousCreate=false;
const send=(response,status,body)=>{response.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'});response.end(JSON.stringify(body))};
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/auth/me')return send(response,200,{user:{id:1,name:'Browser Owner',role:'user'}});
  if(url.pathname==='/api/notifications')return send(response,200,{items:[],unread_count:0});
  if(url.pathname==='/api/vpage/offer')return send(response,200,{item:{slug:'vpage-credit',price:99900}});
  if(url.pathname==='/api/vpage/credits')return send(response,200,{balance,items:[{id:1,status:creditStatus,service_days:30,granted_at:'2026-10-06 10:00:00',consumed_at:creditStatus==='consumed'?'2026-10-06 10:05:00':null,order_no:'VP-BROWSER'}],pagination:{limit:24,has_more:false,next_cursor:null}});
  if(url.pathname==='/api/vpage/domains')return send(response,200,{items:[{id:'dom_smartlinkpage',slot:1,hostname:'smartlinkpage.com'}]});
  if(url.pathname==='/api/vpage/availability')return send(response,200,{domain_id:'dom_smartlinkpage',slug:url.searchParams.get('slug'),available:!pages.length,public_url:`https://smartlinkpage.com/${url.searchParams.get('slug')}`});
  if(url.pathname==='/api/vpage/pages'&&request.method==='GET')return send(response,200,{items:pages,pagination:{limit:24,has_more:false,next_cursor:null}});
  if(url.pathname==='/api/vpage/pages'&&request.method==='POST'){
    createCalls++;createKey=String(request.headers['idempotency-key']||'');let raw='';for await(const chunk of request)raw+=chunk;const body=JSON.parse(raw);
    assert.equal(body.display_name,'ร้านมะลิออนไลน์');assert.equal(body.domain_id,'dom_smartlinkpage');assert.equal(body.slug,'mali-online');assert.equal(body.active_set,2);assert.equal(body.content_sets.length,2);assert.deepEqual(body.content_sets.map(item=>item.set_no),[1,2]);assert.match(body.content_sets[0].detail_text,/ชุด 1/);assert.match(body.content_sets[1].detail_text,/ชุด 2/);assert.deepEqual(body.content_sets[0].product_items.map(item=>item.destination_url),['https://shop.example/set-1-second','https://shop.example/set-1-first']);assert.match(createKey,/^[0-9a-f-]{36}$/);
    if(ambiguousCreate){pages=[{id:'vpl_0123456789abcdef0123456789abcdef',vpage_id:null,domain_id:body.domain_id,slug:body.slug,display_name:body.display_name,status:'repair_required',public_url:null,created_at:'2026-10-06T10:05:00.000Z',expires_at:null}];balance=0;creditStatus='provisioning';return send(response,202,{item:pages[0],code:'VPAGE_REPAIR_REQUIRED',error:'ยังยืนยันผลการสร้างไม่ได้'});}
    pages=[{id:'vpl_browser',vpage_id:'vp_browser',domain_id:body.domain_id,slug:body.slug,display_name:body.display_name,status:'active',public_url:'https://smartlinkpage.com/mali-online',created_at:'2026-10-06T10:05:00.000Z',expires_at:'2026-11-05T10:05:00.000Z'}];balance=0;creditStatus='consumed';return send(response,201,{item:pages[0],replayed:false});
  }
  if(/^\/api\/vpage\/pages\/vpl_[a-f0-9]{32}\/repair$/.test(url.pathname)&&request.method==='POST'){
    repairCalls++;assert.equal(request.headers['idempotency-key'],undefined,'repair does not depend on browser idempotency key');let raw='';for await(const chunk of request)raw+=chunk;assert.equal(raw,'','repair sends no mutable payload');pages=[{...pages[0],vpage_id:'vp_browser_recovered',status:'active',public_url:'https://smartlinkpage.com/mali-online',expires_at:'2026-11-05T10:05:00.000Z'}];creditStatus='consumed';return send(response,200,{item:pages[0],replayed:false});
  }
  const relative=url.pathname==='/'?'/vpage.html':url.pathname,local=path.resolve(publicRoot,`.${relative}`);
  if(!local.startsWith(publicRoot)||!fs.existsSync(local)){response.writeHead(404);return response.end('not found')}
  response.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(local)]||'application/octet-stream');response.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),base=`http://127.0.0.1:${server.address().port}`;
async function fillCreateSet(page,setNo){await page.locator(`[data-create-tab="${setNo}"]`).click();const panel=page.locator(`[data-create-content-set="${setNo}"]`);await panel.locator('[name="product_image_url"]').fill(`https://images.example/set-${setNo}-hero.jpg`);await panel.locator('[name="detail_text"]').fill(`รายละเอียดชุด ${setNo} DETAIL_SET_${setNo}`);if(setNo===1){await panel.locator('[data-item-list="product"] [data-add-item]').click();const rows=panel.locator('[data-item-list="product"] [data-item-row]');await rows.nth(0).locator('[data-item-field="destination_url"]').fill('https://shop.example/set-1-first');await rows.nth(1).locator('[data-item-field="destination_url"]').fill('https://shop.example/set-1-second');await rows.nth(1).locator('[data-move-item="-1"]').click()}else await panel.locator('[data-item-list="product"] [data-item-field="destination_url"]').fill('https://shop.example/set-2');const contact=panel.locator('[data-item-list="contact"] [data-item-row]');if(setNo===2){await contact.locator('[data-item-field="contact_type"]').selectOption('line');await contact.locator('[data-item-field="destination_url"]').fill('https://line.me/R/ti/p/@set2')}else await contact.locator('[data-item-field="destination_url"]').fill('https://facebook.com/set1');await panel.locator('[name="background_image_url"]').fill(`https://images.example/set-${setNo}-background.jpg`);await page.waitForFunction(value=>document.querySelector(`[data-create-content-set="${value}"] [data-template-slot="detail"]`)?.textContent.includes(`DETAIL_SET_${value}`),setNo)}
try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    balance=1;pages=[];createCalls=0;repairCalls=0;createKey='';creditStatus='available';ambiguousCreate=false;const page=await browser.newPage({viewport}),errors=[],badResponses=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)badResponses.push(`${response.status()} ${response.url()}`)});
    await page.goto(`${base}/vpage.html`);await page.waitForSelector('#vpageDomain:not([disabled])');assert.deepEqual(await page.evaluate(()=>({width:innerWidth,height:innerHeight})),viewport);assert.match(await page.locator('link[href^="/vpage.css"]').getAttribute('href'),/020172$/);assert.match(await page.locator('script[src^="/vpage.js"]').getAttribute('src'),/020172$/);assert.equal(await page.locator('#vpageBalance').innerText(),'1');
    await page.locator('#vpageDisplayName').fill('ร้านมะลิออนไลน์');await page.locator('#vpageSlug').fill('mali-online');await page.waitForFunction(()=>document.querySelector('#vpageAvailability')?.dataset.available==='true');
    assert.equal(await page.locator('#vpageUrlPreview').innerText(),'https://smartlinkpage.com/mali-online');assert.equal(await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).isEnabled(),true);
    await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).click();
    assert.equal(createCalls,0,'incomplete two-set content is rejected before create/credit hold');
    assert.match(await page.locator('#vpageAvailability').innerText(),/(?:ชุด|Set) 1/);
    await fillCreateSet(page,1);
    await page.locator('[data-create-tab="1"]').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('[data-create-tab="2"]').getAttribute('aria-selected'),'true');
    await fillCreateSet(page,2);
    assert.equal(await page.locator('[data-create-content-set="1"] [name="detail_text"]').inputValue(),'รายละเอียดชุด 1 DETAIL_SET_1','inactive set remains retained');
    assert.equal(await page.locator('[data-create-content-set="1"]').isHidden(),true);
    await page.locator('[data-create-tab="1"]').click();
    const createYoutube=page.locator('[data-create-content-set="1"] [name="youtube_url"]');
    await createYoutube.fill('https://user:pass@www.youtube.com/watch?v=abcdefghijk');
    await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).click();
    assert.equal(createCalls,0,'credentialed YouTube is rejected in the browser before credit hold');
    assert.match(await page.locator('#vpageAvailability').innerText(),/YouTube/);
    await createYoutube.fill('https://www.youtube.com/watch?v=abcdefghijk');await page.locator('#vpageCreateActiveSet').selectOption('2');
    await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).click();await page.waitForFunction(()=>document.querySelector('#vpageBalance')?.textContent==='0');assert.equal(createCalls,1);assert.match(await page.locator('#vpageAvailability').innerText(),/https:\/\/smartlinkpage\.com\/mali-online/);
    await page.reload();await page.waitForSelector('.vpage-page-row a');assert.equal(await page.locator('.vpage-page-row a').innerText(),'https://smartlinkpage.com/mali-online');assert.equal(await page.locator('#vpageBalance').innerText(),'0');assert.equal(createCalls,1,'reload never provisions again');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);assert.equal(overflow,false,`no horizontal overflow at ${viewport.width}`);assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);await page.close();
  }
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    balance=0;pages=[];createCalls=0;repairCalls=0;creditStatus='available';ambiguousCreate=false;
    const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}/vpage.html`);await page.waitForSelector('[data-create-content-set="1"]');
    assert.equal(await page.locator('#vpageBalance').innerText(),'0');
    assert.equal(await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).isDisabled(),true,'zero credits blocks creation but not preview');
    assert.equal(await page.locator('[data-create-tab="1"]').isVisible(),true);
    await page.locator('[data-create-content-set="1"] [name="detail_text"]').fill('ดูตัวอย่างก่อนซื้อเครดิต ZERO_CREDIT_PREVIEW');
    await page.waitForFunction(()=>document.querySelector('[data-create-content-set="1"] [data-template-slot="detail"]')?.textContent.includes('ZERO_CREDIT_PREVIEW'));
    await page.locator('[data-create-tab="2"]').click();
    assert.equal(await page.locator('[data-create-content-set="2"]').isVisible(),true,'second template remains available without a credit');
    assert.equal(createCalls,0,'preview at zero credits never creates a page or holds a credit');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
    assert.deepEqual(errors,[]);await page.close();
  }
  balance=1;pages=[];createCalls=0;repairCalls=0;createKey='';creditStatus='available';ambiguousCreate=true;
  let page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],badResponses=[];page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)badResponses.push(`${response.status()} ${response.url()}`)});
  await page.goto(`${base}/vpage.html`);await page.waitForSelector('#vpageDomain:not([disabled])');await page.locator('#vpageDisplayName').fill('ร้านมะลิออนไลน์');await page.locator('#vpageSlug').fill('mali-online');await page.waitForFunction(()=>document.querySelector('#vpageAvailability')?.dataset.available==='true');await fillCreateSet(page,1);await fillCreateSet(page,2);await page.locator('#vpageCreateActiveSet').selectOption('2');await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).click();await page.waitForSelector('[data-repair-page]');assert.equal(await page.locator('#vpageBalance').innerText(),'0');assert.equal(await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).isDisabled(),true);assert.equal(createCalls,1);
  await page.close();page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.status()>=400)badResponses.push(`${response.status()} ${response.url()}`)});await page.goto(`${base}/vpage.html`);await page.waitForSelector('[data-repair-page]');assert.equal(await page.locator('#vpageBalance').innerText(),'0','new browser page sees held balance');assert.equal(await page.getByRole('button',{name:'ยืนยันสร้างเซลเพจ'}).isDisabled(),true,'held balance cannot submit a new create');assert.deepEqual(await page.evaluate(()=>[...Object.keys(localStorage),...Object.keys(sessionStorage)].filter(key=>/vpage|create|idempotency/i.test(key))),[],'recovery does not depend on a Vpage browser-retained key');
  await page.getByRole('button',{name:'ตรวจสอบและดำเนินการต่อ'}).click();await page.waitForSelector('.vpage-page-row a');assert.equal(await page.locator('.vpage-page-row a').innerText(),'https://smartlinkpage.com/mali-online');assert.equal(await page.locator('#vpageBalance').innerText(),'0');assert.equal(createCalls,1,'repair never submits another browser create');assert.equal(repairCalls,1,'owner explicitly repairs once');await page.reload();await page.waitForSelector('.vpage-page-row a');assert.equal(createCalls,1);assert.equal(repairCalls,1);assert.equal(pages.length,1,'reload preserves exactly one page');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(badResponses,[]);await page.close();
  console.log('PASS Vpage desktop/mobile zero-credit preview, create plus timeout, new-browser owner repair, exact URL, one page/credit and clean console/network');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
