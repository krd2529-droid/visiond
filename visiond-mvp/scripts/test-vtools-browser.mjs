import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {env} from './test-vtools-access.mjs';
import {onRequestGet as catalog} from '../functions/api/vtools.js';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const root=path.resolve('public');
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/vtools'){const response=await catalog({env,request:new Request(url)});res.setHeader('content-type','application/json');res.end(await response.text());return}
  if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({items:[],user:null}));return}
  let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return}
  if(!path.extname(file))file+='.html';
  try{const body=fs.readFileSync(file);res.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(body)}catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
  const page=await browser.newPage({viewport:{width:1365,height:1000}}),base=`http://127.0.0.1:${server.address().port}`;
  await page.goto(base+'/vtools');await page.locator('[data-plan]').first().waitFor();
  assert.equal(await page.locator('[data-plan]').count(),3);
  await page.screenshot({path:path.join(os.tmpdir(),'vtools-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'เพิ่มลงตะกร้า'}).first().click();await page.waitForURL('**/cart');
  await page.waitForFunction(()=>document.querySelector('#cartItems')?.textContent.includes('VX'));
  assert.match(await page.locator('#cartItems').innerText(),/30 วัน/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart'))[0].price),49000);
  await page.goto(base+'/vtools');await page.locator('[data-plan]').first().waitFor();await page.locator('[data-plan]').nth(1).click();
  assert.match(await page.locator('#vxNotice').innerText(),/รายการเดิม/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart'))[0].account_limit),10,'existing cart preserved');
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(os.tmpdir(),'vtools-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no mobile overflow');
  console.log('PASS Vtools browser: 3 plans, add-to-cart, authoritative refreshed price, existing cart protected, mobile layout');
  console.log(path.join(os.tmpdir(),'vtools-desktop.png'));console.log(path.join(os.tmpdir(),'vtools-mobile.png'));
}finally{await browser.close();server.close()}
