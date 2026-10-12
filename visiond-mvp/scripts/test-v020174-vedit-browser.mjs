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
const expectedConsumers=['about.html','blog.html','bots.html','cart.html','contact.html','course-basket-edit.html','course-center.html','course-rights-terms.html','course-seller.html','course.html','courses.html','dashboard.html','digital-products.html','forgot-password.html','guides.html','index.html','login.html','member.html','my-courses.html','partner-commerce-claim.html','privacy.html','product.html','register.html','reset-password.html','terms.html','vedit.html','vpage.html','vtools.html'].sort();
const consumers=fs.readdirSync(publicRoot).filter(name=>name.endsWith('.html')&&read(name).includes('shared-nav.js?v=')).sort();
assert.deepEqual(consumers,expectedConsumers,'every canonical nav consumer is enumerated');
for(const name of consumers){
  const source=read(name);
  assert.equal((source.match(/shared-nav\.js\?v=020187/g)||[]).length,1,`${name} loads the current shared nav once`);
  assert.doesNotMatch(source,/shared-nav\.js\?v=020(?:57|173)/,`${name} has no stale cache key`);
}
assert.doesNotMatch(shared,/'nav-vedit-link'|'\/vedit','Vedit'/,'canonical public nav omits Vedit');
assert.doesNotMatch(home,/class="nav-vedit-link"|href="\/vedit"/,'home first paint omits Vedit');
assert.doesNotMatch(html,/class="nav-vedit-link"|href="\/vedit"/,'Vedit first paint omits its public-nav self-link');
assert.match(html,/id="veditImage"[^>]+accept="image\/jpeg,image\/png,image\/webp"/);
assert.match(html,/vedit\.css\?v=020189[\s\S]*mobile-storefront\.css[\s\S]*header-shell\.css[\s\S]*frontend-theme\.css/,'stylesheet cascade follows the public header contract');
assert.match(html,/vedit\.js\?v=020189[\s\S]*shared-nav\.js\?v=020187/);
assert.doesNotMatch(html,/ขนาดต้นฉบับ|กรอบบน.ล่าง|ราคาแสดงบนภาพ/,'Vedit copy does not claim source-size output or a price overlay');
assert.doesNotMatch(client,/\bfetch\s*\(|localStorage|sessionStorage|\/api\/|vpage|credit|D1|R2/i,'composer has no API, storage, Vpage or credit coupling');
assert.match(client,/MIME_SIGNATURES/);
assert.match(client,/selectionGeneration/);
assert.match(client,/Intl\?\.Segmenter/);
assert.match(client,/canvas\.toBlob/);

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.onnx':'application/octet-stream','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const requestLog=[];
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  requestLog.push({method:request.method,path:url.pathname,length:Number(request.headers['content-length']||0)});
  if(url.pathname.startsWith('/api/')){
    const payload=url.pathname==='/api/auth/me'?{user:null}:{items:[],products:[],courses:[]};
    response.writeHead(200,{'content-type':'application/json','cache-control':'private, no-store'});response.end(JSON.stringify(payload));return;
  }
  const pathname=['/','/index.html'].includes(url.pathname)?'/index.html':['/vedit','/vedit.html'].includes(url.pathname)?'/vedit.html':url.pathname;
  const local=path.resolve(publicRoot,`.${pathname}`),relative=path.relative(publicRoot,local);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(local)){response.writeHead(404,{'content-type':'text/plain'});response.end('not found');return}
  response.writeHead(200,{'content-type':types[path.extname(local)]||'application/octet-stream'});response.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});

