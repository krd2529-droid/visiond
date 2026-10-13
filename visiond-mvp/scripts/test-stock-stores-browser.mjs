import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
if(!chromium)throw new Error('Playwright Chromium is required');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const toy={id:7,store_id:'toys-center',meta_id:'TOY-7',title:'Toy Product',price:100,status:'published',availability:'in stock',image_1_url:'/fixture/image.svg',image_2_url:'/fixture/image.svg',product_tags:'[]',updated_at:'2026-10-13 00:00:00'};
const zippo={...toy,id:8,store_id:'zippo',meta_id:'ZIP-8',title:'Zippo Product'};
let toyMoved=false,moveCalls=0;
const send=(res,data,status=200)=>{res.statusCode=status;res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(data))};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),store=url.searchParams.get('store')||'toys-center',item=store==='zippo'?zippo:toy,items=store==='zippo'?(toyMoved?[zippo,{...toy,store_id:'zippo',slug:'toy-product'}]:[zippo]):toyMoved?[]:[toy];
  if(url.pathname==='/api/admin/toys-center/7/move'&&req.method==='POST'){let body='';for await(const chunk of req)body+=chunk;assert.equal(new URL(req.url,'http://127.0.0.1').searchParams.get('store'),'toys-center');assert.equal(JSON.parse(body).destination_store_id,'zippo');moveCalls++;toyMoved=true;return send(res,{ok:true,message:'ย้ายสินค้าไป Zippo แล้ว'})}
  if(url.pathname==='/api/admin/toys-center')return send(res,{settings:{storefront_mode:'unlisted',page_id:store==='zippo'?'1208831352314389':'',page_name:store==='zippo'?'Zippo Udonthani':'Toys Center',catalog_id:store==='zippo'?'1018833961115899':'',catalog_name:store==='zippo'?'Zippo':'',page_association_status:store==='zippo'?'verified_in_meta_ui':'unverified',connection_message:'VisionD ยังไม่ได้ยืนยันสถานะการนำเข้าฟีดจาก Meta',public_path:store==='zippo'?'/zippoudon':'/toyscenter',feed_path:store==='zippo'?'/api/stock/feed.csv?store=zippo':'/api/toys-center/feed.csv'},items,pagination:{limit:24,total:items.length,next_cursor:null},permissions:{can_manage_orders:false}});
  if(['/api/stock/products','/api/toys-center/products'].includes(url.pathname)){const publicItems=url.pathname==='/api/stock/products'?items:(toyMoved?[]:[{...toy,slug:'toy-product'}]),products=publicItems.map(value=>({...value,slug:value.slug||'zippo-product',visiond_image_urls:['/fixture/image.svg']}));if(url.searchParams.has('slug')){const product=products.find(value=>value.slug===url.searchParams.get('slug'));return send(res,product?{item:product}:{error:'not found'},product?200:404)}return send(res,{items:products,pagination:{total:publicItems.length,next_cursor:null},storefront_mode:'unlisted'})}
  if(['/api/admin/toys-center/shopee-products','/api/admin/toys-center/thaimart-products'].includes(url.pathname))return send(res,{items:[item],pagination:{next_cursor:null}});
  if(url.pathname.endsWith('/shopee-export')){if(store==='zippo')await new Promise(resolve=>setTimeout(resolve,650));return send(res,{schema:'visiond.shopee-product-handoff',version:1,product:{page_1:{name:item.title}},validation:{complete:true,missing:[]}})}
  if(url.pathname.endsWith('/thaimart-export'))return send(res,{schema:'visiond.thaimart-product-handoff',version:1,product:{name:item.title},validation:{complete:true,missing:[]}});
  if(url.pathname.startsWith('/fixture/')){res.setHeader('content-type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')}
  const relative=url.pathname==='/'?'/toys-center-admin.html':['/zippoudon','/zippo'].includes(url.pathname)?`${url.pathname}.html`:url.pathname,local=path.resolve(publicRoot,`.${relative}`);
  if(!local.startsWith(publicRoot)||!fs.existsSync(local)){res.statusCode=404;return res.end('not found')}
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[path.extname(local)]||'application/octet-stream');res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(`${base}/toys-center-admin.html`);await page.waitForSelector('.product-row');
  assert.match(await page.locator('.product-row').textContent(),/Toy Product/);
  await page.locator('#shopeeSearchInput').fill('Toy');await page.waitForSelector('.shopee-result');await page.locator('.shopee-result').click();await page.waitForFunction(()=>document.querySelector('#shopeeJsonText').textContent.includes('Toy Product'));
  await page.locator('#thaiMartSearchInput').fill('Toy');await page.waitForSelector('.thaimart-result');await page.locator('.thaimart-result').click();await page.waitForFunction(()=>document.querySelector('#thaiMartJsonText').textContent.includes('Toy Product'));
  await page.locator('#stockStore').selectOption('zippo');await page.waitForFunction(()=>document.querySelector('.product-row')?.textContent.includes('Zippo Product'));
  assert.equal(await page.locator('#shopeePreview').isHidden(),true);assert.equal(await page.locator('#thaiMartPreview').isHidden(),true);
  assert.equal(await page.locator('.shopee-result').count(),0);assert.equal(await page.locator('.thaimart-result').count(),0);
  assert.match(await page.locator('#stockPage').textContent(),/1208831352314389/);assert.match(await page.locator('#stockCatalog').textContent(),/1018833961115899/);
  assert.match(await page.locator('#stockConnection').textContent(),/ยังไม่ได้ยืนยัน/);assert.match(await page.locator('#feedLink').getAttribute('href'),/store=zippo/);
  await page.locator('#shopeeSearchInput').fill('Zip');await page.waitForSelector('.shopee-result');await page.locator('.shopee-result').click();
  await page.locator('#stockStore').selectOption('toys-center');await page.waitForTimeout(800);
  assert.equal(await page.locator('#shopeePreview').isHidden(),true,'late Zippo preview must not reappear in Toys store');
  assert.equal(await page.locator('.shopee-result').count(),0);assert.match(await page.locator('.product-row').textContent(),/Toy Product/);
  let confirmation='';page.once('dialog',dialog=>{confirmation=dialog.message();dialog.accept()});await page.getByRole('button',{name:'ย้ายไปเพจอื่น'}).click();await page.waitForFunction(()=>!document.querySelector('.product-row'));
  assert.match(confirmation,/Toy Product/);assert.match(confirmation,/Zippo/);assert.equal(moveCalls,1);
  await page.locator('#stockStore').selectOption('zippo');await page.waitForFunction(()=>document.querySelectorAll('.product-row').length===2);
  assert.match(await page.locator('#stockStorefrontLink').getAttribute('href'),/\/zippoudon$/);
  const storefront=await browser.newPage();await storefront.goto(`${base}/zippoudon`);await storefront.waitForSelector('.store-product');assert.equal(await storefront.locator('.store-product').count(),2);assert.match(await storefront.locator('.store-product').last().getAttribute('href'),/^\/zippoudon\?product=toy-product$/);
  await storefront.locator('.store-product').last().click();await storefront.waitForSelector('.store-detail');assert.match(await storefront.locator('.store-back-link').getAttribute('href'),/^\/zippoudon$/);
  await storefront.goto(`${base}/zippo`);await storefront.waitForSelector('.store-product');assert.equal(await storefront.locator('.store-product').count(),2);await storefront.close();
  console.log('Stock move UI, canonical/legacy Zippo storefront, Page status, export clearing, and stale response fence PASS');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
