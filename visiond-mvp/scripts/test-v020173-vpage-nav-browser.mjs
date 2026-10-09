import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){
  try{({chromium}=require(candidate));break}catch{}
}
assert.ok(chromium,'installed Chrome required');

const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const shared=fs.readFileSync(path.join(publicRoot,'shared-nav.js'),'utf8');
const home=fs.readFileSync(path.join(publicRoot,'index.html'),'utf8');
const vpageHtml=fs.readFileSync(path.join(publicRoot,'vpage.html'),'utf8');
const expectedConsumers=['about.html','blog.html','bots.html','contact.html','course-center.html','course-seller.html','course.html','courses.html','digital-products.html','guides.html','index.html','my-courses.html','privacy.html','terms.html','vedit.html','vpage.html'].sort();
const consumers=fs.readdirSync(publicRoot).filter(name=>name.endsWith('.html')&&fs.readFileSync(path.join(publicRoot,name),'utf8').includes('shared-nav.js?v=')).sort();

assert.deepEqual(consumers,expectedConsumers,'focused contract enumerates every shared-nav consumer');
for(const name of consumers){
  const html=fs.readFileSync(path.join(publicRoot,name),'utf8');
  assert.equal((html.match(/shared-nav\.js\?v=020174/g)||[]).length,1,`${name} loads the updated shared navigation exactly once`);
  assert.doesNotMatch(html,/shared-nav\.js\?v=020(?:57|173)/,`${name} is not pinned to an old cache key`);
}
assert.equal((shared.match(/'\/vpage','Vpage'/g)||[]).length,1,'canonical shared navigation contains exactly one Vpage entry');
assert.match(shared,/ศูนย์จัดการคอร์ส'\],\['nav-vpage-link','\/vpage','Vpage'\],\['nav-vedit-link','\/vedit','Vedit'\],\['','\/courses\.html'/,'canonical shared navigation preserves the primary row around Vpage');
assert.match(home,/ศูนย์จัดการคอร์ส<\/a[\s\S]*?<a class="nav-vpage-link" href="\/vpage">Vpage<\/a>[\s\S]*?<a class="nav-vedit-link" href="\/vedit">Vedit<\/a>[\s\S]*?<a href="\/courses\.html">ระบบ V-Learning<\/a>/,'main first-paint navigation preserves order around Vpage');
assert.match(vpageHtml,/mobile-storefront\.css\?v=014407/,'Vpage loads the canonical mobile header styles');
assert.match(vpageHtml,/header-shell\.css\?v=014578/,'Vpage loads the canonical desktop header styles');
assert.match(vpageHtml,/vpage\.css\?v=020178[\s\S]*mobile-storefront\.css\?v=014407[\s\S]*header-shell\.css\?v=014578[\s\S]*frontend-theme\.css\?v=020159/,'Vpage loads the preview CSS while preserving the proven public header stylesheet cascade');
assert.match(vpageHtml,/vpage\.js\?v=020172[\s\S]*shared-nav\.js\?v=020174/,'Vpage loads the preview runtime and then the canonical navigation');
assert.match(vpageHtml,/shared-nav\.js\?v=020174/,'Vpage loads the canonical navigation runtime');
assert.match(vpageHtml,/header-shell\.js\?v=014578/,'Vpage loads the canonical header shell runtime');
assert.match(vpageHtml,/mobile-storefront\.js\?v=014407/,'Vpage loads the canonical mobile drawer runtime');
assert.equal((vpageHtml.match(/id="createVpageForm"/g)||[]).length,1,'Vpage form remains present exactly once');

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'};
const server=http.createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')){
    let payload={items:[],products:[],courses:[],balance:0,pagination:{limit:24,has_more:false,next_cursor:null}};
    if(url.pathname==='/api/auth/me')payload={user:null};
    if(url.pathname==='/api/vpage/offer')payload={item:{slug:'vpage-credit',price:99900}};
    response.writeHead(200,{'content-type':'application/json','cache-control':'private, no-store'});
    response.end(JSON.stringify(payload));
    return;
  }
  const pathname=['/','/index.html'].includes(url.pathname)?'/index.html':['/vpage','/vpage.html'].includes(url.pathname)?'/vpage.html':url.pathname;
  const local=path.resolve(publicRoot,`.${pathname}`);
  const relative=path.relative(publicRoot,local);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(local)){
    response.writeHead(404,{'content-type':'text/plain; charset=utf-8'});
    response.end('not found');
    return;
  }
  response.writeHead(200,{'content-type':types[path.extname(local)]||'application/octet-stream'});
  response.end(fs.readFileSync(local));
});

await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});

