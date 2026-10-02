import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);let chromium;
for(const candidate of ['C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright'])try{({chromium}=require(candidate));break}catch{}
assert.ok(chromium,'installed Chrome required');
const root=path.resolve('public'),pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lWQAAAAASUVORK5CYII=','base64');
const stories=[1,2,3,4].map(id=>({id,team_name:'Arsenal',headline:`Arsenal football article ${id}`,summary:'Premier League soccer match',publisher:`Publisher ${id}`,source_url:`https://news.example.test/article-${id}`,selected:0,sort_order:id,published_at:'2026-10-03T00:00:00Z',retrieved_at:'2026-10-03T00:00:00Z',preview_image_url:null,preview_status:null,preview_checked_at:null}));
const project={id:903,title:'Step1 preview fixture',news_date:'2026-10-03',scope_mode:'all_teams_for_day',team_name:'',target_minutes:30,target_seconds:0,status:'news_review',narration_script:'',person_names_override:'',thumbnail_headline:'ข่าวฟุตบอลวันนี้',thumbnail_subheadline:'',thumbnail_focus_text:'',thumbnail_focus_asset_id:null,thumbnail_palette:'red-yellow',thumbnail_layout:'split',selected_story_ids:[]},posts=[];
const send=(res,data)=>{res.writeHead(200,{'content-type':'application/json','cache-control':'private, no-store'});res.end(JSON.stringify(data))};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/auth/me')return send(res,{user:{id:903,role:'admin'}});
  if(url.pathname==='/api/admin/vsport'&&req.method==='POST'){let raw='';req.on('data',part=>raw+=part);return req.on('end',()=>{const body=JSON.parse(raw||'{}');posts.push(body);if(body.action==='preview_news_stories')return send(res,{ok:true,items:body.story_ids.map(id=>({id,preview_image_url:id!==3?`https://images.example.test/article-${id}.png`:'',preview_status:id!==3?'found':'empty',source_page_url:`https://news.example.test/article-${id}`}))});return send(res,{error:'unexpected action'})})}
  if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('jobs_project'))return send(res,{jobs:[]});
  if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('id'))return send(res,{project,stories,candidates:[],assets:[],story_pagination:{limit:24,has_more:false,next_cursor:null},media_pagination:{candidates:{limit:24,has_more:false,next_cursor:null},assets:{limit:24,has_more:false,next_cursor:null}}});
  if(url.pathname==='/api/admin/vsport')return send(res,{items:[project],pagination:{limit:24,has_more:false,next_cursor:null}});
  const relative=url.pathname==='/'?'/vsport.html':url.pathname,local=path.resolve(root,`.${relative}`);
  if(!local.startsWith(root)||!fs.existsSync(local)){res.statusCode=404;return res.end('not found')}
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(local)]||'application/octet-stream');res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
  for(const viewport of [{width:1440,height:800},{width:390,height:844}]){
    const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/api/admin/vsport',async route=>{const request=route.request();if(request.method()==='POST'&&JSON.parse(request.postData()||'{}').action==='preview_news_stories')await new Promise(resolve=>setTimeout(resolve,250));await route.continue()});
    await page.route('https://images.example.test/**',route=>route.request().url().endsWith('/article-4.png')?route.abort():route.fulfill({status:200,contentType:'image/png',body:pixel}));
    await page.goto(`http://127.0.0.1:${server.address().port}/vsport.html`);await page.getByRole('button',{name:/เปิดทำต่อ/}).click();await page.waitForSelector('#workspace:not([hidden])');await page.getByRole('button',{name:/เปิดทำต่อ/}).click();await page.waitForSelector('#workspace:not([hidden])');
    await page.waitForFunction(()=>!document.querySelector('#workspace')?.hidden&&document.querySelector('#createStatus')?.textContent===''&&document.querySelectorAll('.story-row').length===4&&document.querySelector('[data-story-id="3"] .story-preview')?.textContent.includes('ไม่มีภาพ'));
    await page.waitForFunction(()=>{const node=document.querySelector('[data-story-id="1"] .story-preview');if(!node)return false;const width=parseFloat(getComputedStyle(node).width);return width>0&&width<=360});
    const rows=page.locator('.story-row');assert.equal(await page.locator('[data-story-check]:checked').count(),0);
    for(let id=1;id<=2;id++){const row=rows.nth(id-1);assert.equal(await row.locator('img').getAttribute('src'),`https://images.example.test/article-${id}.png`);assert.equal(await row.locator('.story-source').getAttribute('href'),`https://news.example.test/article-${id}`)}
    assert.equal(await rows.nth(2).locator('img').count(),0);assert.match(await rows.nth(2).locator('.story-preview').textContent(),/ไม่มีภาพ/);
    await rows.nth(3).scrollIntoViewIfNeeded();await page.waitForFunction(()=>document.querySelector('[data-story-id="4"] .story-preview')?.textContent.includes('เปิดไม่ได้'));assert.equal(await rows.nth(3).locator('img').count(),0);
    await rows.nth(0).scrollIntoViewIfNeeded();const before=await page.evaluate(()=>scrollY);await rows.nth(0).locator('[data-story-check]').check();await rows.nth(0).locator('[data-story-check]').uncheck();assert.equal(await page.locator('[data-story-check]:checked').count(),0);assert.equal(await page.evaluate(()=>scrollY),before);assert.deepEqual(errors,[]);await page.close();
  }
  assert.equal(posts.filter(post=>post.action==='preview_news_stories').length,4);assert.ok(posts.every(post=>post.story_ids.length<=3));
  console.log('PASS v0.20.155 desktop/mobile preselection image mapping, bounded layout, no-image/hotlink fallback, checkbox/scroll');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
