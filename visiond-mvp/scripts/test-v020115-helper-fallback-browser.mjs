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
 let popups=0;page.on('popup',()=>popups++);await page.goto(`https://visiondonline.com/launcher-open.html#command_id=${id}`,{waitUntil:'domcontentloaded'});await page.waitForURL(`http://127.0.0.1:${helperPort}/launch?command_id=${id}`);await page.waitForLoadState('domcontentloaded');assert.equal(await Promise.race([openerProof,new Promise((_,reject)=>setTimeout(()=>reject(new Error('opener proof timed out')),2000))]),true);
 assert.equal(launchRequest.url,`/launch?command_id=${id}`);assert.equal(launchRequest.headers.host,`127.0.0.1:${helperPort}`);assert.equal(launchRequest.headers.referer,undefined);assert.equal(popups,0,'same-tab navigation uses no secondary popup');await context.close();

 launchSeen=false;launchRequest=null;
 const mobile=await browser.newContext({viewport:{width:390,height:844},locale:'th-TH'}),mobilePage=await mobile.newPage();await installRoutes(mobilePage,{port:missingPort,statusFailure:true});
 let mobilePopups=0,refused=false;mobilePage.on('popup',()=>mobilePopups++);await mobilePage.goto(`https://visiondonline.com/launcher-open.html#command_id=${id}`,{waitUntil:'domcontentloaded'});await mobilePage.waitForURL('chrome-error://chromewebdata/').catch(error=>{assert.match(error.message,/ERR_CONNECTION_REFUSED/);refused=true});assert.equal(refused,true,'missing listener rejects the same-tab navigation');assert.equal(mobilePopups,0);await mobile.close();
}finally{await browser.close();await closeServer(helper)}

console.log('PASS installed Chrome same-tab strict-loopback success and absent-listener browser error without a secondary popup');
