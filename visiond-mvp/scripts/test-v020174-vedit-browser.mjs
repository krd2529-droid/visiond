import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {inspectVeditZip} from '../public/vedit-zip.js';

const require=createRequire(import.meta.url);
let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){
  try{({chromium}=require(candidate));break}catch{}
}
assert.ok(chromium,'installed Chrome required');

const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const read=name=>fs.readFileSync(path.join(publicRoot,name),'utf8');
const shared=read('shared-nav.js'),home=read('index.html'),html=read('vedit.html'),client=read('vedit.js');
const expectedConsumers=['about.html','blog.html','bots.html','contact.html','course-center.html','course-seller.html','course.html','courses.html','digital-products.html','guides.html','index.html','my-courses.html','privacy.html','terms.html','vedit.html','vpage.html'].sort();
const consumers=fs.readdirSync(publicRoot).filter(name=>name.endsWith('.html')&&read(name).includes('shared-nav.js?v=')).sort();
assert.deepEqual(consumers,expectedConsumers,'every canonical nav consumer is enumerated');
for(const name of consumers){
  const source=read(name);
  assert.equal((source.match(/shared-nav\.js\?v=020174/g)||[]).length,1,`${name} loads cache key 020174 once`);
  assert.doesNotMatch(source,/shared-nav\.js\?v=020(?:57|173)/,`${name} has no stale cache key`);
}
assert.equal((shared.match(/'nav-vedit-link','\/vedit','Vedit'/g)||[]).length,1,'canonical nav has exactly one Vedit entry');
assert.match(shared,/\/vpage','Vpage'\],\['nav-vedit-link','\/vedit','Vedit'\],\['','\/courses\.html'/,'Vedit is after Vpage and before V-Learning');
assert.match(home,/class="nav-vpage-link" href="\/vpage">Vpage<\/a>[\s\S]*?class="nav-vedit-link" href="\/vedit">Vedit<\/a>[\s\S]*?href="\/courses\.html">ระบบ V-Learning<\/a>/,'home first paint has the same Vedit order');
assert.match(html,/id="veditImage"[^>]+accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(html,/vedit\.css\?v=020175[\s\S]*mobile-storefront\.css[\s\S]*header-shell\.css[\s\S]*frontend-theme\.css/,'stylesheet cascade follows the public header contract');
assert.match(html,/vedit\.js\?v=020175[\s\S]*shared-nav\.js\?v=020174/);
assert.doesNotMatch(client,/\bfetch\s*\(|localStorage|sessionStorage|\/api\/|vpage|credit|D1|R2/i,'composer has no API, storage, Vpage or credit coupling');
assert.match(client,/MIME_SIGNATURES/);
assert.match(client,/selectionGeneration/);
assert.match(client,/Intl\?\.Segmenter/);
assert.match(client,/canvas\.toBlob/);

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const requestLog=[];
let navProbePending=true;
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  requestLog.push({method:request.method,path:url.pathname,length:Number(request.headers['content-length']||0)});
  if(url.pathname.startsWith('/api/')){
    const payload=url.pathname==='/api/auth/me'?{user:null}:{items:[],products:[],courses:[]};
    response.writeHead(200,{'content-type':'application/json','cache-control':'private, no-store'});response.end(JSON.stringify(payload));return;
  }
  if(url.pathname==='/vedit'&&navProbePending){navProbePending=false;response.writeHead(200,{'content-type':'text/html; charset=utf-8'});response.end('<!doctype html><html lang="th"><title>Vedit navigation destination</title><main>Vedit</main></html>');return}
  const pathname=['/','/index.html'].includes(url.pathname)?'/index.html':['/vedit','/vedit.html'].includes(url.pathname)?'/vedit.html':url.pathname;
  const local=path.resolve(publicRoot,`.${pathname}`),relative=path.relative(publicRoot,local);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(local)){response.writeHead(404,{'content-type':'text/plain'});response.end('not found');return}
  response.writeHead(200,{'content-type':types[path.extname(local)]||'application/octet-stream'});response.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});

