import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium,sharp;
for(const candidate of[process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
for(const candidate of[process.env.SHARP_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp','sharp'].filter(Boolean)){try{sharp=require(candidate);break}catch{}}
if(!chromium||!sharp)throw new Error('Installed Chrome and sharp are required');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public'),limit=5*1024*1024,target=Math.floor(4.75*1024*1024),writes=[];
const width=1700,height=1700,raw=Buffer.allocUnsafe(width*height*4);let seed=0x11420;
for(let index=0;index<raw.length;index++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;raw[index]=seed&255}
const generated={
  JPEG:await sharp(raw,{raw:{width,height,channels:4}}).jpeg({quality:100,chromaSubsampling:'4:4:4'}).toBuffer(),
  PNG:await sharp(raw,{raw:{width,height,channels:4}}).png({compressionLevel:0}).toBuffer(),
  WEBP:await sharp(raw,{raw:{width,height,channels:4}}).webp({lossless:true}).toBuffer()
};
for(const buffer of Object.values(generated))assert.ok(buffer.length>limit);
const heicBase=fs.readFileSync(path.join(root,'scripts','fixtures','toys-center-orientation-6.heic')),freeBytes=limit+4096-heicBase.length,free=Buffer.alloc(freeBytes);free.writeUInt32BE(freeBytes,0);free.write('free',4,'ascii');generated.HEIC=Buffer.concat([heicBase,free]);
const mime={JPEG:'image/jpeg',PNG:'image/png',WEBP:'image/webp',HEIC:'image/heic'},extension={JPEG:'jpg',PNG:'png',WEBP:'webp',HEIC:'heic'},tinyJpeg=await sharp({create:{width:8,height:8,channels:3,background:'#0abab5'}}).jpeg().toBuffer();
const readBody=request=>new Promise((resolve,reject)=>{const chunks=[];request.on('data',chunk=>chunks.push(chunk));request.on('end',()=>resolve(Buffer.concat(chunks)));request.on('error',reject)});
function multipart(body,contentType){const boundary=/boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType)?.slice(1).find(Boolean);assert.ok(boundary);const delimiter=Buffer.from(`--${boundary}`),parts=[];let cursor=0;while((cursor=body.indexOf(delimiter,cursor))!==-1){cursor+=delimiter.length;if(body.subarray(cursor,cursor+2).toString()==='--')break;cursor+=2;const headerEnd=body.indexOf(Buffer.from('\r\n\r\n'),cursor);if(headerEnd<0)break;const headers=body.subarray(cursor,headerEnd).toString();let bodyEnd=body.indexOf(delimiter,headerEnd+4);if(bodyEnd<0)break;bodyEnd-=2;parts.push({field:/name="([^"]+)"/.exec(headers)?.[1],filename:/filename="([^"]+)"/.exec(headers)?.[1],type:/content-type:\s*([^\r\n]+)/i.exec(headers)?.[1],body:body.subarray(headerEnd+4,bodyEnd)});cursor=bodyEnd}return parts}
const server=http.createServer(async(request,response)=>{const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/admin/toys-center'&&request.method==='GET'){response.setHeader('content-type','application/json');response.end(JSON.stringify({settings:{storefront_mode:'unlisted'},items:[],pagination:{page:1,limit:25,total:0},permissions:{can_manage_orders:false}}));return}
  if(url.pathname.startsWith('/api/admin/toys-center')&&request.method==='POST'){const body=await readBody(request);writes.push({path:url.pathname,parts:multipart(body,request.headers['content-type'])});response.setHeader('content-type','application/json');response.end(JSON.stringify(url.pathname.endsWith('/ai-fill')?{fields:{title:'สินค้าทดสอบ',description:'รายละเอียด',brand:'VisionD'},message:'AI ช่วยกรอกแล้ว กรุณาตรวจข้อมูลก่อนบันทึก'}:{ok:true,id:1,message:'เพิ่มสินค้า Toys Center สำเร็จ'}));return}
  const relative=url.pathname==='/'?'/toys-center-admin.html':url.pathname,local=path.resolve(publicRoot,`.${relative}`);if(!local.startsWith(publicRoot)||!fs.existsSync(local)){response.statusCode=404;response.end('not found');return}const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm'};response.setHeader('content-type',types[path.extname(local)]||'application/octet-stream');response.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),results=[];
try{
  for(const [kind,buffer] of Object.entries(generated)){
    const page=await browser.newPage({viewport:{width:1280,height:900}});await page.goto(`${base}/toys-center-admin.html`);await page.waitForSelector('#productForm');
    await page.locator('[name=image_1]').setInputFiles({name:`oversized.${extension[kind]}`,mimeType:mime[kind],buffer});
    await page.waitForFunction(()=>document.querySelector('#preview1 img')?.naturalWidth>0,{timeout:60000});
    const status=await page.locator('#formStatus').textContent();assert.match(status,/ปรับรูป VisionD 1 รูปแล้ว/);assert.match(status,/MB\s*→\s*.+MB/);
    const preview=await page.locator('#preview1 img').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
    await page.locator('[name=image_2]').setInputFiles({name:'meta.jpg',mimeType:'image/jpeg',buffer:tinyJpeg});await page.waitForFunction(()=>document.querySelector('#preview2').naturalWidth>0);await page.fill('[name=meta_id]',`V114-${kind}`);await page.fill('[name=title]',`Oversized ${kind}`);await page.fill('[name=description]','รายละเอียด');await page.fill('[name=price]','100');await page.fill('[name=brand]','VisionD');
    const beforeAi=writes.length;await page.click('#aiFillProduct');await page.waitForFunction(()=>document.querySelector('#formStatus').textContent.includes('AI ช่วยกรอกแล้ว'));assert.equal(writes.length,beforeAi+1);const ai=writes.at(-1),aiImage=ai.parts.find(part=>part.field==='image_1');assert.ok(aiImage);
    const beforeSave=writes.length;await Promise.all([page.waitForResponse(response=>response.url().endsWith('/api/admin/toys-center')&&response.request().method()==='POST'),page.click('#saveProduct')]);await page.waitForFunction(()=>document.querySelector('#formStatus').textContent.includes('สำเร็จ'));assert.equal(writes.length,beforeSave+1);const save=writes.at(-1),saveImage=save.parts.find(part=>part.field==='image_1');assert.ok(saveImage);
    assert.equal(aiImage.filename,saveImage.filename);assert.equal(aiImage.type,saveImage.type);assert.deepEqual(aiImage.body,saveImage.body,'preview cache supplies one exact normalized payload to AI and save');assert.ok(saveImage.body.length<=target);assert.equal(save.parts.find(part=>part.field==='visiond_cover_index')?.body.toString(),'0');
    const expectedType=kind==='HEIC'?'image/jpeg':mime[kind],expectedMagic=expectedType==='image/jpeg'?'ffd8ff':expectedType==='image/png'?'89504e470d0a1a0a':'52494646';assert.equal(saveImage.type,expectedType);assert.equal(saveImage.body.subarray(0,expectedMagic.length/2).toString('hex'),expectedMagic);
    const metadata=await sharp(saveImage.body).metadata();assert.ok(metadata.width<=2560&&metadata.height<=2560);assert.ok(metadata.width<=width&&metadata.height<=height||kind==='HEIC');
    if(kind==='HEIC')assert.deepEqual([metadata.width,metadata.height],[480,640],'orientation-6 HEIC is displayed once without double rotation');
    else assert.ok(Math.abs(metadata.width/metadata.height-1)<.01,'standard image aspect is preserved');
    if(kind==='PNG'||kind==='WEBP'){const stats=await sharp(saveImage.body).ensureAlpha().stats();assert.ok(stats.channels[3].min<255,`${kind} transparency is retained`)}
    results.push({kind,sourceBytes:buffer.length,outputBytes:saveImage.body.length,preview,output:[metadata.width,metadata.height]});await page.close();
  }
  const coverPage=await browser.newPage({viewport:{width:1280,height:900}});await coverPage.goto(`${base}/toys-center-admin.html`);
  await coverPage.locator('[name=image_1]').setInputFiles(['JPEG','PNG','WEBP'].map(kind=>({name:`cover-${kind.toLowerCase()}.${extension[kind]}`,mimeType:mime[kind],buffer:generated[kind]})));
  await coverPage.waitForFunction(()=>document.querySelectorAll('#preview1 .visiond-cover-choice').length===3&&[...document.querySelectorAll('#preview1 img')].every(image=>image.naturalWidth>0),{timeout:60000});
  const choices=coverPage.locator('#preview1 .visiond-cover-choice');assert.equal(await choices.count(),3,'every normalized left thumbnail is decorated as a cover choice');assert.deepEqual(await choices.evaluateAll(nodes=>nodes.map(node=>node.tagName)),['BUTTON','BUTTON','BUTTON']);assert.equal(await coverPage.locator('#preview1 .visiond-cover-choice[aria-pressed="true"]').count(),1);assert.equal(await coverPage.locator('[name=visiond_cover_index]').inputValue(),'0');
  await choices.nth(2).click();assert.equal(await coverPage.locator('#preview1 .visiond-cover-choice[aria-pressed="true"]').count(),1);assert.equal(await choices.nth(2).getAttribute('aria-pressed'),'true');assert.equal(await coverPage.locator('[name=visiond_cover_index]').inputValue(),'2');
  await coverPage.locator('[name=image_2]').setInputFiles({name:'meta.jpg',mimeType:'image/jpeg',buffer:tinyJpeg});await coverPage.waitForFunction(()=>document.querySelector('#preview2').naturalWidth>0);await coverPage.fill('[name=meta_id]','V114-COVER');await coverPage.fill('[name=title]','Oversized cover');await coverPage.fill('[name=description]','รายละเอียด');await coverPage.fill('[name=price]','100');await coverPage.fill('[name=brand]','VisionD');
  await Promise.all([coverPage.waitForResponse(response=>response.url().endsWith('/ai-fill')&&response.request().method()==='POST'),coverPage.click('#aiFillProduct')]);const coverAi=writes.at(-1),coverAiImage=coverAi.parts.find(part=>part.field==='image_1');
  await Promise.all([coverPage.waitForResponse(response=>response.url().endsWith('/api/admin/toys-center')&&response.request().method()==='POST'),coverPage.click('#saveProduct')]);const coverSave=writes.at(-1),coverSavedImages=coverSave.parts.filter(part=>part.field==='image_1');assert.equal(coverSavedImages.length,3);assert.deepEqual(coverSavedImages.map(part=>part.filename),['cover-jpeg.jpg','cover-png.png','cover-webp.webp']);assert.equal(coverSave.parts.find(part=>part.field==='visiond_cover_index')?.body.toString(),'2','selected normalized thumbnail drives the server-authoritative catalog cover index');assert.deepEqual(coverAiImage.body,coverSavedImages[2].body,'selected normalized thumbnail drives AI and save with the exact cached bytes');await coverPage.close();
  const page=await browser.newPage();await page.goto(`${base}/toys-center-admin.html`);const queue=await page.evaluate(async()=>{
    const module=await import('/toys-center-image.js?v=020114'),header=new Uint8Array([0xff,0xd8,0xff,0xe0]),make=name=>{const file=new File([header],name,{type:'image/jpeg'});Object.defineProperty(file,'size',{value:5*1024*1024+1});return file};let active=0,peak=0;
    const pipeline=module.createToyImagePipeline({decodeImage:async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,20));active--;return{source:{},width:1200,height:800,close(){}}},encodeImage:async()=>new Blob([header],{type:'image/jpeg'})});
    const names=Array.from({length:10},(_,index)=>`ordered-${index}.jpg`),files=names.map(make),resolved=await pipeline.selectFiles('image_1',files);
    let release,started=[];const gate=new Promise(resolve=>{release=resolve}),stale=module.createToyImagePipeline({decodeImage:async blob=>{started.push(blob.name);if(started.length<=2)await gate;return{source:{},width:1200,height:800,close(){}}},encodeImage:async()=>new Blob([header],{type:'image/jpeg'})}),old=Array.from({length:10},(_,index)=>make(`stale-${index}.jpg`)),pending=stale.selectFiles('image_1',old).catch(()=>null);
    while(started.length<2)await new Promise(resolve=>setTimeout(resolve,1));const replacement=make('replacement.jpg'),next=stale.selectFiles('image_1',[replacement]);release();await pending;await next;
    return{peak,names:resolved.map(file=>file.name),started:started.sort()};
  });
  assert.equal(queue.peak,2);assert.deepEqual(queue.names,Array.from({length:10},(_,index)=>`ordered-${index}.jpg`));assert.deepEqual(queue.started,['replacement.jpg','stale-0.jpg','stale-1.jpg'].sort());
  const corrupt=Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),Buffer.alloc(limit)]),beforeFailure=writes.length;
  await page.locator('[name=image_1]').setInputFiles({name:'disguised.jpg',mimeType:'image/jpeg',buffer:corrupt});await page.waitForFunction(()=>document.querySelector('#formStatus').textContent.includes('ไฟล์ไม่ตรงกับชนิด'));
  await page.click('#aiFillProduct');await page.click('#saveProduct');await page.waitForTimeout(100);assert.equal(writes.length,beforeFailure,'invalid oversized input sends zero AI/save request');assert.match(await page.locator('#formStatus').textContent(),/ไฟล์ไม่ตรงกับชนิด/);await page.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}

console.log('PASS v0.20.114 installed Chrome genuine oversized JPEG/PNG/WEBP/HEIC orientation, alpha, exact AI/save cache, cover, concurrency2, stale queue and zero-request failure');
console.log(JSON.stringify(results));
