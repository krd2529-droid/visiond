import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const require=createRequire(import.meta.url);
let chromium;
for(const candidate of [process.env.PLAYWRIGHT_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'].filter(Boolean)) {
  try {({chromium}=require(candidate));break;} catch {}
}
if(!chromium) throw new Error('Playwright unavailable');
const root=path.resolve('public');
assert.match(readFileSync(path.resolve(root,'vsms-successful-sends.html'),'utf8'),/vsms-successful-sends\.js\?v=2/,'archive client cache token advances');
let mode='rows',calls=[];
const rows=Array.from({length:26},(_,i)=>({id:26-i,recipient_phone:`0800000${String(i).padStart(3,'0')}`,sent_at:1700000000000+i*1000,
  received_at:'2026-10-18 00:00:00',license_id:'license-test',
  user_name:i%2?'Other owner':'Boss owner',user_email:i%2?'other@example.test':'boss@example.test',device_name:'Android test'}));
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/admin/vision7/smsmix-successful-sends') {
    calls.push(url.searchParams.get('cursor'));
    res.setHeader('content-type','application/json');
    if(mode==='error') {res.statusCode=503;res.end('{}');return;}
    const eligible=mode==='empty'?[]:rows.filter(x=>!url.searchParams.has('cursor')||x.id<Number(url.searchParams.get('cursor')));
    res.end(JSON.stringify({items:eligible.slice(0,24),next_cursor:eligible.length>24?eligible[23].id:null}));return;
  }
  const api={
    '/api/admin/vision7/programs':{items:[{id:9,code:'sms-mix',app_name:'VSMS',platform_type:'android',current_version:'0.5.5',minimum_version:'0.5.4',active:1,plans:'[]'}],product_options:[],product_options_available:true},
    '/api/admin/vision7/licenses':{items:[],encryption_ready:true,operator:{id:1},summary:{}},
    '/api/admin/vision7/releases':{items:[]},'/api/admin/users':{items:[]}
  }[url.pathname];
  if(api) {res.setHeader('content-type','application/json');res.end(JSON.stringify(api));return;}
  const file=path.resolve(root,`.${url.pathname}`);
  if(!file.startsWith(root+path.sep)) {res.statusCode=404;res.end();return;}
  try {res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(file));}
  catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try {
  for(const viewport of [{width:1280,height:800},{width:390,height:844}]) {
    const page=await browser.newPage({viewport});
    const base=`http://127.0.0.1:${server.address().port}`;
    await page.goto(`${base}/admin.html`);
    const link=page.locator('.admin-menu-board a[href="/vsms-successful-sends.html"]');
    assert.equal(await link.getAttribute('href'),'/vsms-successful-sends.html');
    assert.equal(await link.isVisible(),false,'non-boss cannot see archive menu');
    await page.locator('#adminPanel').evaluate(panel=>{panel.hidden=false;});
    await page.evaluate(()=>document.body.classList.add('viewer-is-boss'));
    assert.equal(await link.isVisible(),true,'management menu shows archive link');
    await link.click();
    assert.equal(new URL(page.url()).pathname,'/vsms-successful-sends.html','menu opens dedicated archive');
    await page.locator('#vsmsSuccessRows tr').first().waitFor();
    calls=[];
    await page.goto(`${base}/vision7-admin.html`);
    assert.equal(await page.locator('#loadVsmsSuccess').count(),0,'key center no longer embeds archive');
    await page.getByRole('button',{name:'อัปเดต VSMS 0.5.6'}).click();
    assert.equal(await page.locator('#releaseForm [name="version"]').inputValue(),'0.5.6');
    assert.equal(await page.locator('#releaseForm [name="minimum_version"]').inputValue(),'0.5.4');
    assert.equal(calls.length,0,'key center makes no archive request');
    await page.goto(`${base}/vsms-successful-sends.html`);
    await page.locator('#vsmsSuccessRows tr').nth(23).waitFor();
    assert.equal(await page.locator('#vsmsSuccessRows tr').count(),24);
    assert.equal(await page.locator('#vsmsSuccessMore').isVisible(),true);
    await page.locator('#vsmsSuccessMore').click();
    await page.locator('#vsmsSuccessRows tr').nth(25).waitFor();
    await page.locator('#vsmsSuccessMore').waitFor({state:'hidden'});
    assert.equal(await page.locator('#vsmsSuccessRows tr').count(),26);
    assert.equal(await page.locator('#vsmsSuccessMore').isVisible(),false);
    assert.deepEqual(await page.locator('#vsmsSuccessRows tr td:nth-child(4)').allInnerTexts(),Array(26).fill('ไม่แสดง'));
    assert.equal(await page.locator('#vsmsSuccessRows').getByText(/Boss owner|Other owner|example\.test/).count(),0);
    assert.deepEqual(calls.slice(-2),[null,'3']);
    assert.equal(await page.locator('#vsmsSuccessRows tr').first().locator('td').first().innerText(),'0800000000');
    assert.equal(await page.locator('#vsmsSuccessRows tr').last().locator('td').first().innerText(),'0800000025');
    if(viewport.width<760) {
      const labels=await page.locator('#vsmsSuccessRows tr').first().locator('td').evaluateAll(cells=>cells.map(cell=>({label:cell.dataset.label,shown:getComputedStyle(cell,'::before').content})));
      assert.deepEqual(labels.map(x=>x.label),['เบอร์ผู้รับ','ส่งสำเร็จเมื่อ','เครื่อง','เจ้าของคีย์','คีย์']);
      for(const x of labels) assert.ok(x.shown.includes(x.label),`mobile label ${x.label}`);
    }
    mode='error';await page.locator('#loadVsmsSuccess').click();
    await page.locator('#vsmsSuccessState').getByText(/โหลดรายการไม่สำเร็จ/).waitFor();
    mode='empty';await page.locator('#loadVsmsSuccess').click();
    await page.locator('#vsmsSuccessState').getByText('ยังไม่มีรายการส่งสำเร็จ').waitFor();
    assert.equal(await page.locator('#vsmsSuccessRows tr').count(),0);
    await page.close();mode='rows';calls=[];
  }
  console.log('VSMS successful-send admin browser PASS');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
