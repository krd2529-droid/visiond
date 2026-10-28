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
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const records=Array.from({length:25},(_,i)=>({id:`c${i+1}`,shop_id:'s1',display_name:`Customer ${i+1}`,platform:i===24?'facebook':'line',shop_name:'VisionD',updated_at:'2026-10-28T10:00:00Z',last_message:`Preview ${i+1}`}));
const longText=`อ่านง่าย ${'https://example.com/'+ 'verylongsegment'.repeat(50)}`;
const message=(i)=>({id:`m${i}`,role:i%2?'user':'assistant',content:i===51?longText:`Message ${i}`,created_at:new Date(Date.UTC(2026,9,28,0,i)).toISOString()});
let failList=false,failThread=false,listDelay=0,threadDelay=0,apiWrites=0,listReads=0,threadReads=0;
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')){
    if(req.method!=='GET')apiWrites++;
    res.setHeader('content-type','application/json');res.setHeader('cache-control','private, no-store');
    if(url.pathname==='/api/admin/v12-conversations'){
      listReads++;
      if(listDelay)await new Promise(resolve=>setTimeout(resolve,listDelay));
      if(failList){res.statusCode=503;return res.end(JSON.stringify({error:'รายการขัดข้อง'}))}
      const platform=url.searchParams.get('platform'),q=url.searchParams.get('q')||'';
      const filtered=records.filter(item=>(!platform||item.platform===platform)&&(!q||item.display_name.toLowerCase().includes(q.toLowerCase())||item.last_message.toLowerCase().includes(q.toLowerCase())));
      const offset=url.searchParams.get('cursor')==='next'?24:0,items=filtered.slice(offset,offset+24),hasMore=offset+24<filtered.length;
      return res.end(JSON.stringify({conversations:items,pagination:{limit:24,has_more:hasMore,next_cursor:hasMore?'next':null}}));
    }
    if(url.pathname==='/api/admin/v12-thread'){
      threadReads++;if(threadDelay)await new Promise(resolve=>setTimeout(resolve,threadDelay));
      if(failThread){res.statusCode=503;return res.end(JSON.stringify({error:'ข้อความขัดข้อง'}))}
      const id=url.searchParams.get('conversation_id'),before=url.searchParams.get('before');
      const conversation=records.find(item=>item.id===id);
      const items=before?[message(1),message(2)]:id==='c1'?Array.from({length:50},(_,i)=>message(i+2)):[message(51)];
      return res.end(JSON.stringify({conversation,messages:items,pagination:{limit:50,has_more:id==='c1'&&!before,before:id==='c1'&&!before?'m2':null}}));
    }
    res.statusCode=404;return res.end('{}');
  }
  const file=path.resolve(root,`.${url.pathname}`);
  if(!file.startsWith(root)||!fs.existsSync(file)){res.statusCode=404;return res.end('missing')}
  res.setHeader('content-type',url.pathname.endsWith('.css')?'text/css':url.pathname.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  for(const width of [1440,390]){
    const context=await browser.newContext({viewport:{width,height:width===390?844:900}}),page=await context.newPage();
    await page.goto(`${base}/v12-chat-library.html`);
    await page.waitForFunction(()=>document.querySelectorAll('.library-conversation').length===24);
    assert.equal(await page.locator('#libraryMessages .library-message').count(),0,'history is lazy until a conversation is selected');
    await page.locator('#libraryLoadMore').click();
    await page.waitForFunction(()=>document.querySelectorAll('.library-conversation').length===25);
    assert.equal(await page.locator('.library-conversation').count(),25,'cursor appends without duplicate conversations');
    if(width===1440){await page.locator('.library-conversation').first().focus();await page.keyboard.press('Enter')}
    else await page.locator('.library-conversation').first().click();
    await page.waitForFunction(()=>document.querySelectorAll('.library-message').length===50);
    assert.equal(await page.locator('.library-message-body').first().evaluate(node=>getComputedStyle(node).fontSize),'20px');
    if(process.env.V12_SCREENSHOT_DIR){fs.mkdirSync(process.env.V12_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.V12_SCREENSHOT_DIR,`library-${width}.png`),fullPage:true})}
    await page.locator('#libraryMessages').evaluate(node=>{node.scrollTop=0});
    const priorPosition=await page.locator('.library-message').first().evaluate(node=>node.getBoundingClientRect().top);
    await page.locator('#libraryOlder').click();
    await page.waitForFunction(()=>document.querySelectorAll('.library-message').length===51);
    assert.equal(await page.locator('.library-message-body').first().textContent(),'Message 1','older message prepends and duplicate boundary is removed');
    assert.equal(await page.locator('.library-message-body').last().textContent(),longText);
    const retainedPosition=await page.locator('.library-message').nth(1).evaluate(node=>node.getBoundingClientRect().top);
    assert.ok(Math.abs(retainedPosition-priorPosition)<5,`loading older messages preserves the visible scroll anchor (${priorPosition} -> ${retainedPosition})`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px viewport has no horizontal overflow`);
    await page.locator('[data-platform="facebook"]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.library-conversation').length===1);
    assert.match(await page.locator('.library-conversation').textContent(),/Customer 25/);
    await page.locator('#librarySearch').fill('not found');
    await page.waitForFunction(()=>document.querySelectorAll('.library-conversation').length===0);
    assert.match(await page.locator('#libraryListState').textContent(),/ยังไม่มีบทสนทนา/);
    await context.close();
  }
  const context=await browser.newContext(),page=await context.newPage();
  failList=true;await page.goto(`${base}/v12-chat-library.html`);
  await page.waitForFunction(()=>!document.querySelector('#libraryRetryList').hidden);
  assert.match(await page.locator('#libraryListState').textContent(),/รายการขัดข้อง/);
  failList=false;await page.locator('#libraryRetryList').click();
  await page.waitForFunction(()=>document.querySelectorAll('.library-conversation').length===24);
  failThread=true;await page.locator('.library-conversation').first().click();
  await page.waitForFunction(()=>!document.querySelector('#libraryThreadError').hidden);
  assert.match(await page.locator('#libraryThreadErrorText').textContent(),/ข้อความขัดข้อง/);
  failThread=false;await page.locator('#libraryRetryThread').click();
  await page.waitForFunction(()=>document.querySelectorAll('.library-message').length===50);
  threadDelay=200;await page.locator('.library-conversation').first().click();
  threadDelay=0;await page.locator('.library-conversation').nth(1).click();
  await page.waitForFunction(()=>document.querySelector('#libraryCustomer').textContent==='Customer 2');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#libraryCustomer').textContent(),'Customer 2','stale earlier thread response cannot replace a newer selection');
  listDelay=200;const earlierReads=listReads;
  await page.locator('#libraryRefresh').click();
  for(let i=0;i<20&&listReads===earlierReads;i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.ok(listReads>earlierReads,'delayed list request started');
  await page.locator('#librarySearch').fill('not found');
  await page.waitForTimeout(240);
  assert.match(await page.locator('#libraryListState').textContent(),/กำลังค้นหา/,'stale list response cannot repaint during search debounce');
  listDelay=0;
  await page.waitForFunction(()=>document.querySelectorAll('.library-conversation').length===0);
  assert.equal(apiWrites,0,'read-only library makes no mutation requests');
  assert.ok(listReads>=4&&threadReads>=4,'bounded list and thread endpoints were exercised');
  await context.close();
  assert.match(fs.readFileSync(path.join(root,'v12-connect.html'),'utf8'),/href="\/v12-chat-library\.html"/,'V12 inbox links to the dedicated library');
  console.log('PASS V12 chat library desktop/mobile, cursor dedup, search/filter, error/retry, read-only');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
