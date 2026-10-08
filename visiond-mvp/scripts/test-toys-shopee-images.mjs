import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {prepareShopeeImage,shopeeDerivativeKey} from '../functions/_toys_center_shopee_images.js';
import {onRequestGet,onRequestHead} from '../functions/api/toys-center/shopee-images/[id]/[file].js';
import {sanitizeShopeeImage} from '../workers/live-portrait-sanitizer/src/index.js';

const require=createRequire(import.meta.url);
let sharp;for(const candidate of [process.env.SHARP_PACKAGE,'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp','sharp'].filter(Boolean)){try{sharp=require(candidate);break}catch{}}
if(!sharp)throw new Error('sharp is required for real image decoding test');
const jpeg=new Uint8Array(await fs.readFile(new URL('../public/assets/visiond-og-preview.jpg',import.meta.url)));
assert.equal(jpeg[0],0xff);assert.equal(jpeg[1],0xd8);assert.equal(jpeg.at(-2),0xff);assert.equal(jpeg.at(-1),0xd9);
const pixels=new Uint8Array(32*32*4);
for(let y=8;y<24;y++)for(let x=8;x<24;x++){const offset=(y*32+x)*4;pixels[offset]=255;pixels[offset+3]=255}
const webp=new Uint8Array(await sharp(pixels,{raw:{width:32,height:32,channels:4}}).webp({lossless:true}).toBuffer());
assert.equal((await sharp(webp).metadata()).format,'webp');
const smallPng=new Uint8Array(await sharp(pixels,{raw:{width:32,height:32,channels:4}}).png().toBuffer());
const largePng=new Uint8Array(await sharp(randomBytes(900*900*3),{raw:{width:900,height:900,channels:3}}).png().toBuffer());
assert.ok(largePng.length>2*1024*1024&&largePng.length<5*1024*1024);
const transforms=[];
const imagesBinding={
  info:async stream=>{const bytes=new Uint8Array(await new Response(stream).arrayBuffer());return sharp(bytes).metadata()},
  input:stream=>({transform:options=>{transforms.push(options);return{output:async format=>{const bytes=new Uint8Array(await new Response(stream).arrayBuffer());const output=await sharp(bytes).resize(options.width,options.height,{fit:'inside',withoutEnlargement:true}).flatten({background:options.background}).jpeg({quality:format.quality}).toBuffer();return{response:()=>new Response(output,{headers:{'content-type':'image/jpeg'}})}}}}}),
};
let attempts=0;const retryOptions=[];
const retryBinding={
  info:imagesBinding.info,
  input:()=>({transform:options=>{retryOptions.push(options);return{output:()=>({response:()=>{attempts++;const bytes=attempts===1?new Uint8Array(5*1024*1024+1):jpeg;return new Response(bytes,{headers:{'content-type':'image/jpeg'}})}})}}}),
};
const retry=await sanitizeShopeeImage(new Request('https://portrait-sanitizer.internal/v1/shopee-reencode',{method:'POST',headers:{'content-type':'image/webp','x-visiond-sanitizer-protocol':'1','x-visiond-input-bytes':String(webp.length)},body:webp}),{IMAGES:retryBinding});
assert.equal(retry.status,200);assert.equal(attempts,2);assert.deepEqual(retryOptions.map(item=>item.width),[1600,1200]);
const sourceObjects=new Map([
  ['cover.webp',{bytes:webp,type:'image/webp'}],
  ['other.jpg',{bytes:jpeg,type:'image/jpeg'}],
  ['large.png',{bytes:largePng,type:'image/png'}],
  ['small.png',{bytes:smallPng,type:'image/png'}],
]);
const derived=new Map();let writes=0,conversions=0;
const stored=(value)=>value&&({size:value.bytes.length,httpMetadata:{contentType:value.type},httpEtag:'etag',writeHttpMetadata:headers=>headers.set('content-type',value.type)});
const env={
  FILES:{
    head:async key=>stored(derived.get(key)||sourceObjects.get(key)),
    get:async key=>{const value=derived.get(key)||sourceObjects.get(key);return value&&{...stored(value),arrayBuffer:async()=>value.bytes,body:new Response(value.bytes).body,writeHttpMetadata:headers=>headers.set('content-type',value.type)}},
    put:async(key,bytes,options)=>{writes++;derived.set(key,{bytes:new Uint8Array(bytes),type:options.httpMetadata.contentType})},
  },
  PORTRAIT_SANITIZER:{fetch:async(url,options)=>{conversions++;return sanitizeShopeeImage(new Request(url,options),{IMAGES:imagesBinding})}},
};
const origin='https://fixture.test',productId=7;
const cover={id:31,position:0,image_key:'cover.webp'};
const prepared=await prepareShopeeImage({env},productId,cover,origin);
assert.equal(prepared.type,'image/jpeg');assert.ok(prepared.size>64&&prepared.size<=2*1024*1024);
assert.equal(prepared.url,`${origin}/api/toys-center/shopee-images/7/31.jpg`);
assert.equal(writes,1);assert.equal(conversions,1);
const converted=derived.get(shopeeDerivativeKey(31)).bytes;
assert.equal((await sharp(converted).metadata()).format,'jpeg','derivative is decodable JPEG');
const corner=await sharp(converted).extract({left:0,top:0,width:1,height:1}).raw().toBuffer();
assert.ok(corner[0]>240&&corner[1]>240&&corner[2]>240,'transparent WebP corner becomes white');
assert.deepEqual(sourceObjects.get('cover.webp').bytes,webp,'original WebP bytes unchanged');
assert.ok(transforms.every(item=>item.background==='#FFFFFF'),'transparent source receives white background');
await prepareShopeeImage({env},productId,cover,origin);
assert.equal(writes,1,'repeat export reuses immutable gallery derivative');assert.equal(conversions,1);
const originalFetch=env.PORTRAIT_SANITIZER.fetch;
env.PORTRAIT_SANITIZER.fetch=async(...args)=>{await new Promise(resolve=>setTimeout(resolve,10));return originalFetch(...args)};
await Promise.all([prepareShopeeImage({env},productId,{...cover,id:35},origin),prepareShopeeImage({env},productId,{...cover,id:35},origin)]);
assert.equal(writes,2,'concurrent export shares one derivative write');assert.equal(conversions,2);
const direct=await prepareShopeeImage({env},productId,{id:32,position:1,image_key:'other.jpg'},origin);
assert.equal(direct.url,`${origin}/api/toys-center/shopee-images/7/32.jpg`);
assert.equal(writes,2,'valid source image is not copied');
const png=await prepareShopeeImage({env},productId,{id:36,position:3,image_key:'small.png'},origin);
assert.equal(png.url,`${origin}/api/toys-center/shopee-images/7/36.png`);
assert.equal(writes,2,'valid transparent PNG stays PNG');
const oversized=await prepareShopeeImage({env},productId,{id:33,position:2,image_key:'large.png'},origin);
assert.equal(oversized.url,`${origin}/api/toys-center/shopee-images/7/33.jpg`);
assert.equal(writes,3,'oversized PNG is converted');

