import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProductCard,createProductDetail,startStorefront} from '../public/toyscenter.js';
import {onRequestGet} from '../functions/api/toys-center/products.js';

const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const source=read('public/toyscenter.js'),css=read('public/toys-center.css'),html=read('public/toyscenter.html'),api=read('functions/api/toys-center/products.js'),feed=read('functions/api/toys-center/feed.csv.js');

class FakeElement{
  constructor(tag='div'){
    this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.className='';this.textContent='';this.hidden=false;this.disabled=false;this.href='';
    const values=new Set();
    this.classList={toggle:(name,on)=>{on?values.add(name):values.delete(name)},contains:name=>values.has(name)};
  }
  append(...children){this.children.push(...children)}
  replaceChildren(...children){this.children=[...children]}
  setAttribute(name,value){this.attributes[name]=String(value)}
  removeAttribute(name){delete this.attributes[name]}
  addEventListener(){}
}

const makeDocument=()=>{
  const nodes={
    '#storeProducts':new FakeElement('div'),'#storeStatus':new FakeElement('p'),'#storePage':new FakeElement('span'),'.pager':new FakeElement('div'),'#storePrev':new FakeElement('button'),'#storeNext':new FakeElement('button'),'#robotsMeta':new FakeElement('meta')
  };
  return{nodes,title:'Toys Center | VisionD',createElement:tag=>new FakeElement(tag),querySelector:selector=>nodes[selector]};
};
const descendants=node=>[node,...node.children.flatMap(descendants)];
const text=node=>descendants(node).map(child=>child.textContent).filter(Boolean).join(' ');

const row={id:7,meta_id:'TOY-0007',slug:'หุ่น-สะสม-7',title:'หุ่นสะสมรุ่น 7',description:'รายละเอียดจริง\nครบสองบรรทัด',availability:'in stock',condition:'used',price_cents:185000,price:1850,currency:'THB',brand:'Vision Toy',quantity:2,image_1_key:'one.jpg',image_2_key:'two.jpg',image_1_url:'https://fixture.invalid/api/toys-center/images/7/1',image_2_url:'https://fixture.invalid/api/toys-center/images/7/2',status:'published'};

const doc=makeDocument(),card=createProductCard(row,doc);
assert.equal(card.tagName,'A','list card is a native keyboard-accessible link');
assert.equal(card.href,'/toyscenter?product=%E0%B8%AB%E0%B8%B8%E0%B9%88%E0%B8%99-%E0%B8%AA%E0%B8%B0%E0%B8%AA%E0%B8%A1-7');
assert.equal(card.attributes['aria-label'],'ดูรายละเอียด หุ่นสะสมรุ่น 7');
assert.equal(descendants(card).filter(node=>node.tagName==='IMG').length,1,'list loads only its preview image');
assert.equal(descendants(card).find(node=>node.tagName==='IMG').src,row.image_2_url);

const detail=createProductDetail(row,doc),detailImages=descendants(detail).filter(node=>node.tagName==='IMG');
assert.equal(detail.tagName,'ARTICLE');
assert.equal(detail.children[0].tagName,'A');assert.equal(detail.children[0].href,'/toyscenter');
assert.deepEqual(detailImages.map(image=>image.src),[row.image_2_url]);
for(const expected of [row.title,row.description,'1,850.00 บาท','พร้อมขาย','มือสอง',row.brand,'2','กลับไปดูสินค้าทั้งหมด'])assert.ok(text(detail).includes(expected),expected);

const listDoc=makeDocument(),listUrls=[];
let app=startStorefront(listDoc,{location:{href:'https://fixture.invalid/toyscenter'}},async url=>{listUrls.push(url);return new Response(JSON.stringify({storefront_mode:'public',items:[row],pagination:{page:1,limit:24,total:25}}),{status:200,headers:{'content-type':'application/json'}})});
await app.ready;
assert.deepEqual(listUrls,['/api/toys-center/products?page=1']);
assert.equal(listDoc.nodes['#storeProducts'].children[0].tagName,'A');
assert.equal(listDoc.nodes['.pager'].hidden,false);assert.equal(listDoc.nodes['#storeNext'].disabled,false);assert.equal(listDoc.nodes['#robotsMeta'].content,'index,follow');