async function imageFixture(page,width,height,type='image/png'){
  const dataUrl=await page.evaluate(({width,height,type})=>{
    const fixture=document.createElement('canvas');fixture.width=width;fixture.height=height;const ctx=fixture.getContext('2d');ctx.fillStyle='#24855f';ctx.fillRect(0,0,width,height);ctx.fillStyle='#58a6ff';ctx.fillRect(width/2,0,width/2,height);return fixture.toDataURL(type,.9);
  },{width,height,type});
  return Buffer.from(dataUrl.split(',')[1],'base64');
}
function inputZip(entries){
  const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
  const crc32=bytes=>{let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0};
  const local=[],central=[];let offset=0,size=0;
  for(const item of entries){const data=Buffer.from(item.bytes),name=Buffer.from(item.name),head=Buffer.alloc(30+name.length),h=new DataView(head.buffer,head.byteOffset,head.byteLength),crc=crc32(data);h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);name.copy(head,30);local.push(head,data);const dir=Buffer.alloc(46+name.length),d=new DataView(dir.buffer,dir.byteOffset,dir.byteLength);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x0800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);name.copy(dir,46);central.push(dir);offset+=head.length+data.length;size+=dir.length}
  const end=Buffer.alloc(22),e=new DataView(end.buffer,end.byteOffset,end.byteLength);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);return Buffer.concat([...local,...central,end]);
}

