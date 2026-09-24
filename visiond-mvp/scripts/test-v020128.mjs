import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';

import {buildLiveScriptProviderInput,LIVE_AI_PLAN_SCHEMA,renderLiveScriptPlan} from '../functions/_live_center.js';
import './test-v020125-live-center-ai.mjs';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));
const text=async path=>(await read(path)).toString('utf8');
const sha256=async path=>createHash('sha256').update(await read(path)).digest('hex').toUpperCase();
const plan=segmentIds=>JSON.stringify({schema:LIVE_AI_PLAN_SCHEMA,segment_ids:segmentIds});
const forbidden=['สวัสดีค่ะ วันนี้ขอแนะนำสินค้าจาก VisionD','สินค้าที่นำเสนอคือ'];

const visibleVersion=(await text('VERSION.txt')).trim();
assert.ok(['v0.20.128','v0.20.129'].includes(visibleVersion));
assert.ok((await text('public/index.html')).includes(`WEB ${visibleVersion}`));
assert.ok((await text('public/admin.html')).includes(`ADMIN ${visibleVersion}`));
assert.match(await text('public/live-center.html'),/live-center\.js\?v=02012[89]/);
assert.match(await text('FEATURE-MAP.md'),/ไม่โฆษณา opening สำเร็จรูป/);
assert.equal(JSON.parse(await text('patch-ledgers/v0.20.128.json')).version,'v0.20.128');

const products=[
  {id:4,title:'Blastrain Metal Cardbot S',description:'ของเล่นหุ่นยนต์แปลงร่าง Blastrain Metal Cardbot S จาก SAMG Entertainment',brand:'SAMG ENTERTAINMENT',product_line:'Metal Cardbot S',series:'Metal Cardbot S',price_cents:550000,currency:'THB',quantity:1,price:'5500'},
  {id:3,title:'S.H. MonsterArts Yu-Gi-Oh! Duel Monsters GX E・HERO Flame Wingman',description:'ฟิกเกอร์สะสม ราคาป้ายญี่ปุ่น 13,200 เยน',brand:'Bandai',product_line:'S.H. MonsterArts',series:'Yu-Gi-Oh!',price_cents:350000,currency:'THB',quantity:1,price:'3500'},
];
for(const product of products){
  const input=buildLiveScriptProviderInput(product,60),ids=input.responseJsonSchema.properties.segment_ids.items.enum,message=JSON.parse(input.message);
  assert.equal(ids.includes('template.opening'),false,`product ${product.id} schema must not advertise opening`);
  assert.equal(message.available_segments.some(segment=>segment.id==='template.opening'),false,`product ${product.id} message must not advertise opening`);
  assert.equal(input.scriptSegments.get('fact.name'),product.title,`product ${product.id} name segment must be exact`);
  for(const phrase of forbidden){assert.equal(input.message.includes(phrase),false);assert.equal(input.systemPrompt.includes(phrase),false)}
  const script=renderLiveScriptPlan(plan(['fact.price_stock','template.closing','fact.name']),input,product);
  assert.equal(script.startsWith(product.title),true,`product ${product.id} must begin with authoritative name`);
  assert.ok(script.includes(`ราคา ${product.price} บาท และมีสินค้า 1 ชิ้น`));
  for(const phrase of forbidden)assert.equal(script.includes(phrase),false);
  assert.throws(()=>renderLiveScriptPlan(plan(['template.opening','fact.name','fact.price_stock']),input,product),error=>error.code==='LIVE_AI_OUTPUT_INVALID','retired opening ID must fail closed');
}

const unchangedVsport={
  'migrations/0111_vsport.sql':'0AD1F2DA8B5833615BAE8967A7953CB75F83CE9ABEBAC12E5F1E4CEC2321A59D',
  'functions/_vsport.js':'976BFECEC019BE414734B4DC8DD8B75E3C9C6B06690B4F105426CD333B5FA2B5',
  'functions/api/admin/vsport.js':'C695DDC0A71B9C7300D1E52C910BF07F85583439B733B6B006E26D3154A9322E',
  'functions/api/admin/vsport-assets/[id].js':'6BEF06AD1B137C56707D6F01CE0F86777CB79D8D6EFF108C763F9C07EAB4A434',
  'public/vsport.html':'7F4315D8ECD75762D15B31224F763561FA98DF71A5020A21965ABBC4F7A21ABC',
  'public/vsport.css':'262CE0A73E4044B3F2FEABBD4DE65C5C98D635EDFD44AAABFEF2B395111A0EFC',
  'public/vsport.js':'1A257C80E9C734081FF3E56DE56A260F25DEB01FE6DD785C1A938C4986F2159F',
  'scripts/test-v020124-vsport-news.mjs':'4924FD3925702A27219C7982EB59B47D80E2B19221D4FAF3D1BD074AA3D70CF1',
};
for(const [path,expected] of Object.entries(unchangedVsport))assert.equal(await sha256(path),expected,`${path} must remain byte-identical to released vSport`);

console.log('v0.20.128 Live Center direct-name intro removal and vSport byte-identity checks passed');
