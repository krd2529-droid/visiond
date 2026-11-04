import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const require=createRequire(import.meta.url);let chromium;
for(const name of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(name));break}catch{}}
if(!chromium)throw Error('Playwright Chrome required');
const root=resolve('public'),intent='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',helper='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',code='ABCDEF123456',accountCode='A1B2C3D4';
const manifest=JSON.parse(readFileSync(resolve(root,'downloads/visiond-helper/0.20.79/release.json')));
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
 for(const width of [1280,390]){
  const context=await browser.newContext({viewport:{width,height:800},acceptDownloads:true}),page=await context.newPage(),calls=[];let nativeApproved=false,failConfirmOnce=false;
  await page.route('https://visiondonline.com/**',async route=>{
   const request=route.request(),url=new URL(request.url()),p=url.pathname==='/launcher-setup'?'/launcher-setup.html':url.pathname,body=request.postDataJSON?.()||{};
   if(p==='/api/auth/me'){calls.push({p});await route.fulfill({status:200,contentType:'application/json',body:'{"user":{"id":1}}'});return}
   if(p==='/api/launcher/pair-intent'){calls.push({p,body});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({intent_id:intent,account_code:accountCode})});return}
   if(p==='/api/launcher/pair-intent-status'){calls.push({p});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(nativeApproved?{status:'staged',pair_id:helper,account_code:accountCode}:{status:'waiting',account_code:accountCode})});return}
   if(p==='/api/launcher/pair-prepare'){calls.push({p,body});await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({pair_id:helper,pair_code:code,confirm_nonce:'private-test-nonce',replace_id:''})});return}
   if(p==='/api/launcher/pair-confirm'){calls.push({p,body});if(failConfirmOnce){failConfirmOnce=false;await route.fulfill({status:503,contentType:'text/html',body:'<h1>Temporary failure</h1>'});return}await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({paired:true,helper_id:helper})});return}
   if(p==='/tiktok-analyzer'){await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Analyzer</title>'});return}
   const local=resolve(root,'.'+p);if(!local.startsWith(root)||!existsSync(local)){await route.fulfill({status:404,body:'missing'});return}
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.exe':'application/octet-stream'}[extname(local)]||'application/octet-stream';
   await route.fulfill({status:200,contentType:mime,headers:p.endsWith('.exe')?{'content-disposition':'attachment; filename="VisionD-Helper-Setup.exe"'}:{},body:readFileSync(local)});
  });
  await page.goto('https://visiondonline.com/launcher-setup?state=not-running');await page.waitForFunction(()=>document.querySelector('#wizard-next')?.disabled===false);assert.equal(calls.filter(x=>x.p==='/api/auth/me').length,1,'closed advanced pairing does not duplicate account request');
  assert.equal(await page.locator('#setup-state').inputValue(),'not-running');assert.equal(await page.locator('#pair-entry').isVisible(),false);
  if(width===1280){await page.locator('#setup-details').evaluate(el=>{el.open=true});await page.waitForFunction(()=>document.querySelector('#pair-entry')?.disabled===false);assert.equal(calls.filter(x=>x.p==='/api/auth/me').length,2,'advanced pairing checks account only when opened');await page.locator('#setup-details').evaluate(el=>{el.open=false});await page.locator('#setup-details').evaluate(el=>{el.open=true});await page.waitForTimeout(50);assert.equal(calls.filter(x=>x.p==='/api/auth/me').length,2,'reopening advanced uses current authenticated state');await page.locator('#setup-details').evaluate(el=>{el.open=false})}
  const downloadPromise=page.waitForEvent('download');await page.click('#wizard-next');const download=await downloadPromise;assert.equal(download.suggestedFilename(),'VisionD-Helper-Setup-0.20.79.exe');
  assert.match(await page.locator('#wizard-progress').textContent(),/ขั้นที่ 2/);await page.click('#wizard-next');assert.match(await page.locator('#wizard-progress').textContent(),/ขั้นที่ 3/);
  await page.click('#wizard-next');await page.waitForFunction(()=>document.querySelector('#wizard-content')?.textContent.includes('A1B2C3D4'));assert.equal(calls.filter(x=>x.p==='/api/launcher/pair-intent').length,1);assert.equal(calls.some(x=>x.p==='/api/launcher/pair-confirm'),false);
  nativeApproved=true;try{await page.waitForFunction(()=>document.querySelector('.wizard-code')?.textContent==='ABCDEF123456',null,{timeout:7000})}catch(e){console.error('wizard debug',page.url(),await page.locator('#wizard-progress').textContent().catch(()=>''),calls);throw e}
  assert.equal(await page.locator('#wizard-next').isDisabled(),true);assert.equal(await page.locator('input[type=text]:visible').count(),0);
  await page.check('#wizard-match');await page.click('#wizard-next');try{await page.waitForFunction(()=>document.querySelector('#wizard-progress')?.textContent.includes('ตรวจ Helper เครื่องนี้แล้ว'),null,{timeout:7000})}catch(e){console.error('confirm debug',await page.locator('#wizard-progress').textContent(),calls);throw e}
  assert.deepEqual(calls.filter(x=>x.p==='/api/launcher/pair-prepare').map(x=>x.body),[{pair_id:helper,intent_id:intent}]);
  assert.equal(calls.filter(x=>x.p==='/api/launcher/pair-confirm').length,1);assert.equal(calls.at(-1).body.intent_id,intent);
  assert.equal(await page.evaluate(()=>localStorage.getItem('visiond_launcher_helper')),helper);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.click('#wizard-next');await page.waitForURL('https://visiondonline.com/tiktok-analyzer');
  if(width===1280){
   calls.length=0;nativeApproved=true;failConfirmOnce=true;await page.goto('https://visiondonline.com/launcher-setup?state=not-running');await page.waitForFunction(()=>document.querySelector('#wizard-next')?.disabled===false);
   const secondDownload=page.waitForEvent('download');await page.click('#wizard-next');await secondDownload;await page.click('#wizard-next');await page.click('#wizard-next');await page.waitForFunction(()=>!!document.querySelector('#wizard-match'));await page.check('#wizard-match');await page.click('#wizard-next');await page.waitForFunction(()=>document.querySelector('#wizard-retry')?.hidden===false);
   assert.equal(calls.filter(x=>x.p==='/api/launcher/pair-confirm').length,1);assert.match(await page.locator('#wizard-progress').textContent(),/อ่านคำตอบจาก VisionD ไม่สำเร็จ/);await page.click('#wizard-retry');await page.waitForFunction(()=>document.querySelector('#wizard-progress')?.textContent.includes('ตรวจ Helper เครื่องนี้แล้ว'));
   const confirmations=calls.filter(x=>x.p==='/api/launcher/pair-confirm').map(x=>x.body);assert.equal(confirmations.length,2);assert.deepEqual(confirmations[0],confirmations[1]);
   console.log('PASS transient confirm retries exact intent/nonce without typing or new helper');
  }
  await context.close();console.log('PASS Next-only same-tab wizard '+width+'px, verified download, human match and Analyzer return');
 }
 assert.equal(manifest.executable.sha256,readFileSync(resolve(root,'launcher-setup.js'),'utf8').match(/expectedHash='([a-f0-9]+)'/)?.[1]);
}finally{await browser.close()}