try{
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
    const context=await browser.newContext({viewport,locale:'th-TH'});
    await context.route('https://**/*',route=>route.fulfill({status:204,body:''}));
    const page=await context.newPage();
    const errors=[],failed=[],bad=[];
    let committedClickDetach=0;
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
    page.on('requestfailed',request=>{
      const error=request.failure()?.errorText||'unknown';
      if(request.isNavigationRequest()&&request.url()===`${base}/vpage`&&error==='net::ERR_ABORTED'){
        committedClickDetach+=1;
        return;
      }
      if(request.url().startsWith(base))failed.push(`${request.url()} ${error}`);
    });
    page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=400)bad.push(`${response.status()} ${response.url()}`)});

    await page.goto(base);
    await page.locator('.topbar.header-shell-ready.mobile-nav-ready').waitFor({state:'attached'});
    await page.locator('.topbar nav[data-account-ready="1"]').waitFor({state:'attached'});
    const entry=page.locator('.topbar .nav-vpage-link');
    await entry.waitFor({state:viewport.width<=800?'attached':'visible'});
    assert.equal(await entry.count(),1,'main header has one Vpage entry');
    assert.equal((await entry.textContent()).trim(),'Vpage');
    assert.equal(await entry.getAttribute('href'),'/vpage');
    if(viewport.width<=800){
      const mainToggle=page.locator('.mobile-nav-toggle');
      assert.equal(await mainToggle.getAttribute('aria-label'),'เปิดเมนูหลัก');
      await mainToggle.click();
      assert.equal(await mainToggle.getAttribute('aria-expanded'),'true');
      await entry.waitFor({state:'visible'});
    }
    await entry.click({noWaitAfter:true});
    await page.waitForFunction(()=>location.pathname==='/vpage'&&document.querySelector('#createVpageForm'));

    for(const pathname of ['/vpage','/vpage.html']){
      if(new URL(page.url()).pathname!==pathname)await page.goto(`${base}${pathname}`);
      await page.locator('.topbar.header-shell-ready.mobile-nav-ready').waitFor({state:'attached'});
      await page.locator('.topbar nav[data-account-ready="1"]').waitFor({state:'attached'});
      await page.locator('.topbar .vd-language-switcher').waitFor({state:'attached'});
      const current=page.locator('.topbar .nav-vpage-link');
      assert.equal(await current.count(),1,`${pathname} has one Vpage entry`);
      assert.equal(await current.getAttribute('aria-current'),'page',`${pathname} marks Vpage current`);
      assert.deepEqual(await page.locator('.topbar>nav>a').evaluateAll(nodes=>nodes.slice(0,4).map(node=>new URL(node.href).pathname.replace(/\.html$/,''))),['/','/digital-products','/course-center','/vpage']);
      for(const selector of ['#navLogin','#navRegister','.cart-nav','.vd-language-switcher'])assert.equal(await page.locator(`.topbar ${selector}`).count(),1,`${selector} is not duplicated`);
      assert.equal(await page.locator('#createVpageForm').count(),1,'Vpage form remains below the shared header');
      const headerVisual=await page.locator('.topbar').evaluate(node=>({height:node.getBoundingClientRect().height,background:getComputedStyle(node).backgroundImage}));
      assert.ok(headerVisual.height>=100,'established full-height VisionD header is visible');
      assert.notEqual(headerVisual.background,'none','established VisionD header gradient is applied');
      if(viewport.width<=800){
        const toggle=page.locator('.mobile-nav-toggle');
        await toggle.waitFor({state:'visible'});
        assert.equal(await toggle.getAttribute('aria-label'),'เปิดเมนูหลัก');
        assert.equal(await page.locator('.topbar>nav').getAttribute('aria-hidden'),'true');
        await toggle.click();
        await current.waitFor({state:'visible'});
        assert.equal(await toggle.getAttribute('aria-expanded'),'true');
        assert.equal(await toggle.getAttribute('aria-label'),'ปิดเมนูหลัก');
        await page.keyboard.press('Escape');
        await page.waitForFunction(()=>document.querySelector('.mobile-nav-toggle')?.getAttribute('aria-expanded')==='false');
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        assert.equal(await toggle.getAttribute('aria-label'),'เปิดเมนูหลัก');
      }else{
        assert.equal(await current.isVisible(),true);
        assert.equal(await page.locator('.mobile-nav-toggle').isVisible(),false);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false,'page has no horizontal overflow');
    }
    assert.ok(committedClickDetach<=1,'actual Vpage click has at most the known committed-document detach signal');
    assert.deepEqual(errors,[]);
    assert.deepEqual(failed,[]);
    assert.deepEqual(bad,[]);
    await context.close();
  }
  console.log('PASS Vpage canonical public header/nav on desktop and mobile, actual main click, current state, utilities, drawer, overflow and clean runtime');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
