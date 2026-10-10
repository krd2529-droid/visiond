import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)){try{({chromium}=require(candidate));break}catch{}}
assert.ok(chromium,'installed Chrome required');
const publicRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
let slipMode='malformed',slipCalls=0,orderCalls=0,orderStatus='awaiting_payment';
const send=(response,status,data,type='application/json; charset=utf-8')=>{response.writeHead(status,{'content-type':type,'cache-control':'private, no-store'});response.end(type.startsWith('application/json')?JSON.stringify(data):data)};
const server=http.createServer(async(request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1');
  if(url.pathname==='/api/vpage/offer')return send(response,200,{item:{slug:'vpage-credit',price:99900}});
  if(url.pathname==='/api/auth/me')return send(response,200,{user:{id:7,name:'Slip Owner',role:'user'}});
  if(url.pathname==='/api/vpage/credits')return send(response,200,{balance:0,items:[],pagination:{has_more:false,next_cursor:null}});
  if(url.pathname==='/api/vpage/domains')return send(response,200,{items:[{id:'dom_smartlinkpage',hostname:'smartlinkpage.com'}]});
  if(url.pathname==='/api/vpage/pages')return send(response,200,{items:[],pagination:{has_more:false,next_cursor:null}});
  if(url.pathname==='/api/orders'&&request.method==='POST'){
    orderCalls++;const order={id:41,orderNo:'VD-TEST-SLIP-41',total:99900,status:orderStatus,bank:{bank_name:'Mock Bank',account_name:'Vpage Receiver',account_number:'000-000-0000'}};
    return orderCalls===1?send(response,201,order):send(response,409,{error:'มีออเดอร์ Vpage ที่ยังดำเนินการไม่เสร็จ',code:'VPAGE_PENDING_ORDER',order});
  }
  if(url.pathname==='/api/orders/41/slip'&&request.method==='POST'){
    slipCalls++;for await(const chunk of request)void chunk;
    if(slipMode==='malformed')return send(response,200,'not-json','text/plain; charset=utf-8');
    orderStatus='pending_review';return send(response,200,{ok:true,persisted:true,order_status:'pending_review',verification_status:'manual',auto_approved:false,message:'รับสลิปแล้ว · EasySlip ไม่พร้อม จึงส่งให้ Boss ตรวจสอบ'});
  }
  if(url.pathname.startsWith('/api/'))return send(response,200,{items:[]});
  const pathname=['/','/vpage','/vpage.html'].includes(url.pathname)?'/vpage.html':url.pathname,local=path.resolve(publicRoot,`.${pathname}`),relative=path.relative(publicRoot,local);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!fs.existsSync(local))return send(response,404,'not found','text/plain');
  return send(response,200,fs.readFileSync(local),types[path.extname(local)]||'application/octet-stream');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  for(const width of [1440,390]){
    slipMode='malformed';slipCalls=0;orderCalls=0;orderStatus='awaiting_payment';const context=await browser.newContext({viewport:{width,height:width===390?844:900}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('https://**/*',route=>route.fulfill({status:204,body:''}));await page.goto(`${base}/vpage.html`);await page.locator('#buyVpageCredit:not([disabled])').click();await page.locator('#vpagePayment[open]').waitFor();
    const form=page.locator('#vpageSlipForm'),button=form.locator('button[type="submit"]'),message=page.locator('#vpageSlipMessage');await form.locator('[name="slip"]').setInputFiles({name:'slip.png',mimeType:'image/png',buffer:Buffer.from('browser-slip')});await button.click();
    await page.waitForFunction(()=>document.querySelector('#vpageSlipMessage')?.textContent!=='กำลังอัปโหลดสลิป…');assert.match(await message.textContent(),/ยืนยันการบันทึกสลิปไม่ได้/,'HTTP 200 malformed body cannot claim receipt');assert.equal(await button.isEnabled(),true,'failed acknowledgement restores submit');
    slipMode='manual';await button.click();await page.waitForFunction(()=>document.querySelector('#vpageSlipMessage')?.textContent.includes('Boss ตรวจสอบ'));assert.equal(await button.isEnabled(),true,'persisted manual fallback remains retry-safe');assert.equal(slipCalls,2);
    await page.reload();await page.locator('#buyVpageCredit:not([disabled])').click();await page.locator('#vpagePayment[open]').waitFor();assert.equal(await page.locator('#vpageOrderNo').textContent(),'เลขออเดอร์ VD-TEST-SLIP-41','owner-bound checkout response resumes the exact pending order after reload');assert.equal(orderCalls,2);
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS Vpage slip client requires durable acknowledgement and shows truthful retryable fallback on desktop/mobile');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
