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
if(!chromium)throw new Error('Playwright Chromium is required for the real-HEIC browser test');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public');
const fixture=name=>fs.readFileSync(path.join(root,'scripts','fixtures',name));
const requests=[],staticHits=new Map();
const item={id:1,meta_id:'TOY-BROWSER-HEIC',slug:'toy-browser-heic',title:'ของสะสม',description:'รายละเอียด',availability:'in stock',condition:'used',price:100,quantity:1,brand:'VisionD',status:'draft',google_product_category:'',fb_product_category:'',gtin:'',item_group_id:'',gender:'',color:'',size:'',age_group:'',material:'',pattern:'',product_tags:'[]',image_1_url:'/missing-1.jpg',image_2_url:'/missing-2.jpg'};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.heic':'image/heic'};
const csp="default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; script-src 'self'; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'";
const readBody=request=>new Promise((resolve,reject)=>{const chunks=[];request.on('data',chunk=>chunks.push(chunk));request.on('end',()=>resolve(Buffer.concat(chunks)));request.on('error',reject)});
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/admin/toys-center'&&request.method==='GET'){
    response.setHeader('content-type','application/json');response.end(JSON.stringify({settings:{storefront_mode:'unlisted'},items:[item],pagination:{page:1,limit:25,total:1}}));return;
  }
  if(url.pathname.startsWith('/api/admin/toys-center')&&['POST','PUT'].includes(request.method)){
    requests.push({path:url.pathname,method:request.method,headers:request.headers,body:await readBody(request)});response.setHeader('content-type','application/json');
    response.end(JSON.stringify(url.pathname.endsWith('/ai-fill')?{ok:true,fields:{title:'ของสะสม',description:'รายละเอียด',brand:'VisionD'},message:'AI ช่วยกรอกแล้ว กรุณาตรวจข้อมูลก่อนบันทึก'}:{ok:true,id:1,message:request.method==='PUT'?'แก้ไขสินค้า Toys Center สำเร็จ':'เพิ่มสินค้า Toys Center สำเร็จ'}));return;
  }
  let pathname=decodeURIComponent(url.pathname==='/'?'/toys-center-admin.html':url.pathname);
  const local=path.resolve(publicRoot,`.${pathname}`);
  if(!local.startsWith(publicRoot)||!fs.existsSync(local)){response.statusCode=404;response.end('not found');return}
  staticHits.set(pathname,(staticHits.get(pathname)||0)+1);response.setHeader('content-type',mime[path.extname(local)]||'application/octet-stream');response.setHeader('content-security-policy',csp);response.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;

function multipartImages(entry){
  const boundary=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(entry.headers['content-type'])?.slice(1).find(Boolean);assert.ok(boundary);
  const delimiter=Buffer.from(`--${boundary}`),parts=[];let cursor=0;
  while((cursor=entry.body.indexOf(delimiter,cursor))!==-1){cursor+=delimiter.length;if(entry.body.subarray(cursor,cursor+2).toString()==='--')break;cursor+=2;const headerEnd=entry.body.indexOf(Buffer.from('\r\n\r\n'),cursor);if(headerEnd<0)break;const headers=entry.body.subarray(cursor,headerEnd).toString();let bodyEnd=entry.body.indexOf(delimiter,headerEnd+4);if(bodyEnd<0)break;bodyEnd-=2;const field=/name="([^"]+)"/.exec(headers)?.[1],filename=/filename="([^"]+)"/.exec(headers)?.[1];if(filename)parts.push({field,filename,type:/content-type:\s*([^\r\n]+)/i.exec(headers)?.[1],body:entry.body.subarray(headerEnd+4,bodyEnd)});cursor=bodyEnd;
  }
  return parts;
}

