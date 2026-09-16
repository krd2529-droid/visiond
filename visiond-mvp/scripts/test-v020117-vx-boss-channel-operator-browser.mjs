import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of[process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
if(!chromium)throw new Error('Installed Chrome through Playwright is required');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public');
const user={id:10,email:'testervx@gmail.com',username:'Testervx',name:'Testervx',phone:'',role:'user'},workspace={delegated:true,scope:'boss_tiktok_channel_operator',landing_path:'/tiktok-analyzer.html'};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});

async function install(page,requests){
 await page.route('https://visiondonline.com/**',async route=>{
  const url=new URL(route.request().url()),pathname=url.pathname;requests.push(pathname);
  if(pathname==='/api/auth/me')return route.fulfill({status:200,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify({user,vx_workspace:workspace})});
  if(pathname==='/api/launcher/helpers')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],has_more:false,next_cursor:null})});
  if(pathname==='/api/admin/tiktok-analyzer')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({channels:[],pagination:{limit:24,has_more:false,next_cursor:null},provider_configured:true,workspace:{delegated:true,scope:'boss_tiktok_channel_operator',can_create_channel:false,can_delete_channel:false,can_view_commission:false}})});
  if(pathname.startsWith('/api/'))return route.fulfill({status:418,contentType:'application/json',body:JSON.stringify({error:'unexpected '+pathname})});
  const relative=pathname==='/'?'/index.html':pathname,local=path.resolve(publicRoot,'.'+relative);
  if(!local.startsWith(publicRoot)||!fs.existsSync(local))return route.fulfill({status:404,body:'not found'});
  const contentType={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[path.extname(local)]||'application/octet-stream';
  return route.fulfill({status:200,contentType,body:fs.readFileSync(local)});
 });
}

try{
 for(const viewport of[{width:1280,height:800},{width:390,height:844}]){
  const context=await browser.newContext({viewport,locale:'th-TH'}),page=await context.newPage(),requests=[];await install(page,requests);
  await page.goto('https://visiondonline.com/dashboard.html');await page.waitForFunction(()=>document.body.classList.contains('vx-operator-dashboard'));
  assert.equal(await page.locator('#vxOperatorLink').isVisible(),true);assert.equal(await page.locator('#controlCenterLink').isVisible(),false);assert.equal(await page.locator('#vxAffiliateCard').isVisible(),false);assert.equal(await page.locator('.topbar nav').isVisible(),false);assert.match(await page.locator('#dashboardGuide').textContent(),/ศูนย์ปฏิบัติการ VX/);
  assert.deepEqual(requests.filter(item=>item.startsWith('/api/')),['/api/auth/me'],'operator landing must not request orders, course, finance, notifications or chat data');
  assert.ok(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth),'operator landing must not overflow '+viewport.width);
  await context.close();
 }

 const context=await browser.newContext({viewport:{width:390,height:844},locale:'th-TH'}),page=await context.newPage(),requests=[],pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));await install(page,requests);
 await page.goto('https://visiondonline.com/tiktok-analyzer.html');await page.waitForFunction(()=>!document.body.classList.contains('access-pending')&&document.body.classList.contains('vx-workspace-delegate'));await page.waitForFunction(()=>document.querySelector('#channels')?.textContent.includes('ช่อง Boss'));
 assert.equal(await page.locator('#workspaceBackLink').getAttribute('href'),'/dashboard.html');assert.match(await page.locator('#workspaceBackLink').textContent(),/ศูนย์ผู้ปฏิบัติงาน VX/);assert.match(await page.locator('#workspaceChannelTitle').textContent(),/Boss/);assert.equal(await page.locator('#newChannel').isVisible(),false);assert.equal(await page.getByText('ดูค่าคอม (Boss Test)',{exact:true}).count(),0);assert.equal(await page.locator('#shopDashboard').isVisible(),false);
 const apiRequests=requests.filter(item=>item.startsWith('/api/'));assert.ok(apiRequests.includes('/api/auth/me'));assert.ok(apiRequests.includes('/api/launcher/helpers'));assert.ok(apiRequests.includes('/api/admin/tiktok-analyzer'));for(const forbidden of['/api/vtools','/api/orders','/api/vx/referrals','/api/admin/tiktok-commissions','/api/admin/tiktok-partner-commissions','/api/admin/tiktok-commission-cards'])assert.equal(apiRequests.some(item=>item.startsWith(forbidden)),false,forbidden);
 assert.ok(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth),'390px analyzer must not overflow');assert.deepEqual(pageErrors,[]);
 await context.close();
}finally{await browser.close()}
console.log('PASS v0.20.120 installed Chrome restricted Testervx landing/analyzer at desktop and 390px with no unrelated or commission requests');
