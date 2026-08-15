import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const read=p=>readFile(new URL(`../${p}`,import.meta.url),'utf8');
const [css,shell,sharedNav,protocol,protocolHistory,roadmap]=await Promise.all([
  read('public/visiond-button-system.css'),read('public/header-shell.js'),read('public/shared-nav.js'),read('JARVIS-PATCH-PROTOCOL.md'),
  read('work-history/visiond/protocols/JARVIS-PATCH-PROTOCOL.md'),
  read('work-history/visiond/roadmap/VISIOND-ROADMAP.md')
]);
for(const token of[
  '.topbar.mobile-nav-ready>nav .vd-language-switcher',
  '.topbar .vd-language-switcher',
  'width:max-content!important','max-width:100%!important',
  'align-self:flex-start!important','height:44px!important',
  '.vd-language-switcher i{display:none!important}'
])assert.ok(css.includes(token),token);
for(const source of[protocol,protocolHistory])for(const rule of[
  'Permanent template control rule','content-width','never a full-width navigation row',
  'Android-size','iPhone-size','Every Event Case and Event Roadmap queue',
  'exactly one cart action','normalized `vd_cart` quantity total'
])assert.ok(source.includes(rule),rule);
for(const token of['function syncCart(header)','links.forEach(link=>{if(link!==canonical)link.remove()})',"item?.category==='resale-rights'",'Math.min(quantity,30-total)','VisionDCartCount','VisionDSyncCartHeader'])assert.ok(shell.includes(token),token);
assert.match(shell,/header\.children[^\n]+utility\.append/,'ต้องย้าย utility ที่หลุดออกจาก nav กลับเข้าช่องมาตรฐาน');
for(const token of['languageSwitcher=staleUtility?.querySelector','languageSwitcher?.remove()','if(languageSwitcher)nav.append(languageSwitcher)'])assert.ok(sharedNav.includes(token),token);
let saved='[]';
const sandbox={localStorage:{getItem:()=>saved},document:{readyState:'loading',addEventListener(){}},globalThis:null};
sandbox.globalThis=sandbox;vm.runInNewContext(shell,sandbox);
const count=items=>{saved=JSON.stringify(items);return sandbox.VisionDCartCountValue()};
assert.equal(count([{slug:'a',quantity:9},{slug:'a',quantity:1}]),1,'สินค้าดิจิทัลซ้ำ/quantity ผิดต้องนับหนึ่ง');
assert.equal(count([{slug:'a'},{slug:'course-selling-rights',category:'resale-rights',quantity:5}]),6,'สิทธิ์ Vision 5 ต้องนับ quantity');
assert.equal(count([{slug:'course-selling-rights',category:'resale-rights',quantity:99}]),30,'รถเข็นต้องไม่เกิน 30');
saved='{broken';assert.equal(sandbox.VisionDCartCountValue(),0,'ข้อมูลรถเข็นเสียต้องคืนศูนย์');
assert.match(roadmap,/v0\.14\.189/);
console.log('v0.14.189 compact language switcher + permanent template rule: PASS');
