import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import vpageService from '../services/vpage/src/index.js';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
assert.ok(chromium,'installed Chrome required');

const env={VPAGE_DB:{prepare(){throw new Error('static demo must not read D1')}}};
const server=http.createServer(async(request,response)=>{
  const workerResponse=await vpageService.fetch(new Request(`https://smartlinkpage.com${request.url}`,{method:request.method,headers:request.headers}),env);
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
    await page.goto(`${base}/demo`,{waitUntil:'networkidle'});
    assert.deepEqual(await page.evaluate(()=>[innerWidth,innerHeight]),[viewport.width,viewport.height]);
    assert.equal((await page.getByRole('heading',{level:1}).innerText()).replace(/\s+/g,''),'เทียนหอมแสงเช้า');
    assert.equal(await page.locator('[data-content-set="1"]').count(),1);
    assert.equal(await page.locator('[data-content-set="2"]').count(),0);
    const disclosure=page.locator('.demo-disclosure').first();
    assert.equal(await disclosure.isVisible(),true,`${viewport.name} demo disclosure is visible`);
    assert.match(await disclosure.innerText(),/ตัวอย่างสาธิต.*แบรนด์และสินค้าสมมติ/s);
    const productAction=page.locator('.demo-product-action'),contactAction=page.locator('.demo-contact-action');
    assert.equal(await productAction.count(),1);
    assert.equal(await contactAction.count(),1);
    assert.equal(await productAction.getAttribute('href'),'#demo-details');
    assert.equal(await contactAction.getAttribute('href'),'#demo-contact');
    await productAction.focus();assert.equal(await productAction.evaluate(link=>link.matches(':focus-visible')),true);
    await productAction.click();assert.equal(new URL(page.url()).hash,'#demo-details');assert.equal(await page.locator('#demo-details').isVisible(),true);
    await contactAction.click();assert.equal(new URL(page.url()).hash,'#demo-contact');assert.match(await page.locator('#demo-contact').innerText(),/ไม่มีการสั่งซื้อหรือส่งข้อความจริง/);
    const geometry=await page.evaluate(()=>{
      const hero=document.querySelector('.demo-hero'),art=document.querySelector('.product-art'),disclosure=document.querySelector('.demo-disclosure'),contact=document.querySelector('#demo-contact');
      const boxes=[hero,art,disclosure,contact].map(node=>node.getBoundingClientRect());
      return{overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,positive:boxes.every(box=>box.width>0&&box.height>0),inside:boxes.every(box=>box.left>=-0.5&&box.right<=innerWidth+.5),bodyHeight:document.body.scrollHeight};
    });
    assert.equal(geometry.overflow,false,`${viewport.name} no horizontal overflow`);
    assert.equal(geometry.positive,true,`${viewport.name} main regions render`);
    assert.equal(geometry.inside,true,`${viewport.name} main regions stay inside viewport`);
    assert.ok(geometry.bodyHeight>viewport.height,`${viewport.name} full demo story renders`);
    assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedRequests,[]);assert.deepEqual(badResponses,[]);
    await page.screenshot({path:`.tmp-codex/smartlinkpage-demo-${viewport.name}.png`,fullPage:true});
    await page.close();
  }
  console.log('PASS SmartLinkPage installed-Chrome desktop/mobile static demo, accessibility, safe actions and clean console/network');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
