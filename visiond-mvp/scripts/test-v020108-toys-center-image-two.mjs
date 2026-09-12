import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
let chromium;
for(const candidate of[process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){
  try{({chromium}=require(candidate));break}catch{}
}
if(!chromium)throw new Error('Playwright Chromium is required for the Toys Center public-image test');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const visionUrl='/api/toys-center/gallery/7/0?v=1';
const item={id:7,meta_id:'TOY-0007',slug:'toy-seven',title:'หุ่นสะสมรุ่น 7',description:'รายละเอียดจริง',availability:'in stock',condition:'used',price:1850,brand:'Vision Toy',quantity:2,visiond_image_urls:[visionUrl],image_1_url:visionUrl,image_2_url:'/api/toys-center/images/7/2',status:'published'};
const imageHits=new Map(),apiHits=[];
const image=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="292" height="436" viewBox="0 0 292 436"><rect width="292" height="436" fill="#0abab5"/></svg>');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/toys-center/products'){
    apiHits.push(url.pathname+url.search);response.setHeader('content-type','application/json');response.setHeader('cache-control','no-store');
    response.end(JSON.stringify(url.searchParams.has('slug')?{item}:{storefront_mode:'public',items:[item],pagination:{page:1,limit:24,total:1}}));return;
  }
  if(url.pathname===new URL(visionUrl,'http://fixture').pathname||url.pathname===item.image_2_url){
    const key=url.pathname===item.image_2_url?item.image_2_url:visionUrl;imageHits.set(key,(imageHits.get(key)||0)+1);response.setHeader('content-type','image/svg+xml');response.setHeader('cache-control','no-store');response.end(image);return;
  }
  const pathname=decodeURIComponent(url.pathname==='/'||url.pathname==='/toyscenter'?'/toyscenter.html':url.pathname),local=path.resolve(publicRoot,`.${pathname}`);
  if(!local.startsWith(publicRoot)||!fs.existsSync(local)){response.statusCode=404;response.end('not found');return}
  response.setHeader('content-type',mime[path.extname(local)]||'application/octet-stream');response.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;

