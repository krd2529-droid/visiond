import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}assert.ok(chromium,'installed Chrome required');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public'),adminScript=fs.readFileSync(path.join(publicRoot,'vpage-admin.js'),'utf8');assert.doesNotMatch(adminScript,/grantForm\.(?:user_id|quantity)|Number\(values\.user_id\)/,'grant authority must not depend on form named properties or hidden input state');assert.match(adminScript,/selectedGrantUserId/);let grants=0,grantPosts=0,lastGrant=null;
const json=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store'});res.end(JSON.stringify(body))};
const server=http.createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/auth/me')return json(res,200,{user:{id:1,name:'Boss Vpage',role:'boss'}});
  if(url.pathname==='/api/admin/vpage/customers'){const q=url.searchParams.get('q');return json(res,200,{items:q==='user2'?[{id:902,name:'ลูกค้า Vpage',username:'user2',email:'user2@example.test'}]:q==='shared-identity'?[{id:905,name:'Username Match',username:'shared-identity',email:'first@example.test'},{id:906,name:'Email Match',username:'email-match',email:'shared-identity'}]:[]})}
  if(url.pathname==='/api/admin/vpage/credits'&&req.method==='POST'){grantPosts++;let raw='';for await(const chunk of req)raw+=chunk;lastGrant=JSON.parse(raw);assert.match(req.headers['idempotency-key']||'',/^vpage-grant:/);grants+=lastGrant.quantity;return json(res,201,{credits_added:lastGrant.quantity,credit_balance:grants,replayed:false})}
  if(url.pathname==='/api/admin/vpage/credits')return json(res,200,{items:grants?[{id:1,user_id:902,status:'available',service_days:30,customer_name:'ลูกค้า Vpage',customer_email:'user2@example.test',source_type:'boss_grant',granted_by_name:'Boss Vpage',note:lastGrant?.note||''}]:[],pagination:{limit:24,has_more:false,next_cursor:null}});
  if(url.pathname==='/api/admin/vpage/pages')return json(res,200,{items:[],pagination:{limit:24,has_more:false,next_cursor:null}});
  const relative=url.pathname==='/'?'/vpage-admin.html':url.pathname,local=path.resolve(publicRoot,`.${relative}`);if(!local.startsWith(publicRoot)||!fs.existsSync(local)){res.writeHead(404);return res.end('not found')}const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[path.extname(local)]||'application/octet-stream';res.writeHead(200,{'content-type':type});res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());await page.goto(`${base}/vpage-admin.html`);
  assert.match(await page.locator('link[href^="/vpage.css"]').getAttribute('href'),/\?v=020170$/);assert.match(await page.locator('script[src^="/vpage-admin.js"]').getAttribute('src'),/\?v=020170$/);
  await page.waitForFunction(()=>document.querySelector('#vpageGrantSection')?.hidden===false);
  const grantForm=page.locator('#vpageGrantForm'),search=page.getByRole('textbox',{name:'ค้นหาลูกค้าด้วย ID, Username หรืออีเมล'});
  assert.equal(await grantForm.isHidden(),true,'grant form stays invisible before customer search/selection');assert.equal(grantPosts,0);
  await grantForm.evaluate(form=>form.requestSubmit());await page.waitForFunction(()=>document.querySelector('#vpageGrantMessage')?.textContent.includes('กรุณาเลือกลูกค้า'));
  assert.equal(grantPosts,0,'invalid hidden form cannot POST before customer selection');assert.match(await page.locator('#vpageGrantMessage').innerText(),/กรุณาเลือกลูกค้าสำหรับเพิ่มเครดิต Vpage ก่อน/);
  await search.fill('shared-identity');await page.getByRole('button',{name:'ค้นหาลูกค้าสำหรับเครดิต Vpage'}).click();await page.waitForFunction(()=>document.querySelectorAll('.vpage-customer-choice').length===2);
  assert.equal(await page.locator('.vpage-customer-choice').count(),2,'ambiguous exact identity returns explicit customer choices');assert.equal(await grantForm.isHidden(),true,'search results do not reveal grant form before explicit selection');assert.equal(grantPosts,0);
  await search.fill('user2');await page.getByRole('button',{name:'ค้นหาลูกค้าสำหรับเครดิต Vpage'}).click();await grantForm.locator('[name="user_id"]').evaluate(input=>Object.defineProperty(input,'value',{configurable:true,get:()=>'',set:()=>{}}));await page.getByRole('button',{name:/เลือกเพื่อเพิ่มเครดิต Vpage/}).click();
  assert.equal(await grantForm.locator('[name="user_id"]').inputValue(),'','fixture simulates IAB hidden input value not sticking');assert.equal(await grantForm.isVisible(),true,'explicit customer selection reveals grant form');
  await page.getByRole('spinbutton',{name:'จำนวนเครดิต Vpage'}).fill('2');await page.getByRole('textbox',{name:'หมายเหตุเครดิต Vpage'}).fill('ทดสอบเครดิต Vpage');await page.getByRole('button',{name:'+ เพิ่มเครดิต Vpage'}).click();
  await page.waitForFunction(()=>document.querySelector('#vpageGrantMessage')?.textContent.includes('เพิ่มเครดิต Vpage 2 เครดิตสำเร็จ'));assert.equal(grantPosts,1,'selected customer produces exactly one grant POST');assert.deepEqual(lastGrant,{user_id:902,quantity:2,note:'ทดสอบเครดิต Vpage'});
  assert.match(await page.locator('#vpageAdminCredits').innerText(),/เครดิต Vpage พร้อมใช้/);assert.match(await page.locator('#vpageAdminCredits').innerText(),/Boss เพิ่มเครดิต Vpage/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);assert.deepEqual(errors,[]);await context.close();console.log('PASS Boss mobile Vpage-credit hidden-before-selection guard, explicit collision choices, confirmation, grant and history refresh')
}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
