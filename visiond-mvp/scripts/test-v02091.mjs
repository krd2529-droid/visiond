import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/tiktok-analyzer.js','utf8');
const cut=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
let table, posts=[],refreshes=0,current=true;
const c={state:{inventoryProducts:[]},escapeHtml:String,normalizeProductName:x=>String(x).trim().toLowerCase(),safeJson:JSON.parse,arrayValue:x=>Array.isArray(x)?x:[],productLinkControl:()=>'<span>ไม่มีลิงก์</span>',$:()=>table,FormData,message:{},showToast(){},channelContextFor:b=>current&&b.owner==='A'?{channelId:'A'}:null,channelOwnership:{current:()=>current},refreshOwnedInventory:async()=>{refreshes++},api:async(_,options)=>{posts.push(Object.fromEntries(options.body));return{product_type:posts.at(-1).requested_grade}}};
vm.createContext(c);vm.runInContext(cut('function shopSalesGrade(','function shopRangeSummary(')+cut('function decorateSoldProductSelection(','async function syncSelectedSoldProductGrades(')+cut('async function setProductC(','async function addMarketplaceProductToSelection(')+cut('async function addSoldProductToSelection(','$("#manualCForm").addEventListener'),c);
function rowFixture({name='Order only name',sales=1,showcase=false,kept=false,id='product-1'}={}){
  const p={product_id:id,name,product_url:''},products=showcase?[p]:[],orders=Array.from({length:sales},()=>({product_ids:JSON.stringify([id]),product_details:[p],create_time:100}));
  const html=c.soldProductSummaryTable(products,orders),inserted=[];
  const row={cells:[{},{},{querySelector:()=>({textContent:html.match(/<td><b>([^<]+)<\/b>/)?.[1]||''})},{textContent:id},{textContent:`${sales} ออเดอร์`}],querySelector:()=>null,insertAdjacentHTML:(_,s)=>inserted.push(s)};
  table={querySelector:()=>({querySelector:()=>null,insertAdjacentHTML(){}}),querySelectorAll:()=>[row]};
  c.state.inventoryProducts=kept?[{name,inventory_status:'kept'}]:[];
  c.decorateSoldProductSelection(products,orders);
  const markup=inserted[0],dataset={};
  for(const match of markup.matchAll(/data-([a-z-]+)="([^"]*)"/g))dataset[match[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=match[2];
  return{html,markup,button:{dataset,owner:'A',disabled:false}};
}
for(const sales of [1,16,30]){
  const {html,markup,button}=rowFixture({sales});assert.match(html,/Order only name/);assert.doesNotMatch(html,/ลิงก์สินค้า|ไม่มีลิงก์/);assert.match(markup,/เพิ่มเข้าลิสต์คัดสินค้า/);assert.doesNotMatch(markup,/disabled/);
  assert.equal((html.match(/<th>/g)||[]).length,6);assert.equal((html.match(/<td>/g)||[]).length,6);assert.equal((markup.match(/<td>/g)||[]).length,1,'decorator adds seventh aligned shortlist cell');
  const before=posts.length;assert.equal(refreshes,before,'render makes no write/refresh');await c.addSoldProductToSelection(button);assert.equal(posts.length,before+1);assert.equal(refreshes,before+1);
  assert.deepEqual(posts.at(-1),{action:'set_product_c',channel_id:'A',product_name:'Order only name',score:'0',evidence:`ยอดขาย 30 วัน ${sales} ออเดอร์ · เกรด ${sales>=30?'A':sales>=16?'B':'C'}`,product_url:'',source_kind:'sold_product_selection',requested_grade:sales>=30?'A':sales>=16?'B':'C'});assert.equal(button.disabled,true);
}
assert.doesNotMatch(rowFixture({showcase:true}).markup,/disabled/);
assert.match(rowFixture({kept:true}).markup,/disabled[^>]*>อยู่ในลิสต์คัดสินค้าแล้ว/);
for(const name of ['', '  ', 'ไม่พบรายละเอียดสินค้า', 'ไม่พบชื่อสินค้า'])assert.match(rowFixture({name}).markup,/disabled>ข้อมูลไม่พร้อม/);
const stale=rowFixture().button;current=false;const count=posts.length;await c.addSoldProductToSelection(stale);assert.equal(posts.length,count);current=true;
const resolved=c.resolvedSoldProducts([{product_id:'different',name:'same'}],[{product_details:[{product_id:'target',name:'same'}]}]);assert.equal(resolved.get('target').product_id,'target');
assert.ok(source.includes('decorateSoldProductSelection(products, orders)'));
console.log('PASS v91 actual sold render→decorate→click, order-only blank URL, A/B/C, kept/missing identity, no passive write and stale owner');
