import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createToyImagePipeline,
  TOY_IMAGE_MAX_ATTEMPTS,
  TOY_IMAGE_MAX_BYTES,
  TOY_IMAGE_MAX_CONCURRENCY,
  TOY_IMAGE_MAX_EDGE,
  TOY_IMAGE_SOURCE_MAX_BYTES,
  TOY_IMAGE_TARGET_BYTES
} from '../public/toys-center-image.js';
import {readToyImage} from '../functions/_toys_center.js';

const headers={
  'image/jpeg':new Uint8Array([0xff,0xd8,0xff,0xe0,0,1,0xff,0xd9]),
  'image/png':new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
  'image/webp':new Uint8Array([0x52,0x49,0x46,0x46,4,0,0,0,0x57,0x45,0x42,0x50])
};
const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
class ReportedFile extends File{constructor(bytes,name,type,size){super([bytes],name,{type,lastModified:123});this.reportedSize=size}get size(){return this.reportedSize}}
class ReportedBlob extends Blob{constructor(bytes,type,size){super([bytes],{type});this.reportedSize=size}get size(){return this.reportedSize}}
const largeFile=(type,name='source.'+extension[type],size=TOY_IMAGE_MAX_BYTES+1)=>new ReportedFile(headers[type],name,type,size);
const encoded=(type,size=4096)=>new Blob([headers[type],new Uint8Array(Math.max(0,size-headers[type].length))],{type});
const decoded=(width=4000,height=3000)=>({source:{},width,height,close(){}});
const magic=async file=>Buffer.from(await file.slice(0,12).arrayBuffer()).toString('hex');

let smallDecodes=0;
const smallPipeline=createToyImagePipeline({decodeImage:async()=>{smallDecodes++;return decoded()},encodeImage:async()=>encoded('image/jpeg')});
for(const [type,bytes] of Object.entries(headers)){
  const file=new File([bytes],`keep.${extension[type]}`,{type});
  assert.equal(await smallPipeline.resolveFile(file,'image_1'),file,'supported <=5 MiB VisionD source remains byte-identical');
  assert.equal(await smallPipeline.resolveFile(file,'image_2'),file,'standard Meta behavior remains byte-identical');
}
assert.equal(smallDecodes,0,'standard <=5 MiB files are never decoded');
await assert.rejects(smallPipeline.resolveFile(new File([headers['image/png']],'small-spoof.jpg',{type:'image/jpeg'}),'image_1'),/ไฟล์ไม่ตรงกับชนิด/);assert.equal(smallDecodes,0,'small corrupt/disguised VisionD input is rejected without decode');

const dimensions=[];
const pipeline=createToyImagePipeline({
  decodeImage:async()=>decoded(),
  encodeImage:async(_decoded,width,height,type)=>{dimensions.push({width,height,type});return encoded(type)}
});
const originals=['image/jpeg','image/png','image/webp'].map(type=>largeFile(type));
const outputs=await Promise.all(originals.map(file=>pipeline.resolveFile(file,'image_1')));
for(let index=0;index<outputs.length;index++){
  const output=outputs[index],source=originals[index];
  assert.notEqual(output,source);assert.equal(output.type,source.type);assert.equal(output.name,source.name);assert.ok(output.size<=TOY_IMAGE_TARGET_BYTES);
  assert.equal((await magic(output)).startsWith(Buffer.from(headers[source.type]).toString('hex')),true);
}
assert.deepEqual(dimensions.map(({width,height})=>[width,height]),[[TOY_IMAGE_MAX_EDGE,1920],[TOY_IMAGE_MAX_EDGE,1920],[TOY_IMAGE_MAX_EDGE,1920]],'large sources preserve aspect and cap the initial longest edge');
const summary=pipeline.summarize(originals);
assert.equal(summary.count,3);assert.equal(summary.optimizedCount,3);assert.equal(summary.sourceBytes,3*(TOY_IMAGE_MAX_BYTES+1));assert.equal(summary.outputBytes,outputs.reduce((sum,file)=>sum+file.size,0));

