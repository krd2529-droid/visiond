import {createRequire} from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {env} from './test-vtools-access.mjs';
import {onRequestGet as plansCatalog} from '../functions/api/vtools.js';
const require=createRequire(import.meta.url);let chromium;for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}if(!chromium)throw new Error('Playwright unavailable');
const root=path.resolve('public'),evidence=path.resolve('../.agents/reports');fs.mkdirSync(evidence,{recursive:true});
const offer={id:91,product_id:191,product_slug:'demo-monthly',code:'monthly',duration_days:30,price:9900};
const app=(id,platform,name)=>({id,code:`tool-${id}`,app_name:name,app_description:`คำอธิบาย ${name}`,platform_type:platform,current_version:'1.0.0',offers:[offer]});
const catalog=[...Array.from({length:26},(_,index)=>app(index+1,index%2?'mac':'windows',index===25?'โปรแกรมกลางชื่อทดสอบ':`โปรแกรมคอม ${index+1}`)),app(27,'web','เว็บเครื่องมือ'),app(28,'android','แอปมือถือ'),app(29,'veasy','V Easy'),app(30,'cross-platform','โปรแกรมหลายระบบ')];
catalog.unshift({...app(40,'windows','Follow me'),name:'Follow me',code:'auto-invite',current_version:'1.7.4',offers:[{id:9,product_id:5498,product_slug:'vbot-key-auto-invite-monthly',code:'monthly',name:'คีย์ 30 วัน · Windows 1 เครื่อง',duration_days:30,price:59000,offer_price:59000},{id:8,product_id:5497,product_slug:'vbot-key-auto-invite-lifetime',code:'lifetime',name:'คีย์ตลอดชีพ · Windows 1 เครื่อง',duration_days:null,price:159000,offer_price:159000}]});
let empty=false,delayDesktop=false,releaseDesktop,desktopStarted,listRequests=[],detailRequests=[],trialRequests=0,vxRequests=0,productsFail=false;
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/vtools'){vxRequests++;const response=await plansCatalog({env,request:new Request(url)});res.setHeader('content-type','application/json');res.end(await response.text());return}
  if(url.pathname==='/api/vision7/trial'&&req.method==='POST'){trialRequests++;let body='';for await(const chunk of req)body+=chunk;assert.equal(JSON.parse(body).program_id,99);res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,key:'VD7-SYNTHETIC'}));return}
  if(url.pathname==='/api/vision7/apps'){listRequests.push(url.search);const category=url.searchParams.get('category')||'all',q=(url.searchParams.get('q')||'').toLowerCase(),offset=Number(url.searchParams.get('cursor')||0),group=value=>['windows','mac'].includes(value)?'desktop':value==='web'?'web':['android','veasy'].includes(value)?'mobile':'other',rows=(empty?[]:catalog).filter(item=>(category==='all'||group(item.platform_type)===category)&&(!q||`${item.app_name} ${item.app_description} ${item.code}`.toLowerCase().includes(q))),items=rows.slice(offset,offset+24);if(delayDesktop&&category==='desktop'&&!offset){delayDesktop=false;desktopStarted?.();await new Promise(resolve=>releaseDesktop=resolve)}res.setHeader('content-type','application/json');res.end(JSON.stringify({items,has_more:offset+24<rows.length,next_cursor:offset+24<rows.length?String(offset+24):null,has_other:!empty}));return}
  const detail=url.pathname.match(/^\/api\/vision7\/apps\/([^/]+)$/);if(detail){detailRequests.push(detail[1]);const item=(empty?[]:catalog).find(row=>row.code===decodeURIComponent(detail[1]));res.statusCode=item?200:404;res.setHeader('content-type','application/json');res.end(JSON.stringify(item?{item}:{error:'ไม่พบแอป'}));return}
  if(url.pathname==='/api/products'&&productsFail){res.statusCode=500;res.setHeader('content-type','application/json');res.end(JSON.stringify({error:'catalog unavailable'}));return}
  if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({items:[],user:null}));return}
  let file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return}if(!path.extname(file))file+='.html';try{const body=fs.readFileSync(file);res.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(body)}catch{res.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
  const base=`http://127.0.0.1:${server.address().port}`,page=await browser.newPage({viewport:{width:1365,height:900}});
  await page.goto(base+'/vtools');
  await page.waitForFunction(()=>document.querySelectorAll('#programs .vbot-card').length===24);
  assert.match(listRequests[0],/category=desktop.*limit=24/,'computer group loads first');
  assert.equal(await page.locator('[data-platform="desktop"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.vtools-vx-card,#vxPlans,#vxAccess').count(),0,'VX public sales panels are absent');
  assert.equal(vxRequests,0,'public Vtools no longer fetches VX plans');
  const follow=page.locator('#programs .vbot-card').filter({hasText:'Follow me'});
  assert.equal(await follow.count(),1,'Follow me appears in computer group');
  assert.match(await follow.innerText(),/1.7.4/);
  assert.match(await follow.innerText(),/590 (บาท|THB)/);
  assert.match(await follow.innerText(),/1,590 (บาท|THB)/);
  assert.equal(await follow.locator('del').count(),0,'old comparison price is gone');
  await page.locator('#vbotMore').click();
  await page.waitForFunction(()=>document.querySelectorAll('#programs .vbot-card').length===24+3);
  assert.equal(new Set(await page.locator('#programs .vbot-card h3').allInnerTexts()).size,27,'keyset pages do not duplicate');
  await page.locator('[data-platform="web"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#programs .vbot-card').length===1);
  assert.equal(await page.locator('.vtools-vx-card,#vxPlans').count(),0);
  await page.locator('#vbotSearch').fill('VX');
  await page.waitForFunction(()=>document.querySelector('#vbotContent')?.textContent?.includes('ไม่พบเครื่องมือ'));
  assert.equal(await page.locator('#programs .vbot-card').count(),0,'VX is absent from public search');
  delayDesktop=true;const desktopRequested=new Promise(resolve=>desktopStarted=resolve);
  await page.locator('[data-platform-link="desktop"]').click();await desktopRequested;
  await page.locator('[data-platform="desktop"]').click();releaseDesktop();
  await page.waitForFunction(()=>document.querySelector('#vbotContent')?.textContent?.includes('ไม่พบเครื่องมือ'));
  assert.equal(listRequests.filter(value=>value.includes('category=desktop')&&value.includes('q=VX')).length,1,'simultaneous requests for the same category/search are deduplicated');
  await page.locator('#vbotSearch').fill('');
  await page.waitForFunction(()=>document.querySelectorAll('#programs .vbot-card').length===27);
  assert.equal(listRequests.filter(value=>value.includes('category=desktop')&&!value.includes('q=')).length,2,'returning to the cached first page does not refetch');
  await page.goto(base+'/vtools?app=auto-invite');
  await page.locator('.vbot-detail').waitFor();
  assert.match(await page.locator('.vbot-detail').innerText(),/Follow me/);
  assert.equal(await page.locator('[data-offer]').count(),2);
  assert.match(await page.locator('.vbot-detail').innerText(),/590 (บาท|THB)/);
  assert.match(await page.locator('.vbot-detail').innerText(),/1,590 (บาท|THB)/);
  assert.equal(await page.locator('.vbot-detail del').count(),0);
  await page.locator('[data-offer]').nth(0).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart'))[0].price),59000,'monthly cart is 590 baht');
  await page.locator('[data-offer]').nth(1).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart'))[0].price),159000,'lifetime cart is 1,590 baht');
  await page.goto(base+'/cart');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vd_cart')||'[]')[0]?.vbot_offers?.length===2);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart'))[0].title),'Follow me · คีย์ตลอดชีพ · Windows 1 เครื่อง','cart refresh does not duplicate key prefix');
  assert.doesNotMatch(await page.locator('#cartItems .cart-product h2').textContent(),/คีย์\s*คีย์/u,'rendered title has one key prefix');
  assert.match(await page.locator('#cartTotal').textContent(),/1,590/);
  await page.locator('[data-vbot-plan]').selectOption('9');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart'))[0].title),'Follow me · คีย์ 30 วัน · Windows 1 เครื่อง','switching to monthly keeps one key prefix');
  assert.doesNotMatch(await page.locator('#cartItems .cart-product h2').textContent(),/คีย์\s*คีย์/u);
  assert.match(await page.locator('#cartTotal').textContent(),/590/);
  await page.locator('[data-vbot-plan]').selectOption('8');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart'))[0].title),'Follow me · คีย์ตลอดชีพ · Windows 1 เครื่อง','switching back to lifetime keeps one key prefix');
  assert.doesNotMatch(await page.locator('#cartItems .cart-product h2').textContent(),/คีย์\s*คีย์/u);
  assert.match(await page.locator('#cartTotal').textContent(),/1,590/);

  productsFail=true;
  await page.evaluate(()=>{const cart=JSON.parse(localStorage.getItem('vd_cart'));cart[0].title='Follow me · คีย์ คีย์ตลอดชีพ · Windows 1 เครื่อง';cart.push({id:901,slug:'saved-digital-product',title:'Saved digital product',price:10000,product_kind:'product',category:'worksheet',quantity:1});localStorage.setItem('vd_cart',JSON.stringify(cart))});
  await page.reload();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('vd_cart')||'[]')[0]?.title==='Follow me · คีย์ตลอดชีพ · Windows 1 เครื่อง');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('vd_cart')).length),2,'catalog outage preserves an unrelated saved product');
  assert.match(await page.locator('#cartTotal').textContent(),/1,690/,'Vision7 price refresh continues while products API fails');
  productsFail=false;

  await page.goto(base+'/');
  assert.equal(await page.locator('#homeFollowMeTitle').innerText(),'Follow me');
  assert.equal(await page.locator('.home-followme-offer del').count(),0);
  assert.match(await page.locator('.home-followme-offer').innerText(),/590 (บาท|THB)/);
  assert.match(await page.locator('.home-followme-offer').innerText(),/1,590 (บาท|THB)/);
  assert.equal(new URL(await page.locator('.home-followme-offer a').first().getAttribute('href'),'http://localhost').pathname,'/vtools');
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  await mobile.goto(base+'/vtools');
  await mobile.waitForFunction(()=>document.querySelectorAll('#programs .vbot-card').length===24);
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile Vtools has no horizontal overflow');
  await mobile.goto(base+'/');
  assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile homepage has no horizontal overflow');
  console.log('PASS Vtools browser: VX hidden, Follow me desktop/home/detail two prices, exact carts, keyset, mobile');
}finally{await browser.close();server.close()}
