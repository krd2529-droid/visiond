import assert from'node:assert/strict';
import fs from'node:fs';
import http from'node:http';
import path from'node:path';
import{createRequire}from'node:module';
import{affiliateBasketDestination,affiliateBasketLink}from'../functions/api/vx/referrals.js';

const basket={product_kind:'vx-access',slug:'vx-10-accounts'};
assert.equal(affiliateBasketDestination(basket),'/vtools?plan=vx-10-accounts#plans');
assert.equal(affiliateBasketLink('VXUSER1',basket),'https://visiondonline.com/r/VXUSER1?next=%2Fvtools%3Fplan%3Dvx-10-accounts%23plans');
const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
assert.match(read('functions/api/vx/referrals.js'),/p\.product_kind='vx-access'/);
assert.match(read('public/vx-affiliate.html'),/เลือกแพ็กเกจ VX ที่จะแนะนำ/);
assert.match(read('public/vx-affiliate.js'),/ลิงก์ Affiliate VX/);
assert.match(read('public/dashboard.html'),/ลิงก์ Affiliate VX ของฉัน/);
assert.match(read('public/vtools.js'),/plan-highlighted/);
for(const file of['functions/api/vx/referrals.js','public/vx-affiliate.html','public/vx-affiliate.js','public/dashboard.html'])assert.doesNotMatch(read(file),/VCORD|vcord/);
assert.match(read('functions/r/[code].js'),/next\.startsWith\('\/'\)&&!next\.startsWith\('\/\/'\)/);
assert.match(read('functions/r/[code].js'),/attributeReferralByCode/);

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright'),root=path.resolve('public');
const items=[10,20,30].map((limit,index)=>({id:index+1,slug:`vx-${limit}-accounts`,title:`VX ${limit} บัญชี`,short_description:'สิทธิ์ใช้งาน VX อายุ 30 วัน',price:[49000,98000,129000][index],cover_url:'/assets/vx-vtools.svg',product_kind:'vx-access',destination:`/vtools?plan=vx-${limit}-accounts#plans`,affiliate_link:`https://visiondonline.com/r/VXUSER1?next=${encodeURIComponent(`/vtools?plan=vx-${limit}-accounts#plans`)}`}));
const server=http.createServer((request,response)=>{const url=new URL(request.url,'http://localhost');if(url.pathname==='/api/vx/referrals'){response.setHeader('content-type','application/json');response.end(JSON.stringify({link:'https://visiondonline.com/r/VXUSER1',summary:{clicks:3,signups:1,total:2000,payable:0,paid:0,adjustments:0},baskets:items}));return}let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)){response.writeHead(404).end();return}try{response.setHeader('content-type',path.extname(file)==='.js'?'text/javascript; charset=utf-8':path.extname(file)==='.css'?'text/css; charset=utf-8':'text/html; charset=utf-8');response.end(fs.readFileSync(file))}catch{response.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},locale:'th-TH'});
  await page.goto(`http://127.0.0.1:${server.address().port}/vx-affiliate.html`);
  await page.locator('.affiliate-basket').first().waitFor();
  assert.equal(await page.locator('.affiliate-basket').count(),3);
  assert.match(await page.locator('.affiliate-basket input').first().inputValue(),/VXUSER1.*vx-10-accounts/);
  await page.locator('#basketSearch').fill('30 บัญชี');
  assert.equal(await page.locator('.affiliate-basket').count(),1);
  assert.match(await page.locator('#basketCount').innerText(),/1 จาก 3/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'affiliate page must not overflow mobile');
}finally{await browser.close();server.close()}
console.log('PASS VX affiliate package link generation and member entry');