const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  const list=await browser.newPage({viewport:{width:1280,height:900}});await list.goto(`${base}/toyscenter`);await list.waitForFunction(()=>document.querySelector('.store-product img')?.naturalWidth>0);
  assert.equal(await list.locator('.store-product img').count(),1,'list renders exactly one image');
  assert.equal(await list.locator('.store-product img').getAttribute('src'),visionUrl,'list image is primary VisionD image');
  assert.equal(await list.locator('.store-product img').getAttribute('alt'),`${item.title} — รูปสินค้า VisionD 1`,'list alt names the VisionD image');
  assert.equal(await list.locator('.store-product').getAttribute('href'),'/toyscenter?product=toy-seven','semantic detail navigation remains');
  assert.equal(imageHits.get(visionUrl)||0,1,'list requests primary VisionD once');assert.equal(imageHits.get(item.image_2_url)||0,0,'list never requests Meta');

  const detail=await browser.newPage({viewport:{width:1280,height:900}});await detail.goto(`${base}/toyscenter?product=toy-seven`);await detail.waitForFunction(()=>document.querySelector('.store-detail-gallery img')?.naturalWidth>0);
  assert.equal(await detail.locator('.store-detail-gallery img').count(),1,'detail renders exactly one product image');
  assert.equal(await detail.locator('.store-detail-gallery img').getAttribute('src'),visionUrl,'detail image is VisionD source');
  assert.equal(await detail.locator('.store-detail figcaption').textContent(),'รูปสินค้า 1 จาก 1','detail caption is numbered and truthful');
  for(const expected of [item.title,item.description,'1,850.00 บาท','พร้อมขาย','มือสอง',item.brand,'2','กลับไปดูสินค้าทั้งหมด'])assert.ok((await detail.locator('.store-detail').textContent()).includes(expected),expected);
  const desktop=await detail.evaluate(()=>{const gallery=document.querySelector('.store-detail-gallery'),stage=gallery.querySelector('.store-image-stage'),img=stage.querySelector('img'),g=gallery.getBoundingClientRect(),s=stage.getBoundingClientRect(),i=img.getBoundingClientRect();return{galleryWidth:g.width,stageWidth:s.width,stageHeight:s.height,fits:i.left>=s.left&&i.right<=s.right&&i.top>=s.top&&i.bottom<=s.bottom,objectFit:getComputedStyle(img).objectFit,columns:getComputedStyle(gallery).gridTemplateColumns,scrollWidth:document.documentElement.scrollWidth,width:innerWidth}});
  assert.ok(desktop.galleryWidth>400,'gallery uses the intended detail width');assert.ok(desktop.stageWidth>0);assert.equal(desktop.fits,true);assert.equal(desktop.objectFit,'scale-down');assert.equal(desktop.scrollWidth,desktop.width);
  assert.equal(imageHits.get(visionUrl)||0,2,'fresh list and detail pages request VisionD primary');assert.equal(imageHits.get(item.image_2_url)||0,0,'detail never requests Meta');

  const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto(`${base}/toyscenter?product=toy-seven`);await mobile.waitForFunction(()=>document.querySelector('.store-detail-gallery img')?.naturalWidth>0);
  const compact=await mobile.evaluate(()=>{const stage=document.querySelector('.store-image-stage'),img=stage.querySelector('img'),s=stage.getBoundingClientRect(),i=img.getBoundingClientRect();return{imageCount:document.querySelectorAll('.store-detail-gallery img').length,fits:i.left>=s.left&&i.right<=s.right&&i.top>=s.top&&i.bottom<=s.bottom,objectFit:getComputedStyle(img).objectFit,scrollWidth:document.documentElement.scrollWidth,width:innerWidth,pagerHidden:document.querySelector('.pager').hidden}});
  assert.deepEqual(compact,{imageCount:1,fits:true,objectFit:'scale-down',scrollWidth:390,width:390,pagerHidden:true});assert.equal(imageHits.get(item.image_2_url)||0,0,'390px detail does not request Meta');
  assert.deepEqual(apiHits,['/api/toys-center/products?page=1','/api/toys-center/products?slug=toy-seven','/api/toys-center/products?slug=toy-seven'],'list/detail keep one bounded-purpose request each');

  const source=read('public/toyscenter.js'),css=read('public/toys-center.css'),html=read('public/toyscenter.html'),feed=read('functions/api/toys-center/feed.csv.js'),adminHtml=read('public/toys-center-admin.html'),adminJs=read('public/toys-center-admin.js');
  assert.match(source,/visiond_image_urls/);assert.doesNotMatch(source,/image_2_url/,'public renderer has no Meta source path');
  assert.match(css,/\.store-detail-gallery\{[^}]*grid-template-columns:repeat\(2/);assert.match(css,/\.store-image-stage img\{[^}]*object-fit:scale-down/);
  assert.match(html,/toys-center\.css\?v=020114/);assert.match(html,/toyscenter\.js\?v=020114/);assert.match(feed,/mediaUrl\(origin,r\.id,2\)/,'Meta remains on image 2');
  assert.match(adminHtml,/name="image_1"[^>]*multiple/);assert.match(adminHtml,/name="image_2"/);assert.match(adminHtml,/toys-center\.css\?v=020114/);assert.match(adminHtml,/toys-center-admin\.js\?v=020114/);assert.equal((adminHtml.match(/\.heic,\.heif/g)||[]).length,2,'both admin HEIC roles remain');assert.match(adminJs,/form\.image_1/);assert.match(adminJs,/form\.image_2/);
  assert.equal(read('VERSION.txt').trim(),'v0.20.114');assert.match(read('public/index.html'),/WEB v0\.20\.114/);
  console.log('PASS v0.20.108 preservation: public Toys Center requests VisionD primary only and Meta remains image 2');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