async function imageFixture(page,width,height,type='image/png',transparent=false){
  const dataUrl=await page.evaluate(({width,height,type,transparent})=>{
    const fixture=document.createElement('canvas');fixture.width=width;fixture.height=height;const ctx=fixture.getContext('2d');ctx.fillStyle='#24855f';ctx.fillRect(0,0,width,height);ctx.fillStyle='#58a6ff';ctx.fillRect(width/2,0,width/2,height);
    const rows=ctx.createImageData(1,height);for(let y=0;y<height;y++){const i=y*4;rows.data[i]=y&255;rows.data[i+1]=(y>>8)&255;rows.data[i+2]=(y*17)&255;rows.data[i+3]=255}ctx.putImageData(rows,0,0);
    ctx.fillStyle='#ffe066';ctx.fillRect(width-3,0,3,3);ctx.fillStyle='#e044dd';ctx.fillRect(2,height-3,3,3);
    if(transparent)ctx.clearRect(12,12,24,24);
    return fixture.toDataURL(type,.9);
  },{width,height,type,transparent});
  return Buffer.from(dataUrl.split(',')[1],'base64');
}
async function inspectSourcePixels(page,sourceBytes,outputBytes){
  return page.evaluate(async({sourceEncoded,outputEncoded})=>{
    const decode=async encoded=>createImageBitmap(new Blob([Uint8Array.from(atob(encoded),char=>char.charCodeAt(0))],{type:'image/png'}));
    const source=await decode(sourceEncoded),target=outputEncoded?await decode(outputEncoded):document.querySelector('#veditCanvas');
    const sourceCanvas=document.createElement('canvas'),outputCanvas=document.createElement('canvas');
    sourceCanvas.width=source.width;sourceCanvas.height=source.height;outputCanvas.width=target.width;outputCanvas.height=target.height;
    sourceCanvas.getContext('2d').drawImage(source,0,0);outputCanvas.getContext('2d').drawImage(target,0,0);
    const input=sourceCanvas.getContext('2d').getImageData(0,0,source.width,source.height).data;
    const output=outputCanvas.getContext('2d').getImageData(0,0,target.width,target.height).data;
    const top=target.height-source.height;let compared=0,mismatches=0;
    for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
      const i=(y*source.width+x)*4,o=((y+top)*target.width+x)*4;compared++;
      if(input[i]!==output[o]||input[i+1]!==output[o+1]||input[i+2]!==output[o+2]||input[i+3]!==output[o+3])mismatches++;
    }
    const topPixel=[...output.slice(0,3)],bottomLeft=[...output.slice(((target.height-1)*target.width+10)*4,((target.height-1)*target.width+10)*4+3)],transparentAlpha=output[((20+top)*target.width+20)*4+3],result={width:target.width,height:target.height,sourceWidth:sourceCanvas.width,sourceHeight:sourceCanvas.height,top,compared,mismatches,topPixel,bottomLeft,transparentAlpha};
    source.close();if(outputEncoded)target.close();
    return result;
  },{sourceEncoded:sourceBytes.toString('base64'),outputEncoded:outputBytes?.toString('base64')||null});
}
async function samePngPixels(page,firstBytes,secondBytes,tolerance=0){
  return page.evaluate(async({first,second,tolerance})=>{
    const decode=async encoded=>createImageBitmap(new Blob([Uint8Array.from(atob(encoded),char=>char.charCodeAt(0))],{type:'image/png'}));
    const a=await decode(first),b=await decode(second);if(a.width!==b.width||a.height!==b.height){const result={same:false,firstSize:[a.width,a.height],secondSize:[b.width,b.height]};a.close();b.close();return result}
    const pixels=bitmap=>{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data};
    const ap=pixels(a),bp=pixels(b);let mismatch=-1;for(let i=0;i<ap.length;i++)if(Math.abs(ap[i]-bp[i])>tolerance){mismatch=i;break}
    const result={same:mismatch===-1,firstSize:[a.width,a.height],secondSize:[b.width,b.height],mismatch};a.close();b.close();return result;
  },{first:firstBytes.toString('base64'),second:secondBytes.toString('base64'),tolerance});
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
    const page=await context.newPage(),errors=[],failed=[],bad=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    page.on('requestfailed',request=>{const error=request.failure()?.errorText||'unknown';if(request.url().startsWith(base))failed.push(`${request.url()} ${error}`)});
    page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)bad.push(`${response.status()} ${response.url()}`)});

    await page.goto(base);
    await page.locator('.topbar.header-shell-ready.mobile-nav-ready').waitFor({state:'attached'});
    await page.locator('.topbar nav[data-account-ready="1"]').waitFor({state:'attached'});
    assert.equal(await page.locator('.topbar a[href="/vedit"]').count(),0,'home omits Vedit on desktop and mobile');
    if(viewport.width<=800){const toggle=page.locator('.mobile-nav-toggle');await toggle.click();await page.locator('.topbar .nav-vpage-link').waitFor({state:'visible'});assert.equal(await page.locator('.topbar a[href="/vedit"]').count(),0)}
    await page.goto(`${base}/vedit`);
    await page.waitForLoadState('networkidle');
    assert.equal(new URL(page.url()).pathname,'/vedit','direct Vedit URL still works');

    for(const route of ['/vedit','/vedit.html']){
      if(new URL(page.url()).pathname!==route)await page.goto(`${base}${route}`);
      await page.locator('.topbar.header-shell-ready.mobile-nav-ready').waitFor({state:'attached'});
      await page.locator('.topbar nav[data-account-ready="1"]').waitFor({state:'attached'});
      assert.equal(await page.locator('.topbar a[href="/vedit"]').count(),0,`${route} omits Vedit public-nav entry`);
      assert.deepEqual(await page.locator('.topbar>nav>a').evaluateAll(nodes=>nodes.slice(0,5).map(node=>new URL(node.href).pathname.replace(/\.html$/,''))),['/','/digital-products','/course-center','/vpage','/courses']);
      for(const selector of ['#navLogin','#navRegister','.cart-nav','.vd-language-switcher'])assert.equal(await page.locator(`.topbar ${selector}`).count(),1,`${selector} is not duplicated`);
      if(viewport.width<=800){
        const toggle=page.locator('.mobile-nav-toggle');
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        await toggle.click();
        await page.locator('.topbar .nav-vpage-link').waitFor({state:'visible'});
        assert.equal(await toggle.getAttribute('aria-expanded'),'true');
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>document.querySelector('.mobile-nav-toggle')?.getAttribute('aria-expanded')==='false');
      }else assert.equal(await page.locator('.topbar .nav-vpage-link').isVisible(),true);
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
      await page.waitForFunction(()=>document.querySelector('#veditCanvas').width===800&&document.querySelector('#veditCanvas').height===600+Number(document.querySelector('#veditCanvas').dataset.topHeight)&&document.querySelector('#veditDownload').disabled===false);
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

    const png=await imageFixture(page,1200,800,'image/png',true);
    await file.setInputFiles({name:'สินค้า ทดลอง.png',mimeType:'image/png',buffer:png});await canvas.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#veditDownload').disabled);
    const initialSize=await canvas.evaluate(node=>({width:node.width,height:node.height,top:Number(node.dataset.topHeight),sourceWidth:node.dataset.sourceWidth,sourceHeight:node.dataset.sourceHeight}));
    assert.equal(initialSize.width,1200);assert.equal(initialSize.height,800+initialSize.top);assert.ok(initialSize.top>0);assert.equal(initialSize.sourceWidth,'1200');assert.equal(initialSize.sourceHeight,'800');
    assert.match(await page.locator('#veditResolution').textContent(),new RegExp(`ต้นฉบับ 1,200 × 800 px.*ส่งออก 1,200 × ${initialSize.height.toLocaleString('en-US')} px`));
    assert.match(await status.textContent(),/ชื่อและราคาอยู่ในกรอบด้านบน/);
    await page.locator('#veditProductName').fill('สินค้าไทยดีมาก'.repeat(14));await page.locator('#veditPriceText').fill('ราคาโปรพิเศษสุดคุ้ม'.repeat(8));
    const geometry=await canvas.evaluate(node=>{const ctx=node.getContext('2d'),priceStart=Number(node.dataset.priceStart),topHeight=Number(node.dataset.topHeight);const whites=(start,end)=>{const pixels=ctx.getImageData(0,start,node.width,end-start).data;let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>235&&pixels[i+1]>235&&pixels[i+2]>235)count++;return count};return{topLines:Number(node.dataset.topLines),priceLines:Number(node.dataset.priceLines),top:[...ctx.getImageData(1,1,1,1).data],topHeight,priceStart,nameWhites:whites(0,priceStart),priceWhites:whites(priceStart,topHeight)}});
    assert.ok(geometry.topLines>=1&&geometry.topLines<=3);assert.ok(geometry.priceLines>=1&&geometry.priceLines<=3);assert.deepEqual(geometry.top.slice(0,3),[181,18,27]);assert.ok(geometry.nameWhites>100,'name is visible in the top band');assert.ok(geometry.priceWhites>100,'price is visible in the same top band');
    const previewSource=await inspectSourcePixels(page,png,null);
    assert.equal(previewSource.mismatches,0,'every original source pixel is unchanged in preview');
    assert.equal(previewSource.compared,1200*800,'full source rectangle, including edges and corners, was checked without a mask');
    assert.equal(previewSource.transparentAlpha,0,'preview preserves transparent PNG pixels');
    assert.deepEqual(previewSource.topPixel,[181,18,27]);assert.deepEqual(previewSource.bottomLeft,[36,133,95],'no lower red band is added');
    await page.locator('#veditProductName').fill('');assert.equal(await button.isDisabled(),true,'blank required text disables export');await page.locator('#veditProductName').fill('ชื่อสินค้าใหม่');assert.equal(await button.isEnabled(),true);
    await page.locator('#veditProductName').focus();assert.equal(await page.evaluate(()=>document.activeElement?.id),'veditProductName','text editor is keyboard focusable');

    if(viewport.width===1440){
      const previewPixels=await canvas.evaluate(node=>{const ctx=node.getContext('2d'),topHeight=Number(node.dataset.topHeight);return{top:[...ctx.getImageData(1,1,1,1).data],image:[...ctx.getImageData(100,500+topHeight,1,1).data],topHeight}});
      const previewPng=Buffer.from((await canvas.evaluate(node=>node.toDataURL('image/png'))).split(',')[1],'base64');
      const downloadPromise=page.waitForEvent('download');await button.click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/-vedit\.png$/);const stream=await download.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);const output=Buffer.concat(chunks);assert.deepEqual([...output.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert.equal(output.readUInt32BE(16),1200);assert.equal(output.readUInt32BE(20),800+previewPixels.topHeight);
      const pngMatch=await samePngPixels(page,previewPng,output);assert.equal(pngMatch.same,true,`single PNG matches preview: ${JSON.stringify(pngMatch)}`);
      const pngSource=await inspectSourcePixels(page,png,output);assert.equal(pngSource.mismatches,0,'every source pixel is unchanged in downloaded PNG');assert.equal(pngSource.height,800+pngSource.top);assert.equal(pngSource.transparentAlpha,0,'single PNG preserves transparent source pixels');
      await page.waitForFunction(()=>globalThis.__veditAudit.createdUrls.length>0&&globalThis.__veditAudit.createdUrls.every(url=>globalThis.__veditAudit.revokedUrls.includes(url)));
      const urlAudit=await page.evaluate(()=>({created:globalThis.__veditAudit.createdUrls.length,revoked:globalThis.__veditAudit.revokedUrls.length}));assert.deepEqual(urlAudit,{created:1,revoked:1},'download object URL is revoked');
      const tall=await imageFixture(page,320,12000);await file.setInputFiles({name:'tall.png',mimeType:'image/png',buffer:tall});
      await page.waitForFunction(()=>document.querySelector('#veditCanvas').dataset.sourceHeight==='12000'&&document.querySelector('#veditCanvas').height===12000+Number(document.querySelector('#veditCanvas').dataset.topHeight));
      const tallDownload=page.waitForEvent('download');await button.click();const tallFile=await tallDownload, tallStream=await tallFile.createReadStream(),tallChunks=[];for await(const chunk of tallStream)tallChunks.push(chunk);
      const tallPixels=await inspectSourcePixels(page,tall,Buffer.concat(tallChunks));
      assert.equal(tallPixels.width,320);assert.equal(tallPixels.sourceHeight,12000);assert.equal(tallPixels.height,12000+tallPixels.top);assert.equal(tallPixels.mismatches,0,'12,000px tall source is not cropped or scaled');
      const jpeg=await imageFixture(page,900,600,'image/jpeg');await file.setInputFiles({name:'photo.jpg',mimeType:'image/jpeg',buffer:jpeg});await page.waitForFunction(()=>document.querySelector('#veditCanvas').width===900&&document.querySelector('#veditCanvas').height===600+Number(document.querySelector('#veditCanvas').dataset.topHeight)&&document.querySelector('#veditDownload').disabled===false);
      const webp=await imageFixture(page,720,960,'image/webp');await file.setInputFiles({name:'photo.webp',mimeType:'image/webp',buffer:webp});await page.waitForFunction(()=>document.querySelector('#veditCanvas').width===720&&document.querySelector('#veditCanvas').height===960+Number(document.querySelector('#veditCanvas').dataset.topHeight));
    }
    const archiveInput=page.locator('#veditArchive'),batchA=await imageFixture(page,640,480),batchB=await imageFixture(page,480,640),batchC=await imageFixture(page,800,600,'image/png',true);
    const goodZip=inputZip([{name:'front/photo.png',bytes:batchA},{name:'middle/view.png',bytes:batchB},{name:'back/photo.png',bytes:batchC}]);
    await archiveInput.setInputFiles({name:'one-product.zip',mimeType:'application/zip',buffer:goodZip});
    await page.waitForFunction(()=>document.querySelector('#veditStatus').dataset.state==='success'&&document.querySelector('#veditArchivePreview').options.length===3);
    assert.equal(await file.inputValue(),'','ZIP selection clears the single-image file');
    assert.match(await page.locator('#veditArchiveSummary').textContent(),/3 รูป.*ชื่อสินค้าและราคาเดียวกัน/);
    await page.locator('#veditProductName').fill('สินค้าใน ZIP หนึ่งรายการ');await page.locator('#veditPriceText').fill('ราคา 259 บาท');
    assert.match(await button.textContent(),/ดาวน์โหลด ZIP/);
    const batchSources=[batchA,batchB,batchC],batchSizes=[[640,480],[480,640],[800,600]],batchPreview=[];
    for(let index=0;index<batchSources.length;index++){
      await page.locator('#veditArchivePreview').selectOption(String(index));
      await page.waitForFunction(([width,height])=>{const node=document.querySelector('#veditCanvas');return Number(node.dataset.sourceWidth)===width&&Number(node.dataset.sourceHeight)===height&&node.height===height+Number(node.dataset.topHeight)+Number(node.dataset.bottomHeight)},batchSizes[index]);
      const geometry=await canvas.evaluate(node=>({width:node.width,height:node.height,top:Number(node.dataset.topHeight),bottom:Number(node.dataset.bottomHeight),topLines:Number(node.dataset.topLines),priceLines:Number(node.dataset.priceLines)}));
      assert.equal(geometry.width,batchSizes[index][0]);assert.equal(geometry.height,batchSizes[index][1]+geometry.top+geometry.bottom);
      assert.ok(geometry.topLines>=1&&geometry.priceLines>=1);
      batchPreview.push({...geometry,png:Buffer.from((await canvas.evaluate(node=>node.toDataURL('image/png'))).split(',')[1],'base64')});
    }
    await page.locator('#veditArchivePreview').selectOption('1');
    await page.waitForFunction(()=>document.querySelector('#veditCanvas').dataset.sourceWidth==='480');
    const zipDownloadPromise=page.waitForEvent('download');await button.click();const zipDownload=await zipDownloadPromise;
    assert.match(zipDownload.suggestedFilename(),/^vedit-one-product\.zip$/);
    const zipStream=await zipDownload.createReadStream(),zipChunks=[];for await(const chunk of zipStream)zipChunks.push(chunk);
    const outZip=await inspectVeditZip(new File([Buffer.concat(zipChunks)],'result.zip'));
    assert.deepEqual(outZip.entries.map(entry=>entry.name),['001-photo-vedit.png','002-view-vedit.png','003-photo-vedit.png'],'duplicate source basenames become unique ordered output');
    const outputs=[];for(const entry of outZip.entries)outputs.push(Buffer.from(await (await outZip.extract(entry)).arrayBuffer()));
    const outputPixels=await page.evaluate(async encoded=>{const result=[];for(const base64 of encoded){const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'})),copy=document.createElement('canvas');copy.width=bitmap.width;copy.height=bitmap.height;const ctx=copy.getContext('2d');ctx.drawImage(bitmap,0,0);result.push({width:bitmap.width,height:bitmap.height,top:[...ctx.getImageData(1,1,1,1).data].slice(0,3),bottomRight:[...ctx.getImageData(bitmap.width-1,bitmap.height-1,1,1).data].slice(0,3),image:[...ctx.getImageData(20,Math.floor(bitmap.height/2),1,1).data].slice(0,3)});bitmap.close()}return result},outputs.map(item=>item.toString('base64')));
    assert.deepEqual(outputPixels.map(item=>[item.width,item.height]),batchPreview.map(item=>[item.width,item.height]));
    assert.deepEqual(outputPixels.map(item=>item.top),[[181,18,27],[181,18,27],[181,18,27]],'same red top band appears on first, middle and last output');
    assert.deepEqual(outputPixels.map(item=>item.bottomRight),[[181,18,27],[181,18,27],[181,18,27]],'Zippo Udon bottom band is outside the product area');
    for(let index=0;index<outputs.length;index++){
      assert.equal(outputPixels[index].height,batchSizes[index][1]+batchPreview[index].top+batchPreview[index].bottom,`ZIP output ${index+1} adds two bars outside its source area`);
      const zipMatch=await samePngPixels(page,batchPreview[index].png,outputs[index],4);assert.equal(zipMatch.same,true,`ZIP output ${index+1} matches its preview: ${JSON.stringify(zipMatch)}`);
    }
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
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(bad,[]);await context.close();
  }
  const outbound=requestLog.filter(item=>!['GET','HEAD'].includes(item.method)||item.length>0);
  assert.equal(outbound.every(item=>['/api/analytics/view','/api/analytics/event'].includes(item.path)&&item.length<=256),true,'only the established small analytics events may write; image and text bytes never leave the browser');
  console.log('PASS Vedit single-image and batch ZIP composer, source pixels, validation, cancel, nav, accessibility and desktop/mobile runtime');
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
