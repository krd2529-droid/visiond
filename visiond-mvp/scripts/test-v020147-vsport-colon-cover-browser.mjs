import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
assert.ok(chromium,'installed Chrome is required');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','public'),evidence=path.resolve(root,'..','test-artifacts','vsport-cover-detail');
fs.mkdirSync(evidence,{recursive:true});
const sample='เยอรมนีปะทะเซอร์เบีย: คาดการณ์ไลน์อัพและข่าวทีม';
const project={id:147,title:'Cover detail fixture',news_date:'2026-10-01',scope_mode:'specific_team',team_name:'เยอรมนี',target_minutes:30,target_seconds:0,status:'stories_ready',narration_script:'',thumbnail_headline:sample,thumbnail_subheadline:'',thumbnail_focus_text:'',thumbnail_focus_asset_id:null,thumbnail_palette:'red-yellow',thumbnail_layout:'split'};
let apiPosts=0;
const send=(res,data)=>{res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(data))};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/auth/me')return send(res,{user:{id:147,role:'admin'}});
  if(url.pathname==='/api/admin/vsport'&&req.method==='POST'){apiPosts++;res.statusCode=400;return send(res,{error:'unexpected write'})}
  if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('jobs_project'))return send(res,{jobs:[]});
  if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('id'))return send(res,{project,stories:[],candidates:[],assets:[],story_pagination:{limit:24,has_more:false,next_cursor:null},media_pagination:{candidates:{limit:24,has_more:false,next_cursor:null},assets:{limit:24,has_more:false,next_cursor:null}}});
  if(url.pathname==='/api/admin/vsport')return send(res,{items:[project],pagination:{limit:24,has_more:false,next_cursor:null}});
  const relative=url.pathname==='/'?'/vsport.html':url.pathname,local=path.resolve(root,`.${relative}`);if(!local.startsWith(root)||!fs.existsSync(local)){res.statusCode=404;return res.end('not found')}
  res.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(local)]||'application/octet-stream');res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  for(const width of [1440,390]){
    const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{globalThis.__headlinePaint=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){if(this.canvas?.id==='thumbnailCanvas'&&y>=200&&y<=450)globalThis.__headlinePaint.push({text:String(text),font:this.font,width:this.measureText(String(text)).width,y});return original.call(this,text,x,y,...rest)}});
    await page.goto(`http://127.0.0.1:${server.address().port}/vsport.html`);
    await page.getByRole('button',{name:'เปิดทำต่อ Cover detail fixture'}).click();await page.waitForSelector('#workspace:not([hidden])');
    await page.evaluate(()=>{globalThis.__headlinePaint=[]});await page.locator('#previewThumbnail').click();await page.waitForFunction(()=>globalThis.__headlinePaint.length>=2);
    let paint=await page.evaluate(()=>globalThis.__headlinePaint);
    assert.deepEqual(paint.map(item=>item.text),['เยอรมนีปะทะเซอร์เบีย',': คาดการณ์ไลน์อัพและข่าวทีม'],'screenshot detail stays on one smaller line');
    assert.match(paint[0].font,/76px/);assert.ok(Number(paint[1].font.match(/(\d+)px/)?.[1])<76,'detail font is smaller');
    assert.ok(paint.every(item=>item.width<=760),`all headline text fits: ${JSON.stringify(paint)}`);
    await page.locator('#thumbnailCanvas').screenshot({path:path.join(evidence,`sample-preview-${width}.png`)});
    const pending=page.waitForEvent('download');await page.locator('#exportThumbnail').click();const download=await pending,png=fs.readFileSync(await download.path());
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1280);assert.equal(png.readUInt32BE(20),720);
    fs.writeFileSync(path.join(evidence,`sample-export-${width}.png`),png);
    const same=await page.evaluate(async base64=>{const image=new Image();image.src=`data:image/png;base64,${base64}`;await image.decode();const exported=document.createElement('canvas');exported.width=1280;exported.height=720;exported.getContext('2d').drawImage(image,0,0);const a=document.querySelector('#thumbnailCanvas').getContext('2d').getImageData(80,160,720,300).data,b=exported.getContext('2d').getImageData(80,160,720,300).data;return a.every((value,index)=>value===b[index])},png.toString('base64'));
    assert.equal(same,true,'downloaded PNG headline pixels match preview');
    await page.locator('#thumbHeadline').fill('ข่าวฟุตบอลไทยวันนี้');await page.waitForFunction(()=>globalThis.__headlinePaint.some(item=>item.text==='ข่าวฟุตบอลไทยวันนี้'));
    paint=await page.evaluate(()=>globalThis.__headlinePaint);assert.match(paint.at(-1).font,/76px/,'headline without colon retains original size');
    await page.evaluate(()=>{globalThis.__headlinePaint=[]});await page.locator('#thumbHeadline').fill('ข่าวฟุตบอลไทยวันนี้：รายละเอียดการแข่งขันฟุตบอลไทย');await page.waitForFunction(()=>globalThis.__headlinePaint.length>=3);
    paint=await page.evaluate(()=>globalThis.__headlinePaint);assert.ok(paint.at(-1).width>=228,`fullwidth-colon detail must not leave tiny tail: ${JSON.stringify(paint)}`);assert.ok(!paint.at(-1).text.startsWith('อลไทย'));
    await page.evaluate(()=>{globalThis.__headlinePaint=[]});await page.locator('#thumbHeadline').fill(`ข่าวฟุตบอลไทย：${'รายละเอียดการแข่งขันฟุตบอลไทย'.repeat(10)}`);await page.waitForFunction(()=>globalThis.__headlinePaint.length>=2);
    paint=(await page.evaluate(()=>globalThis.__headlinePaint)).slice(-3);assert.ok(paint.length<=3&&paint.every(item=>item.width<=760),'long fullwidth-colon detail wraps/ellipsizes within three lines');
    assert.equal(apiPosts,0,'cover rendering and export do not call API');assert.deepEqual(errors,[]);await page.close();
  }
  console.log(`PASS v0.20.147 installed-Chrome desktop/mobile colon detail, long Thai, no-colon and actual PNG; ${evidence}`);
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
