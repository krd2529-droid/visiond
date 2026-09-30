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
assert.ok(chromium,'Playwright Chromium is required');

const publicRoot=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','public');
const saved={id:7,title:'โปรเจกต์ที่บันทึกแล้ว',news_date:'2026-09-30',scope_mode:'specific_team',team_name:'Manchester United',target_minutes:30,target_seconds:0,status:'draft'};
const requests=[];
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname.startsWith('/api/')){requests.push(`${req.method} ${url.pathname}`);res.setHeader('content-type','application/json; charset=utf-8');
    if(url.pathname==='/api/auth/me')return res.end(JSON.stringify({user:{id:1,role:'admin'}}));
    if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('id'))return res.end(JSON.stringify({project:saved,stories:[],candidates:[],assets:[],story_pagination:{has_more:false,next_cursor:null},media_pagination:{candidates:{has_more:false,next_cursor:null},assets:{has_more:false,next_cursor:null}}}));
    if(url.pathname==='/api/admin/vsport'&&url.searchParams.has('jobs_project'))return res.end(JSON.stringify({jobs:[]}));
    if(url.pathname==='/api/admin/vsport')return res.end(JSON.stringify({items:[saved],pagination:{has_more:false,next_cursor:null}}));
    res.statusCode=404;return res.end('{}');
  }
  const relative=url.pathname==='/'||url.pathname==='/vsport'?'/vsport.html':url.pathname,local=path.resolve(publicRoot,`.${relative}`);
  if(!local.startsWith(publicRoot+path.sep)||!fs.existsSync(local)){res.statusCode=404;return res.end('missing')}
  res.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'})[path.extname(local)]||'application/octet-stream');res.end(fs.readFileSync(local));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'chrome'});
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}/vsport.html`);
  await page.locator('.project-row').waitFor();
  const team=page.locator('#teamName');
  assert.equal(await team.inputValue(),'','a fresh specific-team form starts blank');
  assert.equal(await team.getAttribute('maxlength'),'120');
  assert.equal(await team.evaluate(input=>input.required&&input.validity.valueMissing),true,'specific team remains required');
  await page.locator('#createProject').click();
  assert.equal(requests.some(request=>request.startsWith('POST ')),false,'empty specific team cannot submit');
  await page.locator('[name="scopeMode"][value="all_teams_for_day"]').check();
  assert.equal(await team.evaluate(input=>input.required),false,'all-teams mode does not require a team');
  assert.equal(await page.locator('#teamField').isHidden(),true);
  await page.locator('[name="scopeMode"][value="specific_team"]').check();
  assert.equal(await team.evaluate(input=>input.required&&input.validity.valueMissing),true);
  assert.match(await page.locator('.project-row').innerText(),/Manchester United/,'saved team remains in project list');
  await page.getByRole('button',{name:`เปิดทำต่อ ${saved.title}`}).click();
  await page.locator('#workspace:not([hidden])').waitFor();
  assert.equal(await page.locator('#projectScope').innerText(),'ทีม Manchester United','saved team remains in project view');
  assert.equal(await team.inputValue(),'','opening a saved project does not prefill the new-project form');
  assert.equal(requests.some(request=>request.startsWith('POST ')),false,'regression fixture never creates a project');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
console.log('PASS V Sport blank new-team form, required scope, all-teams scope, and saved team display');
