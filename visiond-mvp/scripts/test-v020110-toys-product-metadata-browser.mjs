import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of[process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
if(!chromium)throw new Error('Playwright Chromium is required for the Toys Center product metadata browser test');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const rich={id:7,meta_id:'TOY-META-7',slug:'with-metadata',title:'หุ่นสะสมรุ่น 7',description:'รายละเอียดจริง',availability:'in stock',condition:'used',price:1250,brand:'Vision Toy',product_line:'Transformers Generations',series:'Studio Series',quantity:3,visiond_image_urls:['/images/7/1'],image_1_url:'/images/7/1',image_2_url:'/images/7/2',status:'published'};
const legacy={...rich,id:8,meta_id:'TOY-LEGACY-8',slug:'legacy',title:'สินค้าเดิม',product_line:'',series:'',image_1_url:'/images/8/1',image_2_url:'/images/8/2'};
const hits=[];
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://fixture');hits.push(request.method+' '+url.pathname+url.search);
  if(url.pathname==='/api/toys-center/products'){response.setHeader('content-type','application/json');response.end(JSON.stringify({item:url.searchParams.get('slug')==='legacy'?legacy:rich}));return}
  if(url.pathname==='/api/admin/toys-center'){response.setHeader('content-type','application/json');response.end(JSON.stringify({settings:{storefront_mode:'unlisted'},items:[rich],pagination:{page:1,limit:25,total:1},permissions:{can_manage_orders:false}}));return}
  if(url.pathname==='/api/admin/toys-center/7/images'){response.setHeader('content-type','application/json');response.end(JSON.stringify({items:[{position:0,url:'/images/7/1'}]}));return}
  if(url.pathname.startsWith('/images/')){response.statusCode=204;response.end();return}
  let pathname=url.pathname==='/'?'/toyscenter.html':url.pathname;if(pathname==='/toyscenter')pathname='/toyscenter.html';
  try{const file=path.join(root,pathname);if(!file.startsWith(root))throw new Error('bad path');const body=await fs.readFile(file);response.setHeader('content-type',mime[path.extname(file)]||'application/octet-stream');response.end(body)}catch{response.statusCode=404;response.end('not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(base+'/toyscenter?product=with-metadata');await page.waitForSelector('.store-detail');
  assert.deepEqual(await page.locator('.store-detail-facts dt').allTextContents(),['สภาพสินค้า','แบรนด์','ไลน์สินค้า','ซีรีส์','จำนวน']);assert.match(await page.locator('.store-detail-facts').textContent(),/Transformers Generations/);assert.match(await page.locator('.store-detail-facts').textContent(),/Studio Series/);assert.equal(await page.locator('.store-detail-gallery img').count(),1);assert.equal((await page.locator('.store-detail-gallery img').getAttribute('src')),'/images/7/1');assert.equal(hits.filter(hit=>hit.includes('/api/toys-center/products')).length,1);
  const blank=await browser.newPage({viewport:{width:390,height:844}});await blank.goto(base+'/toyscenter?product=legacy');await blank.waitForSelector('.store-detail');const blankLabels=await blank.locator('.store-detail-facts dt').allTextContents();assert.equal(blankLabels.includes('ไลน์สินค้า'),false);assert.equal(blankLabels.includes('ซีรีส์'),false);assert.equal(await blank.evaluate(()=>document.documentElement.scrollWidth),390);
  const admin=await browser.newPage({viewport:{width:1280,height:900}});await admin.goto(base+'/toys-center-admin.html');await admin.waitForSelector('.product-row');assert.equal(await admin.locator('[name=product_line]').getAttribute('maxlength'),'120');assert.equal(await admin.locator('[name=series]').getAttribute('maxlength'),'120');await admin.getByRole('button',{name:'แก้ไข',exact:true}).click();assert.equal(await admin.locator('[name=product_line]').inputValue(),rich.product_line);assert.equal(await admin.locator('[name=series]').inputValue(),rich.series);await admin.waitForFunction(()=>document.querySelectorAll('#preview1 img').length===1);assert.equal(hits.filter(hit=>hit.startsWith('GET /api/admin/toys-center')).length,2);
  console.log('PASS v0.20.110 installed Chrome optional product line/series public facts and admin edit round-trip');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
