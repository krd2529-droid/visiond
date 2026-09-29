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
assert.ok(['v0.20.128','v0.20.129','v0.20.130','v0.20.131','v0.20.132','v0.20.133','v0.20.134','v0.20.135','v0.20.136','v0.20.137','v0.20.138','v0.20.139','v0.20.140','v0.20.141','v0.20.142','v0.20.143'].includes(visibleVersion));
assert.ok((await text('public/index.html')).includes(`WEB ${visibleVersion}`));
assert.ok((await text('public/admin.html')).includes(`ADMIN ${visibleVersion}`));
assert.match(await text('public/live-center.html'),/live-center\.js\?v=020(?:128|129|130|131|132|133|134|135|136|137|138)/);
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

const releasedVsportHash=(v143,v142,v141,v140,v139,prior)=>visibleVersion==='v0.20.143'?v143:visibleVersion==='v0.20.142'?v142:visibleVersion==='v0.20.141'?v141:visibleVersion==='v0.20.140'?v140:visibleVersion==='v0.20.139'?v139:prior;
const unchangedVsport={
  'migrations/0111_vsport.sql':'0AD1F2DA8B5833615BAE8967A7953CB75F83CE9ABEBAC12E5F1E4CEC2321A59D',
  'functions/_vsport.js':releasedVsportHash('C23F799D69413F1D16A493D8A386CF741FEE758D3B9B66685626857143A67022','1E2940C567FF36E2306EB2AF742FAD2CE5D57F9F632E2E6CF9F8E2CA73B1F93A','F14100C24027793FB9AD65CA1BB2D0779FAE5A53B7FE65C14E4258A828D1F180','F14100C24027793FB9AD65CA1BB2D0779FAE5A53B7FE65C14E4258A828D1F180','9089691CDA6DEB576E41359E4991219DF660B6C76EEA13B626C8DC75A6A7C6AF','976BFECEC019BE414734B4DC8DD8B75E3C9C6B06690B4F105426CD333B5FA2B5'),
  'functions/api/admin/vsport.js':releasedVsportHash('0D1776B49DBC31B684BFDCA4E62B86F2BE31B8D25EE973AFAC2964F057BFCB73','5F43FAE73B45056EF8409CB5D7E5CB96006DAFF730378907F2ABF1E7489E22C2','01C522F197B96891EC411FD22D84F9F5FE33DAC4274EC43DACD434BEC96F2D0B','DAE3E3897A51DFF409EF29541323CB3D07D2E0685F3BE7CA6B9BF5E20AA2F67C','139A8A453F3AEE4284458BDC8881BFC3FDB18FE9477CB87C6B4DBB77F3CC1488','C695DDC0A71B9C7300D1E52C910BF07F85583439B733B6B006E26D3154A9322E'),
  'functions/api/admin/vsport-assets/[id].js':'6BEF06AD1B137C56707D6F01CE0F86777CB79D8D6EFF108C763F9C07EAB4A434',
  'public/vsport.html':releasedVsportHash('CF1B0F748C88E85E0AB4C0B290A75C57FD2B304D0ACA010F9838504D22416B51','F235ED6322A31D62AB5DB3BDA40A2D73A9DFD42917E920E8DB63224B600B9AEF','68871BC77892F2E97A3DE94C74ECC660798FCA477E8D66337E25FD5D8792CD55','71EEEA3040242CEDAA24C93E4B6FCA99188F798F88A0A505E73BCAD40ABC5865','B8D5444993682CD85EE67FCB599F17235F1B3A760D859D60B3D9755A1A07E0C1','7F4315D8ECD75762D15B31224F763561FA98DF71A5020A21965ABBC4F7A21ABC'),
  'public/vsport.css':'262CE0A73E4044B3F2FEABBD4DE65C5C98D635EDFD44AAABFEF2B395111A0EFC',
  'public/vsport.js':releasedVsportHash('9543B1DC78AC1E1EB7F152DA92F9D0E468212F64A75C6E717DDF02AB4C83C4E8','AF6853566D8D833F7AF98ECE4963020B0C181562766409DFEC928DA8AE112C3F','FF611CC457D8BDE96B8CF3C13E5D653C060B7F67F7823457C39914865BF0CF52','A76A02B528D30B6DB390586E7515BCF674A045EAEA88FDFD69DB51B572AE208B','A76A02B528D30B6DB390586E7515BCF674A045EAEA88FDFD69DB51B572AE208B','1A257C80E9C734081FF3E56DE56A260F25DEB01FE6DD785C1A938C4986F2159F'),
  'scripts/test-v020124-vsport-news.mjs':releasedVsportHash('7306547955663BA20F33E384CE3086FF61BA2F4263B632D718A133D958E8E5DE','7306547955663BA20F33E384CE3086FF61BA2F4263B632D718A133D958E8E5DE','7306547955663BA20F33E384CE3086FF61BA2F4263B632D718A133D958E8E5DE','7306547955663BA20F33E384CE3086FF61BA2F4263B632D718A133D958E8E5DE','44CF43323EFE25205651546456AA2463765701B1B4231EABBB8561833E788931','4924FD3925702A27219C7982EB59B47D80E2B19221D4FAF3D1BD074AA3D70CF1'),
};
for(const [path,expected] of Object.entries(unchangedVsport))assert.equal(await sha256(path),expected,`${path} must remain byte-identical to released vSport`);

console.log('v0.20.128 Live Center direct-name intro removal and vSport byte-identity checks passed');
