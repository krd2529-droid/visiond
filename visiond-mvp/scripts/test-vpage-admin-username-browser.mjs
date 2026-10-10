import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);let chromium;for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}assert.ok(chromium);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public'),items=[{id:'vpl_'+'1'.repeat(32),user_id:7,display_name:'First page',customer_name:'Customer Name',customer_email:'first@example.test',customer_username:'customer-seven'},{id:'vpl_'+'2'.repeat(32),user_id:8,display_name:'Missing username',customer_name:'Missing Name',customer_email:'missing@example.test',customer_username:null},{id:'vpl_'+'3'.repeat(32),user_id:9,display_name:'Escaped username',customer_name:'Safe Name',customer_email:'safe@example.test',customer_username:'<img src=x onerror=alert(1)>'}];let writes=0;
const json=(res,data)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(data))};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');if(req.method!=='GET'){writes++;res.writeHead(405);return res.end()}
  if(url.pathname==='/api/auth/me')return json(res,{user:{id:1,role:'boss'}});
  if(url.pathname==='/api/admin/vpage/pages')return json(res,{items,pagination:{has_more:false,next_cursor:null}});
  if(url.pathname==='/api/admin/vpage/credits')return json(res,{items:[],pagination:{has_more:false,next_cursor:null}});
  const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end()}res.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{for(const viewport of [{width:1440,height:900},{width:390,height:844}]){const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`http://127.0.0.1:${server.address().port}/vpage-admin.html`);await page.waitForSelector('[data-boss-customer]');const rows=page.locator('[data-boss-customer]');assert.equal(await rows.count(),3);assert.match(await rows.nth(0).innerText(),/ลูกค้า #7 · Customer Name · Username: customer-seven/);assert.match(await rows.nth(1).innerText(),/ลูกค้า #8 · Missing Name · Username: -/);assert.match(await rows.nth(2).innerText(),/Username: <img src=x onerror=alert\(1\)>/);assert.equal(await rows.nth(2).locator('img').count(),0,'username cannot inject markup');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);await page.close()}assert.equal(writes,0);console.log('PASS Boss Vpage username desktop/mobile, missing fallback, escaped output and zero writes')}
finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
