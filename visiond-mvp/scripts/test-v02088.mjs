import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync('public/tiktok-analyzer.js','utf8');
const render=source.match(/function renderMarketplaceProducts[\s\S]*?\n\}/)[0];
for(const mode of ['product','shop']){
 const box={innerHTML:'',querySelectorAll:()=>[]},view={box,addButton:{},snapshot:{},products:[],comparisonDays:3};
 const context={state:{},marketplaceView:()=>view,$:()=>null,channelOwnership:{capture:()=>null}};
 vm.runInNewContext(render+';renderMarketplaceProducts({},'+JSON.stringify(mode)+');',context);
 const headings=[...box.innerHTML.matchAll(/<th>(.*?)<\/th>/g)].map(x=>x[1]);
 assert.equal(headings[1],mode==='shop'?'รูปและสินค้า':'สินค้า');
 assert.equal(headings.length,mode==='shop'?9:10);
 assert.doesNotMatch(box.innerHTML,/<th>สินค้า Open Collaboration<\/th>/);
}
assert.match(source,/กำลังค้นหาสินค้า Open Collaboration จาก TikTok/,'source semantics outside heading stay intact');
console.log('PASS v88 actual marketplace render exact product heading and unchanged shop/source semantics');
