import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of[process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
if(!chromium)throw new Error('Installed Chrome through Playwright is required');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),publicRoot=path.join(root,'public');
const channelId='10000000-0000-4000-8000-000000000001',connectionId='20000000-0000-4000-8000-000000000001';
const revisionA='a'.repeat(64),revisionB='b'.repeat(64),avatarUrl=revision=>`/api/admin/tiktok-avatar/${connectionId}?v=${revision}`;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});

function json(route,value,status=200){return route.fulfill({status,contentType:'application/json',headers:{'cache-control':'private, no-store'},body:JSON.stringify(value)})}
async function install(page,requests,{delegated,broken=false,syncFails=false}){
 const workspace={delegated,scope:delegated?'boss_tiktok_channel_operator':'self',can_create_channel:!delegated,can_delete_channel:!delegated,can_view_commission:!delegated};
 const user=delegated?{id:10,email:'testervx@gmail.com',username:'Testervx',name:'Testervx',role:'user'}:{id:1,email:'boss@example.com',username:'Boss',name:'Boss',role:'boss'};
 let revision=revisionA;
 const channel=()=>({id:channelId,name:'ช่อง Boss',channel_url:'https://www.tiktok.com/@boss',display_name:'Boss Creator',avatar_url:avatarUrl(revision),tiktok_connected:true,follower_count:120,following_count:3,likes_count:450,video_count:8,analysis_count:2});
 const connection=()=>({id:connectionId,channel_id:channelId,display_name:'Boss Creator',avatar_url:avatarUrl(revision),scopes:'user.info.basic user.info.profile user.info.stats video.list',follower_count:120,following_count:3,likes_count:450,video_count:8,last_synced_at:'2026-09-14 10:00:00'});
 await page.route('https://visiondonline.com/**',async route=>{
  const request=route.request(),url=new URL(request.url()),pathname=url.pathname;requests.push({method:request.method(),url:pathname+url.search,postData:request.postData()||''});
  if(pathname==='/api/auth/me')return json(route,{user,vx_workspace:workspace});
  if(pathname==='/api/vtools')return json(route,{access:{admin:true,active:true}});
  if(pathname==='/api/launcher/helpers')return json(route,{items:[],has_more:false,next_cursor:null});
  if(pathname==='/api/admin/tiktok-analyzer'){
   const resource=url.searchParams.get('resource');
   if(resource==='overview')return json(route,{channel:channel(),products:[],product_events:[],runs:[],pagination:{products:{has_more:false,next_cursor:null},events:{has_more:false,next_cursor:null}}});
   if(resource==='shortlist'||resource==='inventory')return json(route,{channel_id:channelId,products:[],product_events:[],inventory_counts:{},pagination:{products:{has_more:false,next_cursor:null},events:{has_more:false,next_cursor:null}}});
   return json(route,{channels:[channel()],pagination:{limit:24,has_more:false,next_cursor:null},provider_configured:true,workspace});
  }
  if(pathname==='/api/admin/tiktok-connections'&&request.method()==='GET')return json(route,{connections:[connection()],shop_connections:[],videos:[],shop_products:[],configured:true,shop_configured:false,connection_pagination:{limit:24,has_more:false,next_cursor:null},shop_connection_pagination:{limit:24,has_more:false,next_cursor:null}});
  if(pathname==='/api/admin/tiktok-connections'&&request.method()==='POST'){
   if(syncFails)return json(route,{error:'TikTok ไม่ตอบสนอง กรุณาลองอีกครั้ง'},503);
   revision=revisionB;return json(route,{connection:connection(),avatar_update:{mirrored:true,reason:'updated'}});
  }
  if(pathname===`/api/admin/tiktok-avatar/${connectionId}`){if(broken&&url.searchParams.get('v')===revisionA)return route.fulfill({status:404,headers:{'cache-control':'private, no-store'}});return route.fulfill({status:200,contentType:'image/png',headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'},body:png})}
  if(pathname.startsWith('/api/'))return json(route,{error:'unexpected '+pathname},418);
  const relative=pathname==='/'?'/index.html':pathname,local=path.resolve(publicRoot,'.'+relative);
  if(!local.startsWith(publicRoot)||!fs.existsSync(local))return route.fulfill({status:404,body:'not found'});
  const contentType={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'}[path.extname(local)]||'application/octet-stream';
  return route.fulfill({status:200,contentType,body:fs.readFileSync(local)});
 });
}

async function exercise({delegated,viewport,broken=false,syncFails=false}){
 const context=await browser.newContext({viewport,locale:'th-TH'}),page=await context.newPage(),requests=[],errors=[];page.on('pageerror',error=>errors.push(error.message));await install(page,requests,{delegated,broken,syncFails});
 try{
  await page.goto('https://visiondonline.com/tiktok-analyzer.html');
  await page.waitForFunction(()=>document.querySelector('#syncTikTokProfile')&&!document.querySelector('#syncTikTokProfile').hidden);
  assert.equal(await page.locator('.channel-card .channel-avatar').count(),1);assert.equal(await page.locator('.analysis-channel-option .channel-avatar').count(),1);
  assert.equal(await page.locator('.channel-avatar-fallback').count(),2,'both card locations always keep initials fallback');
  if(broken)await page.waitForFunction(()=>document.querySelectorAll('img[data-channel-avatar]').length===0);
  else{await page.waitForFunction(()=>[...document.querySelectorAll('img[data-channel-avatar]')].every(img=>img.complete&&img.naturalWidth>0));assert.equal(await page.locator(`img[src="${avatarUrl(revisionA)}"]`).count(),2)}
  assert.equal(await page.getByRole('button',{name:'รีเฟรชสถานะช่อง'}).count(),1,'Helper refresh remains separate');
  assert.equal(await page.locator('#syncTikTokProfile').count(),1);assert.equal(await page.locator('#syncTikTokProfile').isVisible(),true);
  const before=await page.locator('body').innerHTML();assert.doesNotMatch(before,/tiktokcdn|avatar_object_key|\.r2\./i);
  await page.locator('#syncTikTokProfile').click();
  if(syncFails){await page.waitForFunction(()=>document.querySelector('#tiktokProfileSyncStatus')?.textContent.includes('ไม่สำเร็จ'));assert.equal(await page.locator('img[data-channel-avatar]').count(),broken?0:2,'failed sync preserves existing visual state')}
  else{await page.waitForFunction(({id,rev})=>document.querySelectorAll(`img[src="/api/admin/tiktok-avatar/${id}?v=${rev}"]`).length===2,{id:connectionId,rev:revisionB});assert.equal(await page.locator(`img[src="${avatarUrl(revisionB)}"]`).count(),2,'successful sync rerenders both card locations');assert.match(await page.locator('#tiktokProfileSyncStatus').textContent(),/อัปเดตรูปและข้อมูล TikTok แล้ว/)}
  const serialized=JSON.stringify(requests);assert.doesNotMatch(serialized,/tiktokcdn|avatar_object_key|\.r2\./i);assert.equal(requests.filter(item=>item.method==='POST'&&item.url==='/api/admin/tiktok-connections').length,1);
  assert.ok(await page.locator('body').evaluate(body=>body.scrollWidth<=innerWidth),`${viewport.width}px analyzer must not overflow`);assert.deepEqual(errors,[]);
 }finally{await context.close()}
}

try{
 await exercise({delegated:false,viewport:{width:1280,height:800}});
 await exercise({delegated:true,viewport:{width:390,height:844}});
 await exercise({delegated:true,viewport:{width:390,height:844},broken:true,syncFails:true});
}finally{await browser.close()}
console.log('PASS v0.20.120 installed Chrome Boss/Testervx avatar mirror, both-card sync, broken-image fallback, truthful failure and 390px layout');