const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(`${base}/toys-center-admin.html`);await page.waitForFunction(()=>document.querySelector('#listStatus').textContent!=='กำลังโหลด…');
  assert.equal(staticHits.get('/vendor/heic-to/heic-to-1.5.2-csp.js'),undefined,'decoder must remain lazy before HEIC selection');
  const accepts=await page.$$eval('input[type=file]',nodes=>nodes.map(node=>node.accept));assert.equal(accepts.length,2);for(const accept of accepts){assert.match(accept,/\.heic/);assert.match(accept,/\.heif/);assert.match(accept,/image\/heic/);assert.match(accept,/image\/heif/)}

  await page.locator('[name=image_1]').setInputFiles({name:'iPhone.HEIC',mimeType:'image/heic',buffer:fixture('toys-center-libheif-example.heic')});
  await page.waitForFunction(()=>document.querySelector('#preview1').naturalWidth>0);
  assert.deepEqual(await page.$eval('#preview1',img=>({width:img.naturalWidth,height:img.naturalHeight,hidden:img.hidden})),{width:1280,height:854,hidden:false});
  await page.locator('[name=image_2]').setInputFiles({name:'portrait.HEIF',mimeType:'image/heif',buffer:fixture('toys-center-orientation-6.heic')});
  await page.waitForFunction(()=>document.querySelector('#preview2').naturalWidth>0);
  assert.deepEqual(await page.$eval('#preview2',img=>({width:img.naturalWidth,height:img.naturalHeight,hidden:img.hidden})),{width:480,height:640,hidden:false});
  assert.equal(staticHits.get('/vendor/heic-to/heic-to-1.5.2-csp.js'),1,'one locally served decoder module must serve both slots');

  await page.click('#aiFillProduct');await page.waitForFunction(()=>document.querySelector('#formStatus').textContent.includes('AI ช่วยกรอกแล้ว'));assert.equal(requests.length,1);
  await page.fill('[name=meta_id]','TOY-BROWSER-HEIC');await page.fill('[name=price]','100');await page.click('#saveProduct');await page.waitForFunction(()=>document.querySelector('#formStatus').textContent.includes('เพิ่มสินค้า Toys Center สำเร็จ'));assert.equal(requests.length,2);
  for(const entry of requests){const images=multipartImages(entry);assert.equal(images.length,2);for(const image of images){assert.match(image.filename,/\.jpg$/i);assert.equal(image.type,'image/jpeg');assert.deepEqual([...image.body.subarray(0,3)],[0xff,0xd8,0xff]);assert.ok(image.body.length<=5*1024*1024)}}

  await page.click('.product-row button');await page.locator('[name=image_1]').setInputFiles({name:'update.HEIF',mimeType:'image/heif',buffer:fixture('toys-center-orientation-6.heic')});await page.waitForFunction(()=>document.querySelector('#preview1').naturalWidth===480);await page.click('#saveProduct');await page.waitForFunction(()=>document.querySelector('#formStatus').textContent.includes('แก้ไขสินค้า Toys Center สำเร็จ'));assert.equal(requests.length,3);assert.equal(requests[2].method,'PUT');assert.equal(requests[2].path,'/api/admin/toys-center/1');const updateImages=multipartImages(requests[2]);assert.equal(updateImages.length,1);assert.equal(updateImages[0].field,'image_1');assert.match(updateImages[0].filename,/\.jpg$/i);assert.deepEqual([...updateImages[0].body.subarray(0,3)],[0xff,0xd8,0xff]);

  const successfulCount=requests.length;
  await page.locator('[name=image_1]').setInputFiles({name:'broken.HEIC',mimeType:'image/heic',buffer:Buffer.from('not a heic')});
  await page.locator('[name=image_2]').setInputFiles({name:'keep.jpg',mimeType:'image/jpeg',buffer:Buffer.from([0xff,0xd8,0xff,0xd9])});
  await page.waitForFunction(()=>document.querySelector('#formStatus').textContent.includes('แปลงรูป 1')&&document.querySelector('#formStatus').textContent.includes('ไม่สำเร็จ'));
  await page.click('#aiFillProduct');await page.waitForTimeout(250);assert.equal(requests.length,successfulCount);assert.match(await page.textContent('#formStatus'),/แปลงรูป 1.*ไม่สำเร็จ/);
  await page.fill('[name=meta_id]','TOY-BROKEN');await page.fill('[name=title]','สินค้า');await page.fill('[name=description]','รายละเอียด');await page.fill('[name=price]','100');await page.fill('[name=brand]','VisionD');await page.click('#saveProduct');await page.waitForTimeout(250);assert.equal(requests.length,successfulCount);assert.match(await page.textContent('#formStatus'),/แปลงรูป 1.*ไม่สำเร็จ/);

  const mobile=await browser.newPage({viewport:{width:390,height:844}});await mobile.goto(`${base}/toys-center-admin.html`);await mobile.waitForSelector('#productForm');const layout=await mobile.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,width:innerWidth,inputs:[...document.querySelectorAll('input[type=file]')].map(node=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width}}),ai:document.querySelector('#aiFillProduct').getBoundingClientRect().width,save:document.querySelector('#saveProduct').getBoundingClientRect().width}));assert.equal(layout.scrollWidth,390);assert.equal(layout.width,390);for(const inputBox of layout.inputs){assert.ok(inputBox.left>=0);assert.ok(inputBox.right<=390);assert.ok(inputBox.width>0)}assert.ok(layout.ai>0);assert.ok(layout.save>0);await mobile.close();
  console.log('PASS v0.20.107 real HEIC + orientation Chromium preview, local lazy decoder, JPEG AI/save substitution, corrupt no-request and 390px usability');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
