import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {DatabaseSync} from 'node:sqlite';

const file=path=>readFileSync(new URL(path,import.meta.url));
const source=file('../public/bots-storefront.js').toString();
const logoHash=createHash('sha256').update(file('../public/assets/follow-me-logo.png')).digest('hex').toUpperCase();
assert.equal(logoHash,'DF2D2765AFCAE78910E34BE457EC0FEDCED408922B9B70586A8B789A8A3A34D6');
assert.match(file('../public/index.html').toString(),/src="\/assets\/follow-me-logo\.png" alt="Follow me/);
assert.match(file('../functions/api/admin/vision7/programs.js').toString(),/code === 'auto-invite' \? '\/assets\/follow-me-logo\.png'/);

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE vision7_programs(id INTEGER PRIMARY KEY,code TEXT,cover_url TEXT);
CREATE TABLE products(id INTEGER PRIMARY KEY,slug TEXT,price INTEGER,cover_url TEXT,preview_urls TEXT);
INSERT INTO vision7_programs VALUES(4,'auto-invite','/auto-invite-cover.svg'),(5,'other','/auto-invite-cover.svg');
INSERT INTO products VALUES
(5497,'vbot-key-auto-invite-lifetime',159000,'/auto-invite-cover.svg','["/auto-invite-cover.svg"]'),
(5504,'vbot-key-auto-invite-monthly',59000,'/auto-invite-cover.svg','["/auto-invite-cover.svg"]'),
(6000,'other',59000,'/auto-invite-cover.svg','["/auto-invite-cover.svg"]');`);
const migration=file('../migrations/0149_follow_me_logo.sql').toString();
db.exec(migration);db.exec(migration);
assert.equal(db.prepare('SELECT cover_url FROM vision7_programs WHERE id=4').get().cover_url,'/assets/follow-me-logo.png');
assert.equal(db.prepare('SELECT cover_url FROM vision7_programs WHERE id=5').get().cover_url,'/auto-invite-cover.svg');
for(const [id,price] of [[5497,159000],[5504,59000]]){
  const row=db.prepare('SELECT price,cover_url,preview_urls FROM products WHERE id=?').get(id);
  assert.equal(row.price,price);assert.equal(row.cover_url,'/assets/follow-me-logo.png');
  assert.equal(row.preview_urls,'["/assets/follow-me-logo.png"]');
}
assert.equal(db.prepare('SELECT cover_url FROM products WHERE id=6000').get().cover_url,'/auto-invite-cover.svg');
db.exec(`UPDATE products SET cover_url='/auto-invite-cover.svg',preview_urls='["custom"]' WHERE id=5504`);
db.exec(migration);
assert.equal(db.prepare('SELECT cover_url FROM products WHERE id=5504').get().cover_url,'/auto-invite-cover.svg','custom preview guard prevents overwrite');

const storage=new Map([['vd_cart',JSON.stringify([{slug:'unrelated',price:5000,quantity:1}])]]);
let offerButtons=[],buyButtons=[];const navigations=[],alerts=[];
const button=(kind,id)=>({dataset:{[kind]:id},textContent:'',attributes:{},setAttribute(name,value){this.attributes[name]=value}});
const content={html:'',set innerHTML(html){this.html=html;offerButtons=[...html.matchAll(/data-offer="(\d+)"/g)].map(match=>button('offer',match[1]));buyButtons=[...html.matchAll(/data-buy="(\d+)"/g)].map(match=>button('buy',match[1]))},get innerHTML(){return this.html},querySelectorAll(selector){return selector==='[data-offer]'?offerButtons:selector==='[data-buy]'?buyButtons:[]},querySelector(){return null}};
const state={textContent:''};
const document={querySelector(selector){return selector==='#vbotCartState'?state:{setAttribute(){}}},querySelectorAll(){return []},title:''};
const names=['getCart','cartCount','updateCartCount','normalizedOffers','durationLabel','appTitle','appDescription','offerPrice','syncOfferButtons','addOffer','detail'];
const lines=names.map(name=>{
  const line=source.match(new RegExp(`^(?:const |function )${name}\\b.*$`,'m'))?.[0];
  assert.ok(line,`missing storefront ${name}`);return line;
});
const api=runInNewContext(`${lines.join('\n')};({normalizedOffers,detail})`,{
  content,document,search:{hidden:false},storePath:'/vtools',placeholder:'/placeholder',
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  location:{assign:path=>navigations.push(path)},window:{visiondPixel:{track(){}}},
  alert:message=>alerts.push(message),esc:value=>String(value),money:cents=>`${Number(cents)/100} บาท`,platformLabel:value=>value,
});
const cart=()=>JSON.parse(storage.get('vd_cart'));
const splus={code:'splus',app_name:'S+',platform_type:'windows',cover_url:'/assets/splus-logo.png',offers:[
  {id:100,code:'accounts100',offer_price:249000,product_id:101,product_slug:'splus-100'},
  {id:30,code:'accounts30',offer_price:99000,product_id:102,product_slug:'splus-30'},
  {id:50,code:'accounts50',offer_price:149000,product_id:103,product_slug:'splus-50'},
]};
api.detail(splus);
assert.deepEqual(offerButtons.map(b=>Number(b.dataset.offer)),[30,50,100]);
assert.deepEqual(buyButtons.map(b=>Number(b.dataset.buy)),[30,50,100]);
assert.match(content.html,/ตลอดชีพ · 30 บัญชี<\/h3><strong>990 บาท/);
assert.match(content.html,/ตลอดชีพ · 50 บัญชี<\/h3><strong>1490 บาท/);
assert.match(content.html,/ตลอดชีพ · 100 บัญชี<\/h3><strong>2490 บาท/);
offerButtons[1].onclick();
assert.deepEqual(cart().map(x=>x.slug),['unrelated','splus-50']);
assert.equal(cart()[1].vision7_plan_id,50);assert.equal(cart()[1].price,149000);
assert.deepEqual(offerButtons.map(b=>b.attributes['aria-pressed']),['false','true','false']);
assert.deepEqual(offerButtons.map(b=>b.textContent),['ใส่รถเข็น','อยู่ในรถเข็นแล้ว ✓','ใส่รถเข็น']);
offerButtons[2].onclick();
assert.deepEqual(cart().map(x=>x.slug),['unrelated','splus-100']);
assert.deepEqual(offerButtons.map(b=>b.attributes['aria-pressed']),['false','false','true']);
assert.deepEqual(offerButtons.map(b=>b.textContent),['ใส่รถเข็น','ใส่รถเข็น','อยู่ในรถเข็นแล้ว ✓']);
buyButtons[0].onclick();
assert.deepEqual(cart().map(x=>x.slug),['unrelated','splus-30']);
assert.equal(cart()[1].price,99000);assert.deepEqual(navigations,['/cart']);
assert.deepEqual(offerButtons.map(b=>b.attributes['aria-pressed']),['true','false','false']);
buyButtons[0].onclick();
assert.deepEqual(navigations,['/cart','/cart'],'buy remains available for already-selected tier');
api.detail(splus);
assert.deepEqual(offerButtons.map(b=>b.attributes['aria-pressed']),['true','false','false'],'selected tier persists after detail reload');

const follow={code:'auto-invite',app_name:'Follow me',platform_type:'windows',cover_url:'/assets/follow-me-logo.png',offers:[
  {id:2,code:'lifetime',offer_price:159000,product_id:202,product_slug:'follow-lifetime'},
  {id:1,code:'monthly',offer_price:59000,product_id:201,product_slug:'follow-monthly'},
]};
api.detail(follow);
assert.deepEqual(offerButtons.map(b=>Number(b.dataset.offer)),[1,2]);
assert.match(content.html,/30 วัน<\/h3><strong>590 บาท/);
assert.match(content.html,/ตลอดชีพ<\/h3><strong>1590 บาท/);
offerButtons[0].onclick();buyButtons[1].onclick();
assert.deepEqual(cart().map(x=>x.slug),['unrelated','splus-30','follow-lifetime']);
assert.equal(cart()[2].vision7_plan_id,2);assert.equal(cart()[2].price,159000);
assert.deepEqual(offerButtons.map(b=>b.attributes['aria-pressed']),['false','true']);
assert.equal(navigations.at(-1),'/cart');
assert.deepEqual(alerts,[]);
storage.set('vd_cart',JSON.stringify([
  {slug:'unrelated',price:5000,quantity:1},
  {slug:'splus-100',vbot_app_code:'splus',price:249000,quantity:1},
  {slug:'unrelated-two',price:9000,quantity:1},
  {slug:'splus-30',price:99000,quantity:1},
  {slug:'splus-50',vbot_app_code:'splus',price:149000,quantity:1},
]));
api.detail(splus);buyButtons[0].onclick();
assert.deepEqual(cart().map(x=>x.slug),['unrelated','splus-30','unrelated-two'],'legacy duplicate tiers collapse at first same-app position');
assert.equal(cart()[1].vision7_plan_id,30);assert.equal(cart()[1].price,99000);
assert.deepEqual(offerButtons.map(b=>b.attributes['aria-pressed']),['true','false','false']);
assert.equal(navigations.at(-1),'/cart');
console.log('Vtools logo migration, sorted S+/Follow me offers, selected cart tier and direct buy passed');