let cacheDecodes=0,cacheEncodes=0;
const cachePipeline=createToyImagePipeline({decodeImage:async()=>{cacheDecodes++;return decoded(800,600)},encodeImage:async(_decoded,width,height,type)=>{cacheEncodes++;assert.deepEqual([width,height],[800,600],'optimizer never upscales');return encoded(type)}});
const cachedSource=largeFile('image/jpeg','cached.jpg');
const [cachedA,cachedB,cachedC]=await Promise.all([cachePipeline.resolveFile(cachedSource,'image_1'),cachePipeline.resolveFile(cachedSource,'image_1'),cachePipeline.resolveFile(cachedSource,'image_1')]);
assert.equal(cachedA,cachedB);assert.equal(cachedB,cachedC);assert.equal(cacheDecodes,1);assert.equal(cacheEncodes,1,'one in-flight/result per unchanged File');

let active=0,peak=0;
const concurrencyPipeline=createToyImagePipeline({decodeImage:async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,15));active--;return decoded()},encodeImage:async(_decoded,_width,_height,type)=>encoded(type)});
const ten=Array.from({length:10},(_,index)=>largeFile('image/jpeg',`queued-${index}.jpg`));
const ordered=await concurrencyPipeline.selectFiles('image_1',ten);
assert.equal(peak,TOY_IMAGE_MAX_CONCURRENCY);assert.deepEqual(ordered.map(file=>file.name),ten.map(file=>file.name),'bounded work preserves selection order');

let releaseFirst;
const gate=new Promise(resolve=>{releaseFirst=resolve}),started=[];
const stalePipeline=createToyImagePipeline({decodeImage:async blob=>{started.push(blob.name);if(started.length<=2)await gate;return decoded()},encodeImage:async(_decoded,_width,_height,type)=>encoded(type)});
const staleSources=Array.from({length:10},(_,index)=>largeFile('image/jpeg',`stale-${index}.jpg`));
const staleSelection=stalePipeline.selectFiles('image_1',staleSources).catch(error=>error);
await new Promise(resolve=>setTimeout(resolve,5));
const replacement=largeFile('image/jpeg','replacement.jpg'),replacementSelection=stalePipeline.selectFiles('image_1',[replacement]);
releaseFirst();await staleSelection;assert.equal((await replacementSelection)[0].name,'replacement.jpg');
assert.deepEqual(started.sort(),['replacement.jpg','stale-0.jpg','stale-1.jpg'].sort(),'queued stale files are discarded before decode');

let releaseCrossRole,crossRoleEntered=0,crossRoleReadyResolve;const crossRoleGate=new Promise(resolve=>{releaseCrossRole=resolve}),crossRoleReady=new Promise(resolve=>{crossRoleReadyResolve=resolve}),crossRoleCalls=new Map();
const crossRolePipeline=createToyImagePipeline({decodeImage:async file=>{crossRoleCalls.set(file,(crossRoleCalls.get(file)||0)+1);crossRoleEntered++;if(crossRoleEntered===2)crossRoleReadyResolve();if(file.name==='cross-first.jpg'||file.name==='cross-second.jpg')await crossRoleGate;return decoded(100,100)},encodeImage:async()=>encoded('image/jpeg')});
const crossFirst=largeFile('image/jpeg','cross-first.jpg'),crossSecond=largeFile('image/jpeg','cross-second.jpg'),crossShared=largeFile('image/jpeg','cross-shared.jpg');
const staleCrossRole=crossRolePipeline.selectFiles('image_1',[crossFirst,crossSecond,crossShared]).catch(error=>error);await crossRoleReady;await crossRolePipeline.select('image_2',crossShared);crossRolePipeline.reset('image_1');releaseCrossRole();await staleCrossRole;
assert.equal(crossRoleCalls.get(crossShared)||0,0,'a File retained only in Meta cannot keep its queued VisionD normalization live');

let attempts=0;
const exhausted=createToyImagePipeline({decodeImage:async()=>decoded(),encodeImage:async(_decoded,_width,_height,type)=>{attempts++;return new ReportedBlob(headers[type],type,TOY_IMAGE_TARGET_BYTES+1)}});
await assert.rejects(exhausted.resolveFile(largeFile('image/png','dense.png'),'image_1'),/เกิน 5 MB/);assert.equal(attempts,TOY_IMAGE_MAX_ATTEMPTS);
let guardedDecodes=0;
const guarded=createToyImagePipeline({decodeImage:async()=>{guardedDecodes++;return decoded(10000,5000)},encodeImage:async()=>encoded('image/jpeg')});
await assert.rejects(guarded.resolveFile(largeFile('image/jpeg','bomb.jpg'),'image_1'),/40 ล้านพิกเซล/);assert.equal(guardedDecodes,1);
await assert.rejects(guarded.resolveFile(new ReportedFile(headers['image/jpeg'],'too-large.jpg','image/jpeg',TOY_IMAGE_SOURCE_MAX_BYTES+1),'image_1'),/64 MB/);assert.equal(guardedDecodes,1,'source guard runs before decode');
await assert.rejects(guarded.resolveFile(new ReportedFile(headers['image/png'],'spoof.jpg','image/jpeg',TOY_IMAGE_MAX_BYTES+1),'image_1'),/ไฟล์ไม่ตรงกับชนิด/);assert.equal(guardedDecodes,1,'magic mismatch runs before decode');

