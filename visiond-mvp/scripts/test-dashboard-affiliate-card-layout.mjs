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
const html=fs.readFileSync(path.join(publicRoot,'dashboard.html'),'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://127.0.0.1').pathname;
  if(pathname==='/dashboard.html'){
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
    return res.end(html);
  }
  const local=path.resolve(publicRoot,`.${pathname}`);
  if(!local.startsWith(`${publicRoot}${path.sep}`)||!fs.existsSync(local)){
    res.writeHead(404);return res.end('not found');
  }
  res.writeHead(200,{'content-type':path.extname(local)==='.css'?'text/css; charset=utf-8':'application/octet-stream'});
  res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
try{
  for(const viewport of [{width:1142,height:850},{width:390,height:844}]){
    const page=await browser.newPage({viewport});
    await page.goto(`http://127.0.0.1:${server.address().port}/dashboard.html`);
    const layout=await page.evaluate(()=>{
      const card=document.querySelector('#vxAffiliateCard');
      const guide=document.querySelector('#dashboardGuide');
      const cardBox=card.getBoundingClientRect();
      const guideBox=guide.getBoundingClientRect();
      return {
        display:getComputedStyle(card).display,
        fragments:card.getClientRects().length,
        cardBottom:cardBox.bottom,
        guideTop:guideBox.top,
        cardWidth:cardBox.width,
        contentWidth:document.querySelector('.dashboard-content').getBoundingClientRect().width,
        scrollWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth,
      };
    });
    assert.equal(layout.display,'block',`${viewport.width}px affiliate card must form one block`);
    assert.equal(layout.fragments,1,`${viewport.width}px affiliate card must not fragment into white overlays`);
    assert.ok(layout.cardBottom<=layout.guideTop,`${viewport.width}px affiliate card must not overlap the guide`);
    assert.ok(layout.cardWidth<=layout.contentWidth,`${viewport.width}px affiliate card must fit the dashboard content`);
    assert.ok(layout.scrollWidth<=layout.clientWidth,`${viewport.width}px page must not overflow horizontally`);
    await page.close();
  }
  console.log('PASS Affiliate VX card is one non-overlapping block at desktop and mobile widths');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
