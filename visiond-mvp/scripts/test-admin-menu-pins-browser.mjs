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
const injected='<a class="admin-tab-link" href="/vision7-admin.html"><span class="admin-tab-icon">🔑</span><span>Vision 7</span></a><a class="admin-tab-link" href="/ads-center.html"><span class="admin-tab-icon">📣</span><span>โฆษณา</span></a>';
const html=fs.readFileSync(path.join(publicRoot,'admin.html'),'utf8').replace(/(<\/nav>\s*<p id="adminPinnedEmpty")/,`${injected}$1`);
let apiWrites=0;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')){
    if(req.method!=='GET')apiWrites++;
    const cookies=Object.fromEntries((req.headers.cookie||'').split(';').map(item=>item.trim().split('=')));
    const body=url.pathname==='/api/auth/me'?{user:{id:Number(cookies.uid||1),name:'Menu Tester',role:cookies.role||'boss'}}:url.pathname==='/api/admin/basket-visibility'?{storefront_paused:false,storefront_manual_paused:false}: {items:[],pagination:{limit:24,has_more:false,next_cursor:null}};
    res.writeHead(200,{'content-type':'application/json','cache-control':'private, no-store'});return res.end(JSON.stringify(body));
  }
  if(url.pathname==='/admin.html'||url.pathname==='/admin'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(html);
  }
  const local=path.resolve(publicRoot,`.${url.pathname}`);
  if(!local.startsWith(publicRoot)||!fs.existsSync(local)){res.writeHead(404);return res.end('not found')}
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(local)]||'application/octet-stream';
  res.writeHead(200,{'content-type':type});res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:width===390?844:900}});
    await context.addCookies([{name:'uid',value:'1',url:base},{name:'role',value:'boss',url:base}]);
    const page=await context.newPage();
    await page.goto(`${base}/admin.html`);
    await page.waitForSelector('.admin-menu-item .admin-pin-toggle');
    assert.equal(await page.locator('.admin-menu-item').count(),36,'static plus middleware destinations');
    assert.equal(await page.locator('.admin-tabs > [data-admin-pinned-id]').count(),12,'initial top destinations pinned');
    assert.equal(await page.locator('#digitalStorefrontEmergency').count(),1);
    assert.equal(await page.locator('#digitalStorefrontEmergency').locator('..').evaluate(node=>node.classList.contains('admin-menu-item')),false,'emergency action is not pinnable');
    assert.equal(await page.locator('#d1QuotaBreakerRefresh').locator('..').evaluate(node=>node.classList.contains('admin-menu-item')),false,'D1 refresh is not pinnable');
    const overview=page.locator('.admin-menu-item:has(> [data-admin-tab="overview"])');
    const pin=overview.locator('.admin-pin-toggle');
    await pin.focus();await page.keyboard.press('Enter');
    assert.equal(await pin.getAttribute('aria-pressed'),'true');
    const shortcut=page.locator('.admin-tabs > [data-admin-pinned-id="tab:overview"]');
    await shortcut.locator('.admin-pinned-shortcut').click();
    assert.equal(await page.locator('[data-admin-tab="overview"]').getAttribute('class').then(x=>x.includes('active')),true,'shortcut opens original tab');
    assert.equal(await page.locator('#overviewPanel').isHidden(),false);
    await shortcut.locator('.admin-pinned-unpin').focus();await page.keyboard.press('Space');
    assert.equal(await pin.getAttribute('aria-pressed'),'false');
    assert.equal(await shortcut.count(),0,'unpin removes only shortcut');
    assert.equal(await overview.locator('> button[data-admin-tab]').count(),1,'full menu remains reachable');
    await page.reload();await page.waitForSelector('.admin-menu-item .admin-pin-toggle');
    assert.equal(await shortcut.count(),0,'unpin persists after reload');
    const fragment=page.locator('.admin-menu-item:has(> a[href="/admin-courses.html#companyCourseCreate"])');
    await fragment.locator('.admin-pin-toggle').click();
    const fragmentShortcut=page.locator('.admin-tabs > .admin-pinned-item > a[href="/admin-courses.html#companyCourseCreate"]');
    assert.equal(await fragmentShortcut.count(),1,'fragment destination can be pinned');
    assert.equal(await fragmentShortcut.getAttribute('href'),'/admin-courses.html#companyCourseCreate');
    const bossId=await page.locator('.admin-menu-item:has(> a[href="/vpage-admin.html"]) .admin-pin-toggle').evaluate(node=>node.parentElement.querySelector('a').getAttribute('href'));
    assert.equal(bossId,'/vpage-admin.html');
    const bossPinId=await page.evaluate(()=>[...document.querySelectorAll('.admin-tabs > [data-admin-pinned-id]')].find(node=>node.querySelector('a[href="/vpage-admin.html"]'))?.dataset.adminPinnedId);
    const linkPage=await context.newPage();
    await linkPage.goto(`${base}/admin.html`);
    await linkPage.waitForSelector('.admin-tabs > .admin-pinned-item > a[href="/admin-courses.html#companyCourseCreate"]');
    await linkPage.locator('.admin-tabs > .admin-pinned-item > a[href="/admin-courses.html#companyCourseCreate"]').click();
    await linkPage.waitForURL('**/admin-courses.html#companyCourseCreate');
    assert.equal(new URL(linkPage.url()).hash,'#companyCourseCreate','pinned link keeps its original fragment destination');
    await linkPage.close();
    await context.addCookies([{name:'role',value:'admin',url:base}]);
    await page.reload();await page.waitForSelector('.admin-menu-item .admin-pin-toggle');
    assert.equal(await page.locator('.admin-tabs > .admin-pinned-item > a[href="/vpage-admin.html"]').count(),0,'demoted Admin cannot see prior Boss shortcut');
    await page.locator('.admin-menu-item:has(> [data-admin-tab="overview"]) .admin-pin-toggle').click();
    await context.addCookies([{name:'role',value:'boss',url:base}]);
    await page.reload();await page.waitForSelector('.admin-menu-item .admin-pin-toggle');
    assert.equal(await page.locator('.admin-tabs > .admin-pinned-item > a[href="/vpage-admin.html"]').count(),1,'Boss pin survives role change and Admin pin edit');
    await page.evaluate(id=>localStorage.setItem('visiond:admin:pins:v1:2',JSON.stringify([id,'tab:overview'])),bossPinId);
    await context.addCookies([{name:'uid',value:'2',url:base},{name:'role',value:'admin',url:base}]);
    await page.reload();await page.waitForSelector('.admin-menu-item .admin-pin-toggle');
    assert.equal(await page.locator('.admin-tabs > [data-admin-pinned-id]').count(),1,'preferences isolated to second user and invalid Boss pin filtered');
    assert.equal(await page.locator('.admin-tabs > [data-admin-pinned-id="tab:overview"]').count(),1);
    assert.equal(await page.locator('.admin-menu-item:has(> a[href="/vpage-admin.html"])').count(),0,'Boss destination not offered to Admin');
    assert.equal(await page.locator('.admin-all-grid > a[href="/vpage-admin.html"]').isVisible(),false,'Boss destination remains hidden');
    await page.evaluate(id=>localStorage.setItem('visiond:admin:pins:v1:2',JSON.stringify([...Array(100).fill(id),'tab:overview'])),bossPinId);
    await page.reload();await page.waitForSelector('.admin-menu-item .admin-pin-toggle');
    await page.locator('.admin-menu-item:has(> [data-admin-tab="overview"]) .admin-pin-toggle').click();
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('visiond:admin:pins:v1:2'))),[bossPinId],'saved hidden IDs are deduplicated and bounded');
    await page.evaluate(()=>localStorage.setItem('visiond:admin:pins:v1:2','[]'));
    await page.reload();await page.waitForSelector('.admin-menu-item .admin-pin-toggle');
    assert.equal(await page.locator('.admin-tabs > [data-admin-pinned-id]').count(),0);
    assert.equal(await page.locator('#adminPinnedEmpty').isVisible(),true,'empty state visible');
    assert.equal(await page.locator('.admin-menu-item').count(),32,'Admin has every non-Boss destination');
    assert.equal(await page.evaluate(()=>document.querySelector('.admin-menu-board').scrollWidth>document.querySelector('.admin-menu-board').clientWidth),false,'all-menu grid fits viewport');
    await context.close();
  }
  assert.equal(apiWrites,0,'pin actions make no business API writes');
  console.log('PASS admin menu pins: desktop/mobile, keyboard, reload, identity, role, links, empty state');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
