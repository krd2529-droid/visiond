import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {inspectVeditZip} from '../public/vedit-zip.js';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
assert.ok(chromium,'Chrome Playwright runtime unavailable');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public'),evidenceRoot=path.resolve(publicRoot,'../../.agents/reports');
const requests=[];const server=createServer(async(req,res)=>{requests.push({method:req.method,url:req.url});const url=new URL(req.url,'http://localhost');if(url.pathname==='/api/auth/me'){res.setHeader('content-type','application/json');res.end(JSON.stringify({user:{role:req.headers.cookie?.includes('member')?'member':'boss'}}));return}if(url.pathname.startsWith('/api/')){res.statusCode=500;res.end('unexpected API request');return}try{const target=path.resolve(publicRoot,`.${url.pathname}`);if(!target.startsWith(publicRoot))throw Error('bad path');const body=await readFile(target);res.setHeader('content-type',{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(target)]||'application/octet-stream');res.end(body)}catch{res.statusCode=404;res.end('not found')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;try{
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const base=`http://127.0.0.1:${server.address().port}`;
  const denied=await browser.newContext();await denied.addCookies([{name:'role',value:'member',url:base}]);const deniedPage=await denied.newPage();await deniedPage.goto(`${base}/photo-exposure.html`);await deniedPage.waitForFunction(()=>document.querySelector('#access')?.textContent?.includes('เฉพาะ Boss'));assert.equal(await deniedPage.locator('#workspace').isHidden(),true);await denied.close();
  for(const width of [1200,390]){
    const context=await browser.newContext({acceptDownloads:true,viewport:{width,height:850}}),page=await context.newPage(),errors=[],browserRequests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>browserRequests.push({method:request.method(),url:request.url()}));await page.goto(`${base}/photo-exposure.html`);await page.locator('#workspace').waitFor({state:'visible'});
    const makeImage=async(r,g,b)=>Buffer.from(await page.evaluate(([red,green,blue])=>{const canvas=document.createElement('canvas');canvas.width=200;canvas.height=120;const ctx=canvas.getContext('2d');ctx.fillStyle=`rgb(${red},${green},${blue})`;ctx.fillRect(0,0,200,120);ctx.fillStyle='rgb(245,240,235)';ctx.fillRect(180,0,20,20);return canvas.toDataURL('image/png').split(',')[1]},[r,g,b]),'base64');
    const dark=await makeImage(105,75,60),bright=await makeImage(205,185,165),beforeHashes=[dark,bright].map(buffer=>createHash('sha256').update(buffer).digest('hex'));
    await page.locator('#photos').setInputFiles([{name:'dark.png',mimeType:'image/png',buffer:dark},{name:'bright.png',mimeType:'image/png',buffer:bright},{name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('bad')}]);
    await page.waitForFunction(()=>document.querySelector('#previewLabel')?.textContent?.includes('อัตโนมัติ'));assert.equal(await page.locator('.file-row').count(),2);assert.match(await page.locator('#errors').textContent(),/bad.txt/);
    const pixels=await page.evaluate(()=>{const pick=(id,x,y)=>[...document.querySelector(id).getContext('2d').getImageData(x,y,1,1).data];return {before:pick('#before',30,30),after:pick('#after',30,30),highlightBefore:pick('#before',190,10),highlightAfter:pick('#after',190,10)}});
    assert.ok(pixels.after[0]>pixels.before[0]+8,'auto lifts dark midtones');
    assert.deepEqual(pixels.highlightAfter,pixels.highlightBefore,'bright highlight pixels are protected in an otherwise dark photo');
    await page.locator('.file-row').nth(1).click();await page.waitForFunction(()=>document.querySelector('#previewLabel')?.textContent?.startsWith('bright.png · อัตโนมัติ 0%'));assert.deepEqual(await page.evaluate(()=>{const pick=id=>[...document.querySelector(id).getContext('2d').getImageData(30,30,1,1).data];return [pick('#before'),pick('#after')]}).then(x=>x[1]),[205,185,165,255],'bright photo is unmodified in auto mode');
    await page.locator('input[value="manual"]').check();await page.locator('#strength').fill('80');await page.waitForFunction(()=>document.querySelector('#previewLabel')?.textContent?.includes('กำหนดเอง 80%'));assert.equal(await page.locator('#downloadZip').isDisabled(),true,'changing controls invalidates old ZIP');
    await page.locator('input[value="auto"]').check();await page.getByRole('button',{name:'ปรับรูปทั้งหมด'}).click();await page.waitForFunction(()=>!document.querySelector('#downloadZip').disabled);assert.match(await page.locator('#status').textContent(),/สำเร็จ 2\/2/);
    const pending=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด ZIP'}).click();const download=await pending,stream=await download.createReadStream(),parts=[];for await(const chunk of stream)parts.push(chunk);const bytes=Buffer.concat(parts);assert.equal(bytes.subarray(0,4).toString('hex'),'504b0304');
    const archive=await inspectVeditZip(new File([bytes],'out.zip',{type:'application/zip'}));assert.deepEqual(archive.entries.map(entry=>entry.name),['001-dark-brightened.png','002-bright-brightened.png']);for(const entry of archive.entries){const file=await archive.extract(entry);const content=Buffer.from(await file.arrayBuffer());assert.equal(content.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(content.readUInt32BE(16),200);assert.equal(content.readUInt32BE(20),120)}
    assert.deepEqual([dark,bright].map(buffer=>createHash('sha256').update(buffer).digest('hex')),beforeHashes,'original input bytes remain unchanged');assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no mobile document overflow');
    await mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:path.join(evidenceRoot,`photo-exposure-${width}.png`),fullPage:true});
    const jpeg=Buffer.from(await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=20;canvas.getContext('2d').fillRect(0,0,40,20);return canvas.toDataURL('image/jpeg').split(',')[1]}),'base64');
    const exif=Buffer.from('45786966000049492a0008000000010012010300010000000800000000000000','hex');
    const rotated=Buffer.concat([jpeg.subarray(0,2),Buffer.from([0xff,0xe1,0x00,0x22]),exif,jpeg.subarray(2)]);
    await page.locator('#photos').setInputFiles({name:'oriented.jpg',mimeType:'image/jpeg',buffer:rotated});await page.waitForFunction(()=>document.querySelector('#previewLabel')?.textContent?.startsWith('oriented.jpg · อัตโนมัติ'));
    assert.deepEqual(await page.evaluate(()=>[document.querySelector('#before').width,document.querySelector('#before').height]),[20,40],'EXIF orientation 8 is respected in local preview');
    await page.getByRole('button',{name:'ปรับรูปทั้งหมด'}).click();await page.waitForFunction(()=>!document.querySelector('#downloadZip').disabled);
    const orientationDownload=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด ZIP'}).click();const orientationStream=await (await orientationDownload).createReadStream(),orientationChunks=[];for await(const chunk of orientationStream)orientationChunks.push(chunk);const orientedZip=await inspectVeditZip(new File([Buffer.concat(orientationChunks)],'oriented.zip',{type:'application/zip'}));const orientedFile=await orientedZip.extract(orientedZip.entries[0]),orientedBytes=Buffer.from(await orientedFile.arrayBuffer());assert.equal(orientedBytes.readUInt32BE(16),20);assert.equal(orientedBytes.readUInt32BE(20),40,'EXIF orientation 8 is respected in exported PNG');
    await page.locator('#photos').setInputFiles([{name:'corrupt.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not a jpeg')},{name:'valid.png',mimeType:'image/png',buffer:dark}]);
    await page.getByRole('button',{name:'ปรับรูปทั้งหมด'}).click();await page.waitForFunction(()=>!document.querySelector('#process').disabled);
    assert.match(await page.locator('#status').textContent(),/สำเร็จ 1\/2/,'a corrupt file does not prevent a valid peer from completing');assert.match(await page.locator('#errors').textContent(),/corrupt\.jpg/);
    assert.equal(await page.locator('#downloadZip').isDisabled(),false);
    if(width===1200){
      await page.locator('#photos').setInputFiles({name:`${'ก'.repeat(90)}.png`,mimeType:'image/png',buffer:dark});
      await page.getByRole('button',{name:'ปรับรูปทั้งหมด'}).click();await page.waitForFunction(()=>!document.querySelector('#process').disabled);
      assert.equal(await page.locator('#downloadZip').isDisabled(),false,'long Thai input filename still produces a ZIP');
      const thaiDownload=page.waitForEvent('download');await page.locator('#downloadZip').click();const thaiStream=await (await thaiDownload).createReadStream(),thaiChunks=[];for await(const chunk of thaiStream)thaiChunks.push(chunk);
      const thaiZip=await inspectVeditZip(new File([Buffer.concat(thaiChunks)],'thai.zip',{type:'application/zip'}));
      assert.equal(thaiZip.entries.length,1);assert.ok(thaiZip.entries[0].name.startsWith('001-ก'));assert.ok(new TextEncoder().encode(thaiZip.entries[0].name).length<=240);
      await page.evaluate(()=>{window.__originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,type){return window.__originalToBlob.call(this,blob=>{Object.defineProperty(blob,'size',{value:8*1024*1024});callback(blob)},type)}});
      await page.locator('#photos').setInputFiles(Array.from({length:24},(_,index)=>({name:`batch-${index+1}.png`,mimeType:'image/png',buffer:dark})));
      await page.getByRole('button',{name:'ปรับรูปทั้งหมด'}).click();await page.waitForFunction(()=>!document.querySelector('#process').disabled);
      assert.match(await page.locator('#status').textContent(),/สำเร็จ 20\/24/,'aggregate ZIP budget stops a 24-file batch before retaining excessive output');
      assert.match(await page.locator('#errors').textContent(),/ZIP รวมเกิน 160 MB/);
      assert.equal(await page.locator('#downloadZip').isDisabled(),false,'completed peers remain downloadable');
      await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.__originalToBlob;delete window.__originalToBlob});
    }
    assert.deepEqual(await page.evaluate(async()=>({local:Object.keys(localStorage),session:Object.keys(sessionStorage),databases:typeof indexedDB.databases==='function'?(await indexedDB.databases()).map(database=>database.name):[]})),{local:[],session:[],databases:[]},'photo bytes are not persisted in browser storage');
    assert.ok(browserRequests.every(request=>request.method==='GET'&&request.url.startsWith(base+'/')),'browser makes no third-party or photo-upload request');
    assert.ok(browserRequests.every(request=>!new URL(request.url).pathname.startsWith('/api/')||new URL(request.url).pathname==='/api/auth/me'),'browser calls only the read-only auth API');
    await context.close();
  }
  assert.ok(requests.every(request=>request.method==='GET'&&!/^https?:/i.test(request.url)),'no photo payload or external network request');
  assert.ok(requests.every(request=>!request.url.startsWith('/api/')||request.url==='/api/auth/me'),'only read-only auth API is called');
  console.log('photo exposure browser: auth, local preview, auto/manual, valid-peer errors, PNG ZIP/CRC, 1200/390 PASS');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
