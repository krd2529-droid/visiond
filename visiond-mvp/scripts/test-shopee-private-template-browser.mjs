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
const item={id:7,store_id:'zippo',meta_id:'ZIP-SHOPEE-001',title:'Zippo collectible product fixture',description:'A sufficiently detailed product description for the Shopee export fixture and its validation.',price:199.5,quantity:1,status:'published',availability:'in stock',image_1_url:'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',updated_at:'2026-10-14',shopee_weight_kg:.5,shopee_package_width_cm:12,shopee_package_length_cm:20,shopee_package_height_cm:8};
const handoff={schema:'visiond.shopee-product-handoff',version:1,product:{visiond_product_id:7,page_1:{images:[{url:'https://fixture.test/cover.png',cover:true}],name:item.title,sku:item.meta_id,gtin:''},page_2:{description:item.description,sales:{price_minor:19950,stock:1},shipping:{weight_g:500,width_mm:120,length_mm:200,height_mm:80}}},validation:{complete:true,missing:[]}};
const posts=[];const send=(res,data)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(data))};
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/admin/toys-center')return send(res,{settings:{storefront_mode:'unlisted',page_name:'Zippo',page_association_status:'verified_in_meta_ui',connection_message:'unverified',public_path:'/zippoudon',feed_path:'/api/stock/feed.csv?store=zippo'},items:url.searchParams.get('store')==='zippo'?[item]:[],pagination:{limit:24,total:1,next_cursor:null},permissions:{can_manage_orders:false}});
  if(url.pathname==='/api/admin/toys-center/shopee-products')return send(res,{items:url.searchParams.get('store')==='zippo'?[item]:[],pagination:{next_cursor:null}});
  if(url.pathname==='/api/admin/toys-center/7/shopee-export')return send(res,handoff);
  if(url.pathname==='/api/admin/toys-center/7/shopee-xlsx'||url.pathname==='/api/admin/toys-center/shopee-xlsx'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks),form=await new Request('https://fixture.test',{method:'POST',headers:{'content-type':req.headers['content-type']},body}).formData();
    assert.equal(url.searchParams.get('store'),'zippo');assert.equal(form.has('template'),false);posts.push({path:url.pathname,mode:form.get('mode'),delivery:form.get('standard_delivery')});
    if(form.get('mode')==='prepare')return send(res,{chunk:{payload:{ids:JSON.parse(form.get('items')).map(value=>value.id)},signature:'fixture'}});
    res.setHeader('content-type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');return res.end(Buffer.from([0x50,0x4b,0x03,0x04]));
  }
  const local=path.resolve(publicRoot,`.${url.pathname==='/'?'/toys-center-admin.html':url.pathname}`);if(!local.startsWith(publicRoot)||!fs.existsSync(local)){res.statusCode=404;return res.end('not found')}
  res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(local)]||'application/octet-stream');res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
  const page=await browser.newPage({viewport,acceptDownloads:true});const errors=[];page.on('pageerror',error=>errors.push(String(error)));await page.goto(`${base}/toys-center-admin.html`);await page.locator('#stockStore').selectOption('zippo');
  assert.equal(await page.locator('#shopeeTemplateFile,#shopeeBatchTemplate').count(),0);
  await page.locator('#shopeeSearchInput').fill('Zippo');await page.locator('.shopee-result').first().click();await page.waitForFunction(()=>document.querySelector('#shopeeJsonText')?.textContent.includes('visiond.shopee-product-handoff'));
  assert.equal(await page.locator('#downloadShopeeXlsx').isDisabled(),true);await page.locator('#shopeeStandardDelivery').selectOption('เปิด');assert.equal(await page.locator('#downloadShopeeXlsx').isEnabled(),true);
  let downloadPromise=page.waitForEvent('download');await page.locator('#downloadShopeeXlsx').click();assert.equal((await downloadPromise).suggestedFilename(),'visiond-shopee-7.xlsx');
  await page.locator('.shopee-batch-add').first().click();await page.locator('#shopeeBatchDelivery').selectOption('เปิด');assert.equal(await page.locator('#shopeeBatchDownload').isEnabled(),true);
  downloadPromise=page.waitForEvent('download');await page.locator('#shopeeBatchDownload').click();assert.equal((await downloadPromise).suggestedFilename(),'visiond-shopee-1-products.xlsx');
  assert.deepEqual(posts.slice(-3).map(value=>value.mode),[null,'prepare','compile']);assert(posts.slice(-3).every(value=>value.path&&value.delivery!=='ปิด'));
  assert.deepEqual(errors,[]);await page.close();
}console.log('PASS Zippo single/batch Shopee export without per-export template picker at desktop/mobile')}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
