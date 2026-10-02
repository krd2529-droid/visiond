import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
let chromium;
for(const candidate of ['C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright','playwright']){
  try{({chromium}=require(candidate));break}catch{}
}
assert.ok(chromium,'installed Chrome required');
const root=path.resolve('public');
const project={id:903,title:'Draft scroll fixture',news_date:'2026-10-03',scope_mode:'all_teams_for_day',team_name:'',target_minutes:30,target_seconds:0,status:'news_review',narration_script:'',person_names_override:'',thumbnail_headline:'ข่าวฟุตบอลวันนี้',thumbnail_subheadline:'',thumbnail_focus_text:'',thumbnail_focus_asset_id:null,thumbnail_palette:'red-yellow',thumbnail_layout:'split',selected_story_ids:[1]};
const story={id:1,team_name:'Arsenal',headline:'Arsenal football update',summary:'Premier League soccer match',publisher:'Fixture',source_url:'https://news.example.test/article',selected:1,sort_order:0,published_at:'2026-10-03T00:00:00Z',retrieved_at:'2026-10-03T00:00:00Z'};
const send=(res,data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store'});res.end(JSON.stringify(data))};
let state;
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/api/auth/me')return send(res,{user:{id:903,role:'admin'}});
  if(url.pathname==='/api/admin/vsport'&&req.method==='POST'){
    let raw='';req.on('data',chunk=>raw+=chunk);return req.on('end',()=>{
      const body=JSON.parse(raw||'{}');state.posts.push(body.action);
      if(body.action==='save'){project.narration_script=body.narration_script;project.selected_story_ids=body.story_ids;return send(res,{ok:true})}
      if(body.action==='generate_script')return send(res,{job:{id:1,project_id:903,job_type:'script',status:'queued'}},202);
      return send(res,{error:'unexpected action'},400);
    });
  }
  if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('job')){state.jobPolled=true;project.narration_script='สคริปต์ฟุตบอลจากข่าวที่เลือก';return send(res,{job:{id:1,project_id:903,job_type:'script',status:'completed',checkpoint:'done'}})}
  if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('jobs_project'))return send(res,{jobs:[]});
  if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('id'))return send(res,{project,stories:[story],candidates:[],assets:[],story_pagination:{limit:24,has_more:false,next_cursor:null},media_pagination:{candidates:{limit:24,has_more:false,next_cursor:null},assets:{limit:24,has_more:false,next_cursor:null}}});
  if(url.pathname==='/api/admin/vsport')return send(res,{items:[project],pagination:{limit:24,has_more:false,next_cursor:null}});
  const relative=url.pathname==='/'?'/vsport.html':url.pathname,local=path.resolve(root,`.${relative}`);
  if(!local.startsWith(root)||!fs.existsSync(local)){res.statusCode=404;return res.end('not found')}
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(local)]||'application/octet-stream');res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
  for(const viewport of [{width:1440,height:700},{width:390,height:844}]){
    state={posts:[],jobPolled:false};
    const page=await browser.newPage({viewport}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/vsport.html`);
    await page.getByRole('button',{name:/เปิดทำต่อ/}).click();
    await page.waitForSelector('#workspace:not([hidden])');
    await page.waitForTimeout(900);
    await page.locator('#generateScript').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await page.evaluate(()=>{
      window.__scrollCalls=[];
      const prior=Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView=function(options){window.__scrollCalls.push({kind:'scrollIntoView',element:this.id,options,at:window.scrollY,stack:new Error().stack});return prior.call(this,options)};
      const old=window.scrollTo;
      window.scrollTo=function(...args){window.__scrollCalls.push({kind:'scrollTo',args,at:window.scrollY,stack:new Error().stack});return old.apply(this,args)};
    });
    const before=await page.evaluate(()=>({y:scrollY,buttonTop:document.querySelector('#generateScript').getBoundingClientRect().top,workspaceTop:document.querySelector('#workspace').getBoundingClientRect().top}));
    await page.locator('#generateScript').click();
    await page.waitForFunction(()=>document.querySelector('#narrationScript').value.includes('สคริปต์ฟุตบอล'));
    await page.waitForTimeout(1000);
    const after=await page.evaluate(()=>({y:scrollY,status:document.querySelector('#scriptStatus').textContent,script:document.querySelector('#narrationScript').value,activeId:document.activeElement?.id||'',calls:window.__scrollCalls}));
    const result={viewport,before,after,delta:after.y-before.y,posts:state.posts,jobPolled:state.jobPolled,errors};
    console.log(JSON.stringify(result));
    assert.ok(before.y>100,'button fixture must be below fold');
    assert.ok(result.posts.includes('save')&&result.posts.includes('generate_script'));
    assert.ok(Math.abs(result.delta)<=2,'draft should preserve scroll');
    assert.ok(!after.calls.some(call=>call.kind==='scrollIntoView'&&call.element==='workspace'),'draft must not navigate to workspace start');
    assert.deepEqual(errors,[]);
    await page.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
