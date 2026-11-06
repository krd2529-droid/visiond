import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);let chromium;
for(const name of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(name));break}catch{}}
if(!chromium)throw Error('Playwright Chrome required');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',local='http://127.0.0.1:53179/launch?command_id='+id;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:800}}),page=await context.newPage();let reads=0,localReads=0,popups=0;
  page.on('popup',()=>popups++);
  await page.route('https://visiondonline.com/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/api/launcher/status'){reads++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reads===1?{status:'waiting'}:{status:'pending',command_id:id,port:53179,expired:0})});return}
   if(path==='/launcher-open.html'){await route.fulfill({status:200,contentType:'text/html',body:readFileSync('public/launcher-open.html')});return}
   if(path==='/launcher-open.js'){await route.fulfill({status:200,contentType:'text/javascript',body:readFileSync('public/launcher-open.js')});return}
   if(path==='/launcher-pages.css'){await route.fulfill({status:200,contentType:'text/css',body:readFileSync('public/launcher-pages.css')});return}
   await route.fulfill({status:404,body:'missing'});
  });
  await page.route('http://127.0.0.1:53179/**',async route=>{localReads++;assert.equal(route.request().url(),local);assert.equal(route.request().method(),'GET');assert.equal(route.request().headers().referer,undefined,'no VisionD referrer reaches localhost');await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>VisionD Launcher</title><p>Helper received command</p>'})});
  await page.goto('https://visiondonline.com/launcher-open.html#command_id='+id);await page.waitForURL(local,{timeout:10000});
  assert.ok(reads>=2&&reads<=3,'waiting then pending status with at most one overlapping read');assert.equal(localReads,1,'one loopback request');assert.equal(popups,0,'no blocked secondary popup');assert.match(await page.locator('body').textContent(),/Helper received command/);
  await context.close();console.log('PASS same-tab Helper dispatch '+width+'px');
 }
}finally{await browser.close()}