const sqlite=new DatabaseSync(':memory:');
sqlite.exec("CREATE TABLE toys_center_products(id INTEGER PRIMARY KEY,status TEXT);CREATE TABLE toys_center_product_images(id INTEGER PRIMARY KEY,product_id INTEGER,position INTEGER,image_key TEXT);INSERT INTO toys_center_products VALUES(7,'published'),(8,'draft');INSERT INTO toys_center_product_images VALUES(31,7,0,'cover.webp'),(32,7,1,'other.jpg'),(33,7,2,'large.png'),(34,8,0,'cover.webp'),(36,7,3,'small.png');");
env.DB={prepare:sql=>({bind:(...args)=>({first:async()=>sqlite.prepare(sql).get(...args)})})};
const publicGet=(id,file)=>onRequestGet({env,params:{id:String(id),file},request:new Request(`${origin}/api/toys-center/shopee-images/${id}/${file}`)});
const publicHead=(id,file)=>onRequestHead({env,params:{id:String(id),file},request:new Request(`${origin}/api/toys-center/shopee-images/${id}/${file}`,{method:'HEAD'})});
let response=await publicGet(7,'31.jpg');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),converted);
response=await publicHead(7,'31.jpg');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal((await response.arrayBuffer()).byteLength,0);
response=await publicGet(7,'32.jpg');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
response=await publicGet(7,'33.jpg');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
response=await publicGet(7,'36.png');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
for(const [id,file] of [[7,'31.png'],[7,'32.png'],[8,'34.jpg'],[7,'999.jpg']])assert.equal((await publicGet(id,file)).status,404);
sqlite.prepare("UPDATE toys_center_products SET status='draft' WHERE id=7").run();assert.equal((await publicGet(7,'31.jpg')).status,404);
sqlite.prepare("UPDATE toys_center_products SET status='published' WHERE id=7").run();sqlite.prepare('DELETE FROM toys_center_product_images WHERE id=31').run();assert.equal((await publicGet(7,'31.jpg')).status,404,'removed gallery ID cannot expose orphan derivative');
sqlite.close();
console.log('PASS Shopee JPEG conversion, R2 reuse, explicit public image URLs and indexed published-gallery policy');