const detailDoc=makeDocument(),detailUrls=[];
app=startStorefront(detailDoc,{location:{href:`https://fixture.invalid/toyscenter?product=${encodeURIComponent(row.slug)}`}},async url=>{detailUrls.push(url);return new Response(JSON.stringify({item:row}),{status:200,headers:{'content-type':'application/json'}})});
await app.ready;
assert.deepEqual(detailUrls,[`/api/toys-center/products?slug=${encodeURIComponent(row.slug)}`]);
assert.equal(detailDoc.nodes['.pager'].hidden,true,'focused detail hides list paging');
assert.equal(detailDoc.nodes['#storeProducts'].classList.contains('store-grid--detail'),true);
assert.equal(detailDoc.nodes['#storeProducts'].children[0].className,'store-detail');
assert.equal(detailDoc.title,`${row.title} | Toys Center | VisionD`);

const missingDoc=makeDocument();
app=startStorefront(missingDoc,{location:{href:'https://fixture.invalid/toyscenter?product=missing'}},async()=>new Response(JSON.stringify({error:'ไม่พบสินค้า'}),{status:404,headers:{'content-type':'application/json'}}));
await app.ready;
assert.equal(missingDoc.nodes['#storeStatus'].textContent,'ไม่พบสินค้า');
assert.equal(missingDoc.nodes['#storeStatus'].dataset.state,'error');
assert.equal(missingDoc.nodes['#storeProducts'].children.length,0);assert.equal(missingDoc.nodes['.pager'].hidden,true);

const calls=[];
const env={DB:{prepare(sql){const statement={args:[],bind(...args){this.args=args;return this},async first(){calls.push({sql,args:this.args});if(sql.includes('WHERE slug=?'))return this.args[0]===row.slug?row:null;if(sql.includes('toys_center_settings'))return{storefront_mode:'public'};if(sql.includes('COUNT(*)'))return{total:25};return null},async all(){calls.push({sql,args:this.args});return{results:[row]}}};return statement}}};
let response=await onRequestGet({request:new Request(`https://fixture.invalid/api/toys-center/products?slug=${encodeURIComponent(row.slug)}`),env});
assert.equal(response.status,200);let body=await response.json();assert.equal(body.item.slug,row.slug);assert.equal(body.item.image_2_url,row.image_2_url);
response=await onRequestGet({request:new Request('https://fixture.invalid/api/toys-center/products?slug=missing'),env});assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'ไม่พบสินค้า'});
response=await onRequestGet({request:new Request('https://fixture.invalid/api/toys-center/products?page=2'),env});assert.equal(response.status,200);body=await response.json();assert.deepEqual(body.pagination,{page:2,limit:24,total:25});
assert.ok(calls.some(call=>call.sql.includes('LIMIT ? OFFSET ?')&&call.args[0]===24&&call.args[1]===24),'24-item list query remains bounded');
assert.match(api,/WHERE slug=\? AND status='published'/,'detail remains published-only indexed slug lookup');
assert.match(feed,/\$\{origin\}\/toyscenter\?product=\$\{encodeURIComponent\(r\.slug\)\}/,'Meta deep link remains unchanged');
assert.match(feed,/mediaUrl\(origin,r\.id,2\)/,'Meta image slot remains unchanged');

for(const token of ['.store-image-stage{','[hidden]{display:none!important}','.store-detail-layout{','@media(max-width:800px)','@media(max-width:460px)'])assert.ok(css.includes(token),token);
assert.match(css,/\.store-image-stage img\{[^}]*width:100%;height:auto;aspect-ratio:1\/1;object-fit:scale-down/,'a definite square image box constrains both stage axes while its pixels are never cropped or unnecessarily enlarged');
assert.doesNotMatch(css,/\.store-image-stage img\{[^}]*(?:width:auto|height:100%|max-height:100%)/,'intrinsic or unresolved percentage height must not let portrait images escape the fixed stage');
assert.doesNotMatch(css,/\.store-product img\{[^}]*object-fit:cover/,'public cards no longer crop images');
assert.match(html,/toys-center\.css\?v=020108/);assert.match(html,/toyscenter\.js\?v=020108/);
assert.match(source,/doc\.createElement\('a'\)/);assert.match(source,/createProductDetail\(data\.item,doc\)/);assert.doesNotMatch(source,/cart|checkout|payment|ติดต่อผู้ขาย/i);
assert.equal(read('VERSION.txt').trim(),'v0.20.108');assert.match(read('public/index.html'),/WEB v0\.20\.108/);assert.match(read('public/admin.html'),/ADMIN v0\.20\.108/);

console.log('PASS v0.20.106 Toys Center semantic cards, focused published detail, current public image contract, truthful errors and preserved 24-item/Meta contracts');
