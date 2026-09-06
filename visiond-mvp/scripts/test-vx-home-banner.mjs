import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const root=path.resolve('public');
const topGenerator=fs.readFileSync('scripts/generate-vx-home-gif.py','utf8');
const lowerGenerator=fs.readFileSync('scripts/generate-bundle-promo-gif.py','utf8');
for(const source of [topGenerator,lowerGenerator]){
  assert.match(source,/vx-logo-source-v014587\.png/);
  assert.doesNotMatch(source,/draw\.polygon|phase \* 2040/);
}
assert.match(lowerGenerator,/จัดชุดยิ่งเยอะ ยิ่งลด/);
assert.match(lowerGenerator,/LeelaUIb\.ttf/);
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')){res.setHeader('content-type','application/json');res.end(JSON.stringify({items:[],user:null}));return}
  const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(404).end();return}
  try{res.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.gif':'image/gif'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},locale:'th-TH'});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);const banner=page.locator('.vx-home-banner');await banner.waitFor();
  assert.equal(await banner.evaluate(el=>el.nextElementSibling?.dataset.visiondPromo),'bundle-discount');
  assert.equal(await page.locator('#vtools').count(),1);
  const heights=await page.evaluate(()=>({vx:document.querySelector('.vx-home-banner').getBoundingClientRect().height,promo:document.querySelector('[data-visiond-promo="bundle-discount"] img').getBoundingClientRect().height}));assert.ok(Math.abs(heights.vx-heights.promo)<=2,`GIF heights differ: ${JSON.stringify(heights)}`);
  assert.deepEqual(await page.locator('.vx-home-price strong').allTextContents(),['490 บาท','980 บาท','1,290 บาท']);
  assert.equal(await page.locator('.vx-home-price[href="/vtools#plans"]').count(),3);
  assert.match(await banner.innerText(),/ค่าคอมรวมทุกช่อง และแยกรายช่อง/);
  assert.match(await banner.innerText(),/ค้นหาสินค้านางฟ้า/);
  assert.equal(await banner.getByRole('button').count(),0);
  assert.notEqual(await page.locator('.vx-home-price').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  const before=await page.locator('.vx-home-price').evaluateAll(cards=>cards.map(x=>getComputedStyle(x).backgroundColor));await page.waitForTimeout(2200);const after=await page.locator('.vx-home-price').evaluateAll(cards=>cards.map(x=>getComputedStyle(x).backgroundColor));assert.notDeepEqual(after,before,'highlight must move automatically');
  await banner.screenshot({path:path.join(os.tmpdir(),'vx-home-desktop.png')});
  const mobile=await browser.newPage({viewport:{width:390,height:844},locale:'th-TH'});
  await mobile.goto(`http://127.0.0.1:${server.address().port}/`);
  const mobileBanner=mobile.locator('.vx-home-banner');await mobileBanner.waitFor();
  await mobileBanner.screenshot({path:path.join(os.tmpdir(),'vx-home-mobile.png')});
  assert.ok(await mobileBanner.evaluate(el=>el.getBoundingClientRect().right<=innerWidth),'mobile banner fits');
  console.log('PASS VX home: old-GIF visual language, directly above original GIF, all prices/links/features, automatic motion without button, mobile fit');
}finally{await browser.close();server.close()}
