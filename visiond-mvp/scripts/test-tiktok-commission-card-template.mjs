import assert from'node:assert/strict';import fs from'node:fs';import vm from'node:vm';
const source=fs.readFileSync(new URL('../public/tiktok-commission-card.js',import.meta.url),'utf8'),texts=[];
const gradient={addColorStop(){}},ctx={beginPath(){},quadraticCurveTo(){},fill(){},stroke(){},fillRect(){},arc(){},moveTo(){},lineTo(){},createLinearGradient(){return gradient},measureText(value){return{width:String(value).length*35}},fillText(value){texts.push(String(value))}};
const canvas={width:0,height:0,getContext:()=>ctx,toBlob(callback){callback({})}},window={};
vm.runInNewContext(source,{window,document:{createElement:()=>canvas},Intl,Number,String,Math,Date,File:function(){},URL,setTimeout,navigator:{}});
const result=window.VisionDCommissionCard.drawCommissionCard({owner:'รวมทุกช่อง',range:'1–30 กันยายน',total:12345.67,currency:'THB',channels:[{channel:'ช่องหนึ่ง',amount:9000},{channel:'ช่องสอง',amount:3345.67}],referralUrl:'https://visiondonline.com/vtools?ref=abc'});
assert.equal(result.width,1080);assert.equal(result.height,1350);assert.ok(texts.includes('VX'));assert.ok(texts.includes('สรุปค่าคอมมิชชัน'));assert.ok(texts.includes('ช่องหนึ่ง'));assert.ok(texts.some(value=>value.includes('visiondonline.com')));assert.throws(()=>window.VisionDCommissionCard.drawCommissionCard({}),/ไม่มีข้อมูลค่าคอม/);
console.log('TikTok commission share-card template: PASS');
