import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root=new URL('../',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
async function htmlFiles(dir='public'){
  const out=[];
  for(const entry of await readdir(new URL(dir+'/',root),{withFileTypes:true})){
    const rel=path.posix.join(dir,entry.name);
    if(entry.isDirectory())out.push(...await htmlFiles(rel));
    else if(entry.name.endsWith('.html'))out.push(rel);
  }
  return out;
}
const pages=await htmlFiles();
assert.equal(pages.length,38,'จำนวนหน้า HTML เปลี่ยน ต้องตรวจ coverage ใหม่');
for(const page of pages){
  const source=await read(page);
  assert.match(source,/\/visiond-button-system\.css\?v=014187/,page+' ไม่มี CSS ปุ่มมาตรฐาน');
  assert.match(source,/\/visiond-button-system\.js\?v=014187/,page+' ไม่มี runtime ปุ่มมาตรฐาน');
  assert.ok(source.indexOf('visiond-button-system.css')<source.indexOf('</head>'),page+' โหลด CSS ผิดตำแหน่ง');
}
const [css,js,base,index,admin,version]=await Promise.all([
  read('public/visiond-button-system.css'),read('public/visiond-button-system.js'),
  read('public/visiond-design-system.css'),read('public/index.html'),
  read('public/admin.html'),read('VERSION.txt')
]);
assert.match(css,/--vdb-primary:#0abab5/);
assert.match(css,/min-height:44px!important/,'ปุ่มมือถือเล็กกว่า touch target');
assert.match(css,/@media\(max-width:800px\)/,'ไม่มีกฎมือถือ');
for(const variant of['primary','secondary','tonal','text','promotion','danger','icon'])assert.ok(css.includes('.vds-btn--'+variant),variant);
assert.match(js,/MutationObserver/,'ปุ่มที่สร้างภายหลังไม่ถูกจัดมาตรฐาน');
assert.match(js,/dataset\.vdsExempt='layout-control'/,'ฉากหลังเมนูไม่ได้รับการยกเว้น');
assert.ok(js.indexOf("if(unstyled.test(key))")<js.indexOf("node.classList.add('vds-btn')"),'เพิ่ม class ก่อนตรวจข้อยกเว้น');
assert.doesNotMatch(base,/linear-gradient\(135deg,#2f80ed,#7b61ff\)/,'primary เก่ายังชนกับมาตรฐาน');
assert.equal(version.trim(),'v0.14.187');
assert.match(index,/WEB v0\.14\.187/);
assert.match(admin,/ADMIN v0\.14\.187/);
console.log('v0.14.187 template + button contract: PASS (38/38 pages, desktop/mobile rules)');