try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    navProbePending=true;
    const context=await browser.newContext({viewport,locale:'th-TH',acceptDownloads:true});
    await context.addInitScript(()=>{
      globalThis.__veditAudit={decoded:[],closed:[],createdUrls:[],revokedUrls:[],slowStarted:false};
      const nativeCreateImageBitmap=globalThis.createImageBitmap.bind(globalThis),nativeClose=globalThis.ImageBitmap?.prototype?.close,nativeCreateUrl=URL.createObjectURL.bind(URL),nativeRevokeUrl=URL.revokeObjectURL.bind(URL);
      globalThis.createImageBitmap=async(...args)=>{
        const bitmap=await nativeCreateImageBitmap(...args),source=args[0],name=source?.name||'';
        globalThis.__veditAudit.decoded.push({name,width:bitmap.width,height:bitmap.height});
        if(name==='slow-a.png'){globalThis.__veditAudit.slowStarted=true;await new Promise(resolve=>setTimeout(resolve,250))}
        return bitmap;
      };
      if(nativeClose)globalThis.ImageBitmap.prototype.close=function(){globalThis.__veditAudit.closed.push({width:this.width,height:this.height});return nativeClose.call(this)};
      URL.createObjectURL=value=>{const url=nativeCreateUrl(value);globalThis.__veditAudit.createdUrls.push(url);return url};
      URL.revokeObjectURL=url=>{globalThis.__veditAudit.revokedUrls.push(url);return nativeRevokeUrl(url)};
    });
    await context.route('https://**/*',route=>route.fulfill({status:204,body:''}));
    const page=await context.newPage(),errors=[],failed=[],bad=[];let committedVeditAbort=0;
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    page.on('requestfailed',request=>{const error=request.failure()?.errorText||'unknown';if(request.isNavigationRequest()&&request.url()===`${base}/vedit`&&error==='net::ERR_ABORTED'){committedVeditAbort+=1;return}if(request.url().startsWith(base))failed.push(`${request.url()} ${error}`)});
    page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)bad.push(`${response.status()} ${response.url()}`)});

    await page.goto(base);
    await page.locator('.topbar.header-shell-ready.mobile-nav-ready').waitFor({state:'attached'});
    await page.locator('.topbar nav[data-account-ready="1"]').waitFor({state:'attached'});
    const homeEntry=page.locator('.topbar .nav-vedit-link');
    assert.equal(await homeEntry.count(),1,'home has one Vedit entry');
    if(viewport.width<=800){const toggle=page.locator('.mobile-nav-toggle');await toggle.click();await homeEntry.waitFor({state:'visible'})}
    await homeEntry.click({noWaitAfter:true});
    await page.waitForFunction(()=>location.pathname==='/vedit'&&document.title==='Vedit navigation destination');
    await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname,'/vedit','real nav click reaches Vedit');
    await page.goto(`${base}/vedit?runtime=1`);

    for(const route of ['/vedit','/vedit.html']){
      if(new URL(page.url()).pathname!==route)await page.goto(`${base}${route}`);
      await page.locator('.topbar.header-shell-ready.mobile-nav-ready').waitFor({state:'attached'});
      await page.locator('.topbar nav[data-account-ready="1"]').waitFor({state:'attached'});
      const current=page.locator('.topbar .nav-vedit-link');
      assert.equal(await current.count(),1,`${route} has one Vedit entry`);
      assert.equal(await current.getAttribute('aria-current'),'page',`${route} marks Vedit current`);
      assert.deepEqual(await page.locator('.topbar>nav>a').evaluateAll(nodes=>nodes.slice(0,5).map(node=>new URL(node.href).pathname.replace(/\.html$/,''))),['/','/digital-products','/course-center','/vpage','/vedit']);
      for(const selector of ['#navLogin','#navRegister','.cart-nav','.vd-language-switcher'])assert.equal(await page.locator(`.topbar ${selector}`).count(),1,`${selector} is not duplicated`);
      if(viewport.width<=800){
        const toggle=page.locator('.mobile-nav-toggle');
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        await toggle.click();
        await current.waitFor({state:'visible'});
        assert.equal(await toggle.getAttribute('aria-expanded'),'true');
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>document.querySelector('.mobile-nav-toggle')?.getAttribute('aria-expanded')==='false');
      }else assert.equal(await current.isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,'route has no horizontal overflow');
    }

    const file=page.locator('#veditImage'),canvas=page.locator('#veditCanvas'),button=page.locator('#veditDownload'),status=page.locator('#veditStatus');
    assert.equal(await canvas.isHidden(),true,'preview starts empty');assert.equal(await button.isDisabled(),true,'download starts disabled');
    await file.setInputFiles({name:'not-image.txt',mimeType:'text/plain',buffer:Buffer.from('not image')});
    await assert.rejects(()=>button.click({timeout:250}));assert.match(await status.textContent(),/JPG|PNG|WebP/);assert.equal(await canvas.isHidden(),true);
    await file.setInputFiles({name:'spoof.png',mimeType:'image/png',buffer:Buffer.from('not a png')});
    await status.waitFor({state:'visible'});assert.match(await status.textContent(),/ชนิดไฟล์ไม่ตรง/);assert.equal(await canvas.isHidden(),true);
    const oversized=Buffer.alloc(20*1024*1024+1);oversized.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    await file.setInputFiles({name:'huge.png',mimeType:'image/png',buffer:oversized});assert.match(await status.textContent(),/20 MB/);assert.equal(await canvas.isHidden(),true);
    const tooSmall=await imageFixture(page,100,100);
    await file.setInputFiles({name:'small.png',mimeType:'image/png',buffer:tooSmall});await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='error');assert.match(await status.textContent(),/320×320/);

    if(viewport.width===1440){
      const slowA=await imageFixture(page,640,640),fastB=await imageFixture(page,800,600);
      await file.setInputFiles({name:'slow-a.png',mimeType:'image/png',buffer:slowA});
      await page.waitForFunction(()=>globalThis.__veditAudit.slowStarted===true);
      await file.setInputFiles({name:'fast-b.png',mimeType:'image/png',buffer:fastB});
      await page.waitForFunction(()=>document.querySelector('#veditCanvas').width===800&&document.querySelector('#veditCanvas').height===600&&document.querySelector('#veditDownload').disabled===false);
      await page.waitForFunction(()=>globalThis.__veditAudit.closed.some(item=>item.width===640&&item.height===640));
      assert.equal(await canvas.getAttribute('data-source-width'),'800','fast B wins the overlapping decode race');
      const overEdge=await imageFixture(page,12001,320);
      await file.setInputFiles({name:'over-edge.png',mimeType:'image/png',buffer:overEdge});
      await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='error'&&globalThis.__veditAudit.closed.some(item=>item.width===12001&&item.height===320));
      assert.match(await status.textContent(),/12,000/,'12,001px source is rejected');
      const cleanup=await page.evaluate(()=>globalThis.__veditAudit.closed);
      assert.ok(cleanup.some(item=>item.width===640&&item.height===640),'stale slow A bitmap is closed');
      assert.ok(cleanup.some(item=>item.width===800&&item.height===600),'replaced current B bitmap is closed');
      assert.ok(cleanup.some(item=>item.width===12001&&item.height===320),'decoded over-limit bitmap is closed');
    }

    const png=await imageFixture(page,1200,800);
    await file.setInputFiles({name:'สินค้า ทดลอง.png',mimeType:'image/png',buffer:png});await canvas.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#veditDownload').disabled);
    assert.deepEqual(await canvas.evaluate(node=>({width:node.width,height:node.height,sourceWidth:node.dataset.sourceWidth,sourceHeight:node.dataset.sourceHeight})),{width:1200,height:800,sourceWidth:'1200',sourceHeight:'800'});
    await page.locator('#veditProductName').fill('สินค้าไทยดีมาก'.repeat(14));await page.locator('#veditPriceText').fill('ราคาโปรพิเศษสุดคุ้ม'.repeat(8));
    const geometry=await canvas.evaluate(node=>{const ctx=node.getContext('2d'),badgeX=Number(node.dataset.badgeX),badgeY=Number(node.dataset.badgeY);return{topLines:Number(node.dataset.topLines),badgeLines:Number(node.dataset.badgeLines),top:[...ctx.getImageData(1,1,1,1).data],badge:[...ctx.getImageData(badgeX+1,badgeY+1,1,1).data],badgeInside:badgeX>=0&&badgeY>=0&&badgeX+Number(node.dataset.badgeWidth)<=node.width&&badgeY+Number(node.dataset.badgeHeight)<=node.height}});
    assert.ok(geometry.topLines>=1&&geometry.topLines<=3);assert.ok(geometry.badgeLines>=1&&geometry.badgeLines<=3);assert.deepEqual(geometry.top.slice(0,3),[181,18,27]);assert.deepEqual(geometry.badge.slice(0,3),[181,18,27]);assert.equal(geometry.badgeInside,true);
    await page.locator('#veditProductName').fill('');assert.equal(await button.isDisabled(),true,'blank required text disables export');await page.locator('#veditProductName').fill('ชื่อสินค้าใหม่');assert.equal(await button.isEnabled(),true);
    await page.locator('#veditProductName').focus();assert.equal(await page.evaluate(()=>document.activeElement?.id),'veditProductName','text editor is keyboard focusable');

    if(viewport.width===1440){
      const previewPixels=await canvas.evaluate(node=>{const ctx=node.getContext('2d'),badgeX=Number(node.dataset.badgeX),badgeY=Number(node.dataset.badgeY);return{top:[...ctx.getImageData(1,1,1,1).data],badge:[...ctx.getImageData(badgeX+1,badgeY+1,1,1).data],image:[...ctx.getImageData(100,500,1,1).data],badgeX,badgeY}});
      const downloadPromise=page.waitForEvent('download');await button.click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/-vedit\.png$/);const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const output=Buffer.concat(chunks);assert.deepEqual([...output.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(output.readUInt32BE(16),1200);assert.equal(output.readUInt32BE(20),800);
      const exportedPixels=await page.evaluate(async({encoded,badgeX,badgeY})=>{const bytes=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),copy=document.createElement('canvas');copy.width=bitmap.width;copy.height=bitmap.height;const ctx=copy.getContext('2d');ctx.drawImage(bitmap,0,0);const pixels={top:[...ctx.getImageData(1,1,1,1).data],badge:[...ctx.getImageData(badgeX+1,badgeY+1,1,1).data],image:[...ctx.getImageData(100,500,1,1).data]};bitmap.close();return pixels},{encoded:output.toString('base64'),badgeX:previewPixels.badgeX,badgeY:previewPixels.badgeY});
      assert.deepEqual(exportedPixels.top,previewPixels.top,'export top-bar pixel matches preview');assert.deepEqual(exportedPixels.badge,previewPixels.badge,'export badge pixel matches preview');assert.deepEqual(exportedPixels.image,previewPixels.image,'export product-image pixel matches preview');
      await page.waitForFunction(()=>globalThis.__veditAudit.createdUrls.length>0&&globalThis.__veditAudit.createdUrls.every(url=>globalThis.__veditAudit.revokedUrls.includes(url)));
      const urlAudit=await page.evaluate(()=>({created:globalThis.__veditAudit.createdUrls.length,revoked:globalThis.__veditAudit.revokedUrls.length}));assert.deepEqual(urlAudit,{created:1,revoked:1},'download object URL is revoked');
      const jpeg=await imageFixture(page,900,600,'image/jpeg');await file.setInputFiles({name:'photo.jpg',mimeType:'image/jpeg',buffer:jpeg});await page.waitForFunction(()=>document.querySelector('#veditCanvas').width===900&&document.querySelector('#veditDownload').disabled===false);
      const webp=await imageFixture(page,720,960,'image/webp');await file.setInputFiles({name:'photo.webp',mimeType:'image/webp',buffer:webp});await page.waitForFunction(()=>document.querySelector('#veditCanvas').width===720&&document.querySelector('#veditCanvas').height===960);
    }
    const archiveInput=page.locator('#veditArchive'),batchA=await imageFixture(page,640,480),batchB=await imageFixture(page,480,640),batchC=await imageFixture(page,800,600);
    const goodZip=inputZip([{name:'front/photo.png',bytes:batchA},{name:'middle/view.png',bytes:batchB},{name:'back/photo.png',bytes:batchC}]);
    await archiveInput.setInputFiles({name:'one-product.zip',mimeType:'application/zip',buffer:goodZip});
    await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='success'&&document.querySelector('#veditArchivePreview').options.length===3);
    assert.equal(await file.inputValue(),'','ZIP selection clears the single-image file');
    assert.match(await page.locator('#veditArchiveSummary').textContent(),/3 รูป.*ชื่อสินค้าและราคาเดียวกัน/);
    await page.locator('#veditArchivePreview').selectOption('1');
    await page.waitForFunction(()=>document.querySelector('#veditCanvas').width===480&&document.querySelector('#veditCanvas').height===640);
    await page.locator('#veditProductName').fill('สินค้าใน ZIP หนึ่งรายการ');await page.locator('#veditPriceText').fill('ราคา 259 บาท');
    assert.match(await button.textContent(),/ดาวน์โหลด ZIP/);
    const zipDownloadPromise=page.waitForEvent('download');await button.click();const zipDownload=await zipDownloadPromise;
    assert.match(zipDownload.suggestedFilename(),/^vedit-one-product\.zip$/);
    const zipStream=await zipDownload.createReadStream(),zipChunks=[];for await(const chunk of zipStream)zipChunks.push(chunk);
    const outZip=await inspectVeditZip(new File([Buffer.concat(zipChunks)],'result.zip'));
    assert.deepEqual(outZip.entries.map(entry=>entry.name),['001-photo-vedit.png','002-view-vedit.png','003-photo-vedit.png'],'duplicate source basenames become unique ordered output');
    const outputs=[];for(const entry of outZip.entries)outputs.push(Buffer.from(await (await outZip.extract(entry)).arrayBuffer()));
    const outputPixels=await page.evaluate(async encoded=>{const result=[];for(const base64 of encoded){const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),copy=document.createElement('canvas');copy.width=bitmap.width;copy.height=bitmap.height;const ctx=copy.getContext('2d');ctx.drawImage(bitmap,0,0);result.push({width:bitmap.width,height:bitmap.height,top:[...ctx.getImageData(1,1,1,1).data].slice(0,3),badge:[...ctx.getImageData(bitmap.width-1,bitmap.height-1,1,1).data].slice(0,3),image:[...ctx.getImageData(20,Math.floor(bitmap.height/2),1,1).data].slice(0,3)});bitmap.close()}return result},outputs.map(item=>item.toString('base64')));
    assert.deepEqual(outputPixels.map(item=>[item.width,item.height]),[[640,480],[480,640],[800,600]]);
    assert.deepEqual(outputPixels.map(item=>item.top),[[181,18,27],[181,18,27],[181,18,27]],'same name overlay appears on first, middle and last output');
    assert.deepEqual(outputPixels.map(item=>item.badge),[[181,18,27],[181,18,27],[181,18,27]],'same price badge appears on first, middle and last output');
    assert.deepEqual(outputPixels.map(item=>item.image),[[36,133,95],[36,133,95],[36,133,95]],'source image pixels remain below the overlay');
    await page.waitForFunction(()=>globalThis.__veditAudit.createdUrls.every(url=>globalThis.__veditAudit.revokedUrls.includes(url)));
    const unsafeZip=inputZip([{name:'good.png',bytes:batchA},{name:'../escape.png',bytes:batchB}]);
    await archiveInput.setInputFiles({name:'unsafe.zip',mimeType:'application/zip',buffer:unsafeZip});
    await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='error');assert.match(await status.textContent(),/ไม่ปลอดภัย/);assert.equal(await button.isDisabled(),true);
    const spoofZip=inputZip([{name:'good.png',bytes:batchA},{name:'spoof.png',bytes:Buffer.from('not an image')}]);
    await archiveInput.setInputFiles({name:'spoof.zip',mimeType:'application/zip',buffer:spoofZip});
    await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='error');assert.match(await status.textContent(),/spoof.png|ชนิดไฟล์/);assert.equal(await button.isDisabled(),true);
    const overCountZip=inputZip(Array.from({length:25},(_,index)=>({name:`img-${index}.png`,bytes:batchA})));
    await archiveInput.setInputFiles({name:'over-count.zip',mimeType:'application/zip',buffer:overCountZip});
    await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='error');assert.match(await status.textContent(),/เกิน 24 รูป/);assert.equal(await button.isDisabled(),true);
    await archiveInput.setInputFiles({name:'one-product.zip',mimeType:'application/zip',buffer:goodZip});
    await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='success'&&document.querySelector('#veditDownload').disabled===false);
    let cancelledDownloads=0;page.on('download',()=>cancelledDownloads++);
    await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;let rendered=0;globalThis.__veditFailBlob=()=>{HTMLCanvasElement.prototype.toBlob=original};HTMLCanvasElement.prototype.toBlob=function(callback,...args){if(this!==document.querySelector('#veditCanvas')&&++rendered===3){globalThis.__veditFailedCanvas=this;HTMLCanvasElement.prototype.toBlob=original;callback(null);return}return original.call(this,callback,...args)}});
    await button.click();await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='error'&&document.querySelector('#veditCancel').hidden);
    assert.match(await status.textContent(),/สร้าง PNG ไม่สำเร็จ.*ไม่มีไฟล์บางส่วน/);
    assert.deepEqual(await page.evaluate(()=>[globalThis.__veditFailedCanvas.width,globalThis.__veditFailedCanvas.height]),[0,0],'failed export releases offscreen canvas');
    assert.equal(cancelledDownloads,0,'failed last image blocks the entire ZIP download');
    await page.evaluate(()=>globalThis.__veditFailBlob());
    const retryPromise=page.waitForEvent('download');await button.click();const retry=await retryPromise;
    const retryStream=await retry.createReadStream(),retryChunks=[];for await(const chunk of retryStream)retryChunks.push(chunk);
    assert.equal((await inspectVeditZip(new File([Buffer.concat(retryChunks)],'retry.zip'))).entries.length,3,'valid retry after last-image failure exports all images');
    cancelledDownloads=0;
    await page.evaluate(()=>{const original=HTMLCanvasElement.prototype.toBlob;globalThis.__veditRestoreSlowBlob=()=>{HTMLCanvasElement.prototype.toBlob=original};HTMLCanvasElement.prototype.toBlob=function(callback,...args){if(this!==document.querySelector('#veditCanvas')){setTimeout(()=>original.call(this,callback,...args),750);return}return original.call(this,callback,...args)}});
    await button.click();await page.locator('#veditCancel').click();
    await page.waitForFunction(()=>document.querySelector('#veditStatus').textContent.includes('ยกเลิก')&&document.querySelector('#veditCancel').hidden);
    await page.evaluate(()=>globalThis.__veditRestoreSlowBlob());
    assert.equal(cancelledDownloads,0,'cancelled batch produces no ZIP');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,'composer has no horizontal overflow');
    assert.ok(committedVeditAbort<=1,'actual Vedit click has at most the known committed-document detach signal');assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(bad,[]);await context.close();
  }
  const outbound=requestLog.filter(item=>!['GET','HEAD'].includes(item.method)||item.length>0);
  assert.equal(outbound.every(item=>['/api/analytics/view','/api/analytics/event'].includes(item.path)&&item.length<=256),true,'only the established small analytics events may write; image and text bytes never leave the browser');
  console.log('PASS Vedit single-image and batch ZIP composer, source pixels, validation, cancel, nav, accessibility and desktop/mobile runtime');
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