const heicSource=new ReportedFile(new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x68,0x65,0x69,0x63]),'camera.heic','image/heic',TOY_IMAGE_MAX_BYTES+1);
const heicBlob=new ReportedBlob(headers['image/jpeg'],'image/jpeg',TOY_IMAGE_TARGET_BYTES+1);
const heicPipeline=createToyImagePipeline({loadDecoder:async()=>({isHeic:async()=>true,heicTo:async()=>heicBlob}),decodeImage:async()=>decoded(),encodeImage:async(_decoded,_width,_height,type)=>encoded(type)});
const heicOutput=await heicPipeline.resolveFile(heicSource,'image_1');assert.equal(heicOutput.name,'camera.jpg');assert.equal(heicOutput.type,'image/jpeg');assert.ok(heicOutput.size<=TOY_IMAGE_TARGET_BYTES);

const metaLarge=largeFile('image/jpeg','meta-large.jpg');assert.equal(await smallPipeline.resolveFile(metaLarge,'image_2'),metaLarge,'oversized standard Meta source remains unchanged for server defense');
const sharedLarge=largeFile('image/jpeg','shared.jpg'),rolePipeline=createToyImagePipeline({decodeImage:async()=>decoded(),encodeImage:async(_decoded,_width,_height,type)=>encoded(type)});
const metaFirst=await rolePipeline.resolveFile(sharedLarge,'image_2'),visionAfter=await rolePipeline.resolveFile(sharedLarge,'image_1');assert.equal(metaFirst,sharedLarge);assert.notEqual(visionAfter,sharedLarge,'Meta-first cache cannot leak a raw oversized file into VisionD');
const sharedHeic=new ReportedFile(new Uint8Array([0,0,0,24,0x66,0x74,0x79,0x70,0x68,0x65,0x69,0x63]),'shared.heic','image/heic',TOY_IMAGE_MAX_BYTES+1),roleHeic=createToyImagePipeline({loadDecoder:async()=>({isHeic:async()=>true,heicTo:async()=>new Blob([headers['image/jpeg']],{type:'image/jpeg'})}),decodeImage:async()=>decoded(),encodeImage:async(_decoded,_width,_height,type)=>encoded(type)});
const visionHeic=await roleHeic.resolveFile(sharedHeic,'image_1'),metaHeic=await roleHeic.resolveFile(sharedHeic,'image_2');assert.notEqual(visionHeic,metaHeic,'VisionD and Meta retain role-specific cache results for the same HEIC File');
for(const [type,name] of [['image/jpeg','raw.jpg'],['image/png','raw.png'],['image/webp','raw.webp'],['image/heic','raw.heic']]){
  let buffered=0;const raw=new ReportedFile(type==='image/heic'?heicSource:headers[type],name,type,TOY_IMAGE_MAX_BYTES+1);raw.arrayBuffer=async()=>{buffered++;return new ArrayBuffer(0)};
  await assert.rejects(readToyImage(raw,1),/ไม่เกิน 5 MB/);assert.equal(buffered,0,'server rejects raw oversized bypass before buffering');
}
const adminSource=fs.readFileSync(new URL('../public/toys-center-admin.js',import.meta.url),'utf8'),adminHtml=fs.readFileSync(new URL('../public/toys-center-admin.html',import.meta.url),'utf8');
assert.match(adminSource,/toys-center-image\.js\?v=020114/);assert.match(adminSource,/ปรับรูป VisionD.*MB →.*MB/);assert.match(adminHtml,/toys-center-admin\.js\?v=020114/);assert.match(adminHtml,/toys-center\.css\?v=020114/);assert.match(adminHtml,/v0\.20\.114/);assert.equal(fs.readFileSync(new URL('../VERSION.txt',import.meta.url),'utf8').trim(),'v0.20.114');

console.log('PASS v0.20.114 bounded VisionD optimizer identity, MIME/magic, aspect/no-upscale, cache, order, stale queue, resource guards and server bypass');
