import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import vpageService from '../services/vpage/src/index.js';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
assert.ok(chromium,'installed Chrome required');

const env={VPAGE_DB:{prepare(){throw new Error('homepage must not read D1')}}};
const server=http.createServer(async(request,response)=>{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);
  const workerResponse=await vpageService.fetch(new Request(`https://smartlinkpage.com${request.url}`,{method:request.method,headers:request.headers,body:['GET','HEAD'].includes(request.method)?undefined:Buffer.concat(chunks)}),env);
  response.writeHead(workerResponse.status,Object.fromEntries(workerResponse.headers));
  response.end(Buffer.from(await workerResponse.arrayBuffer()));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'}),base=`http://127.0.0.1:${server.address().port}`;
try{
  for(const viewport of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height}}),pageErrors=[],consoleErrors=[],failedRequests=[],badResponses=[];
    page.on('pageerror',error=>pageErrors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
    page.on('requestfailed',request=>failedRequests.push(`${request.url()} ${request.failure()?.errorText||''}`));
    page.on('response',response=>{if(response.status()>=400)badResponses.push(`${response.status()} ${response.url()}`)});
    await page.goto(`${base}/`,{waitUntil:'networkidle'});
    await page.locator('.hero').waitFor();
    assert.equal(await page.locator('.brand-logo').evaluate(image=>image.complete&&image.naturalWidth>0),true,`${viewport.name} logo loads`);
    assert.equal((await page.getByRole('heading',{level:1}).innerText()).replace(/\s+/g,''),'สร้างหน้าขายที่เล่าเรื่องสินค้าและพาลูกค้าไปต่อได้ทันที');
    assert.equal(await page.locator('.feature-card').count(),3);
    assert.equal(await page.locator('.step-card').count(),3);
    const offer=page.locator('.offer-card');
    assert.equal(await offer.isVisible(),true,`${viewport.name} exact offer is prominent`);
    assert.equal((await offer.innerText()).replace(/\s+/g,' ').trim(),'999 บาท / 30 วัน / 1 เซลเพจ');
    assert.equal(await offer.getAttribute('aria-label'),'แพ็กเกจ 999 บาท ระยะเวลา 30 วัน สำหรับ 1 เซลเพจ');
    const cta=page.getByRole('link',{name:/คุยกับเราทาง LINE/}).first();
    assert.equal(await cta.getAttribute('href'),'https://lin.ee/rUcWsJu');
    assert.equal(await cta.getAttribute('target'),'_blank');
    assert.equal(await cta.getAttribute('rel'),'noopener noreferrer');
    assert.equal(await cta.isVisible(),true);
    await cta.focus();
    assert.equal(await cta.evaluate(link=>link.matches(':focus-visible')),true,`${viewport.name} primary CTA has keyboard focus visibility`);
    const [offerBox,ctaBox]=await Promise.all([offer.boundingBox(),cta.boundingBox()]);
    assert.ok(offerBox&&ctaBox,`${viewport.name} offer and CTA have rendered bounds`);
    assert.ok(offerBox.y+offerBox.height<=ctaBox.y,`${viewport.name} exact offer does not overlap its LINE CTA`);
    assert.ok(ctaBox.y+ctaBox.height<=viewport.height,`${viewport.name} offer and LINE CTA stay above the fold`);
    const geometry=await page.evaluate(()=>{
      const cta=document.querySelector('.hero .line-cta'),hero=document.querySelector('.hero'),footer=document.querySelector('footer');
      const c=cta.getBoundingClientRect(),h=hero.getBoundingClientRect(),f=footer.getBoundingClientRect();
      return{viewportWidth:innerWidth,viewportHeight:innerHeight,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,ctaInside:c.left>=0&&c.right<=innerWidth,heroHeight:h.height,footerTop:f.top,bodyHeight:document.body.scrollHeight};
    });
    assert.deepEqual([geometry.viewportWidth,geometry.viewportHeight],[viewport.width,viewport.height],`${viewport.name} uses the requested real viewport`);
    assert.equal(geometry.overflow,false,`${viewport.name} has no horizontal overflow`);
    assert.equal(geometry.ctaInside,true,`${viewport.name} CTA stays inside viewport`);
    assert.ok(geometry.heroHeight>300,`${viewport.name} hero is visibly substantial`);
    assert.ok(geometry.footerTop>geometry.heroHeight,`${viewport.name} sections remain ordered`);
    assert.ok(geometry.bodyHeight>viewport.height,`${viewport.name} renders the full service page`);
    assert.deepEqual(pageErrors,[],`${viewport.name} page errors`);
    assert.deepEqual(consoleErrors,[],`${viewport.name} console errors`);
    assert.deepEqual(failedRequests,[],`${viewport.name} failed requests`);
    assert.deepEqual(badResponses,[],`${viewport.name} unexpected non-2xx responses`);
    await page.screenshot({path:`.tmp-codex/smartlinkpage-home-${viewport.name}.png`,fullPage:true});
    await page.close();
  }
  console.log('PASS SmartLinkPage installed-Chrome desktop/mobile homepage layout, brand, LINE CTA and clean console/network');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
