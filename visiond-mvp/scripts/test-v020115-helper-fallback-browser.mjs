import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of[process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
if(!chromium)throw new Error('Installed Chrome through Playwright is required');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public'),id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const closeServer=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.()});
const listen=server=>new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
const unused=net.createServer();await listen(unused);const missingPort=unused.address().port;await closeServer(unused);
let launchSeen=false,launchRequest=null,resolveOpenerProof;
const openerProof=new Promise(resolve=>{resolveOpenerProof=resolve});
const helper=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://127.0.0.1');
 if(url.pathname==='/launch'){launchRequest={url:request.url,headers:request.headers};launchSeen=true;response.writeHead(202,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});response.end('<!doctype html><title>VisionD Helper</title><script>fetch("/__test__/opener?absent="+(window.opener===null),{cache:"no-store"}).finally(()=>setTimeout(()=>window.close(),800))<\/script>');return}
 if(url.pathname==='/__test__/opener'){resolveOpenerProof(url.searchParams.get('absent')==='true');response.writeHead(204).end();return}
 response.writeHead(400).end();
});
await listen(helper);const helperPort=helper.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});

const installRoutes=async(page,{port,statusFailure=false}={})=>{
 let reads=0;
 await page.route('https://visiondonline.com/**',async route=>{
  const url=new URL(route.request().url()),relative=url.pathname==='/'?'/launcher-open.html':url.pathname;
  if(relative==='/api/launcher/status'){
   reads++;if(statusFailure&&reads>1){await route.fulfill({status:503,contentType:'application/json',body:'{}'});return}
   const body=launchSeen&&port===helperPort?{command_id:id,status:'process_started',port}:{command_id:id,status:'pending',expired:false,port};
   await route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'no-store'},body:JSON.stringify(body)});return;
  }
  const local=path.resolve(publicRoot,'.'+relative);if(!local.startsWith(publicRoot)||!fs.existsSync(local)){await route.fulfill({status:404,body:'not found'});return}
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(local)]||'application/octet-stream';await route.fulfill({status:200,contentType:type,headers:{'cache-control':'no-store'},body:fs.readFileSync(local)});
 });
 return ()=>reads;
};

try{
 const context=await browser.newContext({viewport:{width:1280,height:800},locale:'th-TH'}),page=await context.newPage();await installRoutes(page,{port:helperPort});
 await page.goto(`https://visiondonline.com/launcher-open.html#command_id=${id}`);await page.waitForFunction(()=>document.querySelector('#launcher-dispatch')?.hidden===false);
 assert.equal(page.url(),'https://visiondonline.com/launcher-open.html');assert.equal(await page.locator('#launcher-dispatch').textContent(),'เปิด Helper เครื่องนี้');assert.equal(await page.locator('#launcher-setup').textContent(),'ติดตั้ง/ซ่อมตัวช่วยเครื่องนี้');
 const popupPromise=context.waitForEvent('page');await page.click('#launcher-dispatch');const popup=await popupPromise;await popup.waitForURL(`http://127.0.0.1:${helperPort}/launch?command_id=${id}`);await popup.waitForLoadState('domcontentloaded');assert.equal(await Promise.race([openerProof,new Promise((_,reject)=>setTimeout(()=>reject(new Error('opener proof timed out')),2000))]),true);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('เริ่ม Chrome'));
 assert.equal(launchRequest.url,`/launch?command_id=${id}`);assert.equal(launchRequest.headers.host,`127.0.0.1:${helperPort}`);assert.equal(launchRequest.headers.referer,undefined);assert.equal(page.url(),'https://visiondonline.com/launcher-open.html');assert.equal(await page.evaluate(()=>document.hasFocus()),true);await page.waitForFunction(()=>document.querySelector('#status').dataset.type==='success');if(!popup.isClosed())await popup.waitForEvent('close',{timeout:2000});assert.equal(popup.isClosed(),true);await context.close();

 launchSeen=false;launchRequest=null;
 const mobile=await browser.newContext({viewport:{width:390,height:844},locale:'th-TH'}),mobilePage=await mobile.newPage(),failed=[];mobile.on('requestfailed',request=>failed.push({url:request.url(),error:request.failure()?.errorText||''}));await installRoutes(mobilePage,{port:missingPort,statusFailure:true});
 await mobilePage.goto(`https://visiondonline.com/launcher-open.html#command_id=${id}`);await mobilePage.waitForFunction(()=>document.querySelector('#launcher-dispatch')?.hidden===false);const missingPopupPromise=mobile.waitForEvent('page');await mobilePage.click('#launcher-dispatch');const missingPopup=await missingPopupPromise;await mobilePage.waitForFunction(()=>document.querySelector('#launcher-dispatch').textContent.includes('คำขอเดิม'));
 assert.equal(mobilePage.url(),'https://visiondonline.com/launcher-open.html');assert.equal(await mobilePage.evaluate(()=>document.hasFocus()),true);assert.equal(await mobilePage.locator('#launcher-setup').textContent(),'ติดตั้ง/ซ่อมตัวช่วยเครื่องนี้');assert.equal(await mobilePage.locator('#launcher-setup').getAttribute('href'),'/launcher-setup?state=not-running');assert.match(await mobilePage.locator('#status').textContent(),/อ่านคำขอไม่ได้/);assert.ok(await mobilePage.locator('body').evaluate(body=>body.scrollWidth<=innerWidth),'mobile recovery must not overflow');assert.equal(missingPopup.url(),'chrome-error://chromewebdata/');assert.ok(failed.some(item=>item.url===`http://127.0.0.1:${missingPort}/launch?command_id=${id}`&&/ERR_CONNECTION_REFUSED/.test(item.error)));await mobile.close();
}finally{await browser.close();await closeServer(helper)}

console.log('PASS v0.20.115 installed Chrome strict-loopback success plus absent-listener desktop/mobile recovery without a raw localhost final page');
