import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
if(!chromium)throw new Error('Chrome Playwright runtime unavailable');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const evidenceRoot=path.resolve(publicRoot,'../../.agents/reports');
const styles=['ข่าวด่วน','ผู้ประกาศข่าวมืออาชีพ','เล่าข่าวแบบเพื่อนคุย','ข่าวสายแซ่บ','ข่าวสายฮา','ข่าวลึกลับ','ข่าวสืบสวน','ข่าววิเคราะห์','ข่าวเล่าเป็นเรื่อง','ข่าวประเด็นฮิต','ข่าวสรุป 30 วินาที','ข่าวแบบตั้งคำถาม','ข่าวสองพิธีกร','ข่าวสารคดี','ข่าวเล่าจากหลายมุม'];
const story={id:7,news_day:'2026-10-14',source:'ไทยรัฐ',headline:'ตัวอย่างพาดหัวข่าวจากต้นฉบับเพื่อทดสอบการทำงาน',source_url:'https://www.thairath.co.th/news/society/2938348',observed_at:'2026-10-14T04:00:00.000Z',published_at:null,origin:'index'};
const scenes=Array.from({length:4},(_,index)=>({label:`ฉาก ${index+1}`,text:'สมถุ๋ยรายงานข่าวจากข้อเท็จจริงที่ตรวจแล้ว โปรดอ่านต้นฉบับเพื่อดูรายละเอียด',video_direction:'สมถุ๋ยยืนหน้าปกนิ่ง ขยับมือและสีหน้า',vfx:'แสงเฉพาะตัวผู้ประกาศ',sfx_type:'เสียงเคาะข่าว',sfx_at_seconds:4.5}));
const contentType={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'};
let generated=0;const server=createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/admin/news-channel')){res.setHeader('content-type','application/json');if(req.method==='GET')res.end(JSON.stringify({day:'2026-10-14',items:[story],total:1,next_cursor:null,styles}));else{const body=await new Promise(resolve=>{let data='';req.on('data',chunk=>data+=chunk);req.on('end',()=>resolve(JSON.parse(data)))});res.end(JSON.stringify(body.action==='script'?{scenes,grounding:'ตรวจเทียบต้นฉบับแล้ว'}:{items:[story],total:1,sources:[{name:'ไทยรัฐ',available:true,found:1}]}))}return}
  if(req.url==='/api/admin/vision2/generate'){generated++;res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,url:'/news-channel-mascot.png'}));return}
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.join(publicRoot,pathname.replace(/^\//,''));if(!file.startsWith(publicRoot))throw new Error('bad path');const bytes=await readFile(file);res.setHeader('content-type',contentType[path.extname(file)]||'application/octet-stream');res.end(bytes);
}catch{res.statusCode=404;res.end('not found')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;try{
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:1200,height:900}}),errors=[],consoleErrors=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});await page.goto(`http://127.0.0.1:${server.address().port}/news-channel.html`);
  await page.getByRole('button',{name:'เลือกข่าวนี้'}).click();assert.equal(await page.locator('#style option').count(),15);
  await page.locator('#notes').fill('ข้อมูลข้อเท็จจริงที่ผู้ใช้ตรวจจากต้นฉบับแล้ว มีรายละเอียดเพียงพอสำหรับบทข่าว');await page.getByRole('button',{name:'ร่างบท 4 ฉาก'}).click();await page.locator('#scenes tr').first().waitFor();assert.equal(await page.locator('#scenes tr').count(),4);
  assert.equal(await page.locator('#scenes tr').first().locator('td').count(),6);
  await page.locator('#scenes tr').first().locator('textarea').nth(2).fill('VFX ใหม่');
  const csvWait=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลดตาราง CSV'}).click();const csv=await (await csvWait).createReadStream();let csvText='';for await(const chunk of csv)csvText+=chunk.toString('utf8');assert.match(csvText,/เวลา SFX \(วินาที\)/);assert.match(csvText,/VFX ใหม่/);
  await page.locator('#coverHeadline').fill('W'.repeat(120));await page.getByRole('button',{name:'สร้างและดูปก'}).click();assert.match(await page.locator('#coverStatus').textContent(),/ยาวเกิน/);assert.equal(generated,0,'overlong unbreakable cover is rejected before provider cost');await page.locator('#coverHeadline').fill(story.headline);
  await page.locator('#ownPhoto').setInputFiles(path.join(publicRoot,'news-channel-mascot.png'));await page.getByRole('button',{name:'สร้างและดูปก'}).click();assert.match(await page.locator('#coverStatus').textContent(),/ยืนยันสิทธิ์/);assert.equal(generated,0,'photo rights check precedes generation');await page.locator('#rights').check();
  await page.getByRole('button',{name:'สร้างและดูปก'}).click();await page.getByRole('button',{name:'ดาวน์โหลด PNG'}).waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#download').disabled);assert.equal(generated,1);
  const pngWait=page.waitForEvent('download');await page.getByRole('button',{name:'ดาวน์โหลด PNG'}).click();const png=await (await pngWait).createReadStream();const buffers=[];for await(const chunk of png)buffers.push(chunk);const bytes=Buffer.concat(buffers);assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1920);assert.ok(bytes.length>10000);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
  await mkdir(evidenceRoot,{recursive:true});await page.screenshot({path:path.join(evidenceRoot,'news-channel-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page must not overflow horizontally');await page.screenshot({path:path.join(evidenceRoot,'news-channel-mobile.png'),fullPage:true});
  console.log('news-channel browser: story→15 styles→editable scenes/SFX→CSV→9:16 PNG PASS');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
