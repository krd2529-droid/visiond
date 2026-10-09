import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createRequire} from 'node:module';
import {onRequestPost as uploadMedia,VPAGE_IMAGE_MAX_REQUEST_BYTES} from '../functions/api/vpage/pages/[id]/media.js';
import {onRequestDelete as deleteMedia} from '../functions/api/vpage/pages/[id]/media/[mediaId].js';
import {onRequestGet as getMedia,onRequestHead as headMedia} from '../functions/api/vpage/media/[id].js';
import {onRequestGet as getBossMedia,onRequestHead as headBossMedia} from '../functions/api/admin/vpage/pages/[id]/media/[mediaId].js';
import {hashVpageBytes,prepareVpageMediaSave,reconcilePendingVpageMedia,reconcileVpageMediaActiveSet} from '../functions/_vpage-media.js';
import {clearVpageCaches,readRemoteVpageEditor} from '../functions/_vpage-provisioning.js';
import sanitizerWorker,{sanitizeVpageImage as sanitizeWorkerVpageImage} from '../workers/live-portrait-sanitizer/src/index.js';

const require=createRequire(import.meta.url),sharp=require('sharp');

let afterRunHook=null;
const adapter=sqlite=>({prepare(sql){const state={args:[]};return{bind(...args){state.args=args;return this},async first(){return sqlite.prepare(sql).get(...state.args)||null},async all(){return{results:sqlite.prepare(sql).all(...state.args)}},async run(){const result=sqlite.prepare(sql).run(...state.args);if(afterRunHook)await afterRunHook(sql,state.args,result);return{meta:{changes:Number(result.changes)}}},get __sql(){return sql},get __args(){return state.args}}},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(statement=>{const result=sqlite.prepare(statement.__sql).run(...statement.__args);return{meta:{changes:Number(result.changes)}}});sqlite.exec('COMMIT');return results}catch(error){sqlite.exec('ROLLBACK');throw error}}});
const database=new DatabaseSync(':memory:');
database.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE runtime_schema_state(schema_key TEXT PRIMARY KEY,version INTEGER NOT NULL);
INSERT INTO runtime_schema_state VALUES('core',66);
CREATE TABLE users(id INTEGER PRIMARY KEY,email TEXT,username TEXT,name TEXT,phone TEXT,role TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE products(id INTEGER PRIMARY KEY,category TEXT);
CREATE TABLE entitlements(user_id INTEGER,product_id INTEGER,active INTEGER);
CREATE TABLE courses(product_id INTEGER,course_type TEXT);
CREATE TABLE course_right_credits(user_id INTEGER);
CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id INTEGER,expires_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE vpage_pages(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,vpage_id TEXT UNIQUE,domain_id TEXT NOT NULL,slug TEXT NOT NULL,display_name TEXT NOT NULL,status TEXT NOT NULL,expires_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT INTO users(id,email,username,name,role) VALUES(1,'one@test','one','Owner One','user'),(2,'two@test','two','Owner Two','user'),(3,'boss@test','boss','Boss','boss');
INSERT INTO sessions VALUES('one',1,datetime('now','+1 day'),CURRENT_TIMESTAMP),('two',2,datetime('now','+1 day'),CURRENT_TIMESTAMP),('boss',3,datetime('now','+1 day'),CURRENT_TIMESTAMP);
INSERT INTO vpage_pages(id,user_id,vpage_id,domain_id,slug,display_name,status,expires_at) VALUES
('vpl_11111111111111111111111111111111',1,'vp_11111111111111111111111111111111','dom_smartlinkpage','owner-page','Owner Page','active',datetime('now','+30 days')),
('vpl_22222222222222222222222222222222',2,'vp_22222222222222222222222222222222','dom_smartlinkpage','other-page','Other Page','active',datetime('now','+30 days')),
('vpl_33333333333333333333333333333333',1,'vp_33333333333333333333333333333333','dom_smartlinkpage','full-page','Full Page','active',datetime('now','+30 days'));`);
database.exec(readFileSync(new URL('../migrations/0127_vpage_media.sql',import.meta.url),'utf8'));

const objects=new Map(),puts=[],deletes=[];
let failNextPut=false;
const object=value=>({body:value.bytes,size:value.bytes.byteLength,httpMetadata:{contentType:value.type},customMetadata:value.customMetadata,httpEtag:'"fixture-etag"',writeHttpMetadata(headers){headers.set('content-type',value.type)}});
const files={
  async put(key,value,options){if(failNextPut){failNextPut=false;throw new Error('synthetic R2 outage')}const bytes=new Uint8Array(await new Response(value).arrayBuffer()),type=options?.httpMetadata?.contentType||'';puts.push(key);objects.set(key,{bytes,type,customMetadata:options?.customMetadata||{}})},
  async get(key){const value=objects.get(key);return value?object(value):null},
  async head(key){const value=objects.get(key);return value?object(value):null},
  async delete(key){deletes.push(key);objects.delete(key)}
};
const pageId='vpl_11111111111111111111111111111111';
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}return table})(),crc32=bytes=>{let c=0xffffffff;for(const byte of bytes)c=crcTable[(c^byte)&255]^(c>>>8);return(c^0xffffffff)>>>0},concat=(...parts)=>{const out=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let at=0;for(const part of parts){out.set(part,at);at+=part.length}return out},chunk=(type,data)=>{const name=new TextEncoder().encode(type),out=new Uint8Array(12+data.length),view=new DataView(out.buffer);view.setUint32(0,data.length);out.set(name,4);out.set(data,8);view.setUint32(8+data.length,crc32(concat(name,data)));return out};
const makeImage=async(width,height,format)=>new Uint8Array(await sharp({create:{width,height,channels:4,background:{r:37,g:99,b:235,alpha:0.86}}})[format]().toBuffer());
const pngFixtures=new Map();for(const [width,height] of [[320,240],[321,240],[640,480],[800,600]])pngFixtures.set(`${width}x${height}`,await makeImage(width,height,'png'));
const png=(width=320,height=240)=>pngFixtures.get(`${width}x${height}`);
const jpeg=()=>awaitableFixtures.jpeg,webp=()=>awaitableFixtures.webp;
const awaitableFixtures={jpeg:await makeImage(320,240,'jpeg'),webp:await makeImage(320,240,'webp')};
const malformedPng=(width=320,height=240)=>{const ihdr=new Uint8Array(13),view=new DataView(ihdr.buffer);view.setUint32(0,width);view.setUint32(4,height);ihdr.set([8,6,0,0,0],8);return concat(new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ihdr),chunk('IDAT',new Uint8Array([0x78,0x01,0x01,0x00,0x00,0xff,0xff])),chunk('IEND',new Uint8Array()))};
const malformedJpeg=()=>new Uint8Array([0xff,0xd8,0xff,0xe0,0,16,0x4a,0x46,0x49,0x46,0,1,1,0,0,1,0,1,0,0,0xff,0xc0,0,17,8,0,240,1,64,3,1,0x11,0,2,0x11,0,3,0x11,0,0xff,0xda,0,12,3,1,0,2,0,3,0,0,0x3f,0,0,0xff,0xd9]);
const malformedWebp=()=>{const payload=new Uint8Array(6),bits=((320-1)&0x3fff)|(((240-1)&0x3fff)<<14),view=new DataView(payload.buffer);payload[0]=0x2f;view.setUint32(1,bits,true);const bytes=new Uint8Array(26),all=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('RIFF'),0);all.setUint32(4,18,true);bytes.set(new TextEncoder().encode('WEBPVP8L'),8);all.setUint32(16,5,true);bytes.set(payload.slice(0,5),20);return bytes};
const withPngText=bytes=>{const iend=bytes.length-12;return concat(bytes.slice(0,iend),chunk('tEXt',new TextEncoder().encode('Comment\0private metadata')),bytes.slice(iend))};
const safeWorkerOutput=await makeImage(320,240,'webp'),workerImages={async info(stream){const bytes=Buffer.from(await new Response(stream).arrayBuffer()),image=sharp(bytes),metadata=await image.metadata();await image.raw().toBuffer();return{format:metadata.format,width:metadata.width,height:metadata.height}},input(){return{transform(){return this},output(){return{response:()=>new Response(safeWorkerOutput,{headers:{'content-type':'image/webp'}})}}}}};
const workerRequest=(bytes,type)=>new Request('https://portrait-sanitizer.internal/v1/vpage-reencode',{method:'POST',headers:{'content-type':type,'x-visiond-sanitizer-protocol':'2','x-visiond-input-bytes':String(bytes.byteLength)},body:bytes});
const workerSanitized=await sanitizeWorkerVpageImage(workerRequest(png(),'image/png'),{IMAGES:workerImages});assert.deepEqual(await sharp(Buffer.from(await workerSanitized.arrayBuffer())).raw().toBuffer({resolveWithObject:true}).then(value=>[value.info.width,value.info.height]),[320,240],'sanitizer worker contract emits real decodable pixels');
for(const [bytes,type] of [[malformedPng(),'image/png'],[malformedJpeg(),'image/jpeg'],[malformedWebp(),'image/webp']])await assert.rejects(()=>sanitizeWorkerVpageImage(workerRequest(bytes,type),{IMAGES:workerImages}),error=>error.code==='VPAGE_SANITIZER_INPUT_INVALID'&&error.status===422,`sanitizer worker decoder rejects structurally plausible corrupt ${type}`);
for(const request of [new Request('https://wrong.internal/v1/vpage-reencode',{method:'POST'}),new Request('https://portrait-sanitizer.internal/v1/vpage-reencode',{method:'GET'})])assert.equal((await sanitizerWorker.fetch(request,{IMAGES:workerImages})).status,404,'protocol2 dispatcher rejects wrong origin or method');
const wrongProtocol=workerRequest(png(),'image/png');wrongProtocol.headers.set('x-visiond-sanitizer-protocol','1');assert.equal((await sanitizerWorker.fetch(wrongProtocol,{IMAGES:workerImages})).status,415);
const wrongAdvertised=workerRequest(png(),'image/png');wrongAdvertised.headers.set('x-visiond-input-bytes',String(png().byteLength+1));assert.equal((await sanitizerWorker.fetch(wrongAdvertised,{IMAGES:workerImages})).status,422,'protocol2 dispatcher rejects advertised/body length mismatch');
const portraitJpeg=await makeImage(320,320,'jpeg'),portraitImages={...workerImages,input(){return{transform(){return this},output(){return{response:()=>new Response(portraitJpeg,{headers:{'content-type':'image/jpeg'}})}}}}},portraitRequest=new Request('https://portrait-sanitizer.internal/v1/reencode',{method:'POST',headers:{'content-type':'image/jpeg','x-visiond-sanitizer-protocol':'1','x-visiond-input-bytes':String(portraitJpeg.byteLength)},body:portraitJpeg}),portraitResponse=await sanitizerWorker.fetch(portraitRequest,{IMAGES:portraitImages});assert.equal(portraitResponse.status,200,'existing protocol1 portrait dispatcher remains intact');assert.equal(portraitResponse.headers.get('content-type'),'image/jpeg');
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
const sameLengthOutputs=[];{const byLength=new Map();for(let value=1;value<80&&!sameLengthOutputs.length;value++){const output=new Uint8Array(await sharp({create:{width:320,height:240,channels:3,background:{r:value*3%255,g:value*7%255,b:value*11%255}}}).webp({quality:88}).toBuffer()),prior=byLength.get(output.byteLength);if(prior&&(await hashVpageBytes(prior))!==(await hashVpageBytes(output)))sameLengthOutputs.push(prior,output);else byLength.set(output.byteLength,output)}}assert.equal(sameLengthOutputs.length,2,'test needs two different valid equal-length codec outputs');
let sanitizerCalls=0,sanitizerFault='',sanitizerParallel=null;
const sanitizer={async fetch(url,options){const call=sanitizerCalls++;assert.equal(url,'https://portrait-sanitizer.internal/v1/vpage-reencode');assert.equal(options.headers['x-visiond-sanitizer-protocol'],'2');const source=new Uint8Array(await new Response(options.body).arrayBuffer()),declared=options.headers['content-type'];try{const image=sharp(Buffer.from(source),{animated:false,limitInputPixels:16_777_216}),metadata=await image.metadata(),actual=metadata.format==='jpeg'?'image/jpeg':`image/${metadata.format}`;await image.clone().raw().toBuffer();if(actual!==declared)return new Response('',{status:422});let output=new Uint8Array(await image.webp({quality:88}).toBuffer());if(sanitizerParallel){const index=sanitizerParallel.entries++;if(sanitizerParallel.entries===2)sanitizerParallel.release.resolve();await sanitizerParallel.release.promise;output=sameLengthOutputs[index]}const outputMeta=await sharp(Buffer.from(output)).metadata(),hash=await hashVpageBytes(output),headers=new Headers({'content-type':'image/webp','content-length':String(output.byteLength),'x-visiond-sanitizer':'cloudflare-images-v1','x-visiond-output-bytes':String(output.byteLength),'x-visiond-output-width':String(outputMeta.width),'x-visiond-output-height':String(outputMeta.height),'x-visiond-output-sha256':hash});if(sanitizerFault==='missing')headers.delete('x-visiond-output-sha256');if(sanitizerFault==='nan')headers.set('x-visiond-output-bytes','NaN');if(sanitizerFault==='negative')headers.set('x-visiond-output-width','-1');if(sanitizerFault==='oversize')headers.set('x-visiond-output-bytes',String(5*1024*1024+1));if(sanitizerFault==='length-mismatch')headers.set('content-length',String(output.byteLength+1));if(sanitizerFault==='dimensions-mismatch')headers.set('x-visiond-output-height',String(outputMeta.height+1));if(sanitizerFault==='hash-mismatch')headers.set('x-visiond-output-sha256','0'.repeat(64));return new Response(output,{headers})}catch(error){if(error?.code==='ERR_INVALID_CHAR')throw error;return new Response('',{status:422})}}};
const env={DB:adapter(database),FILES:files,PORTRAIT_SANITIZER:sanitizer,APP_ORIGIN:'https://visiondonline.com',VPAGE_API_BASE:'https://vpage.test',VPAGE_SHARED_SECRET:'visual-editor-runtime-secret-at-least-32-chars',VPAGE_KEY_ID:'visiond-main-v1'};
const ctxRequest=(path,{method='POST',session='one',key='media-key-0001',bytes=png(),type='image/png',name='ignored-client-name.png',requestLength='auto'}={})=>{let body;if(method==='POST'){body=new FormData();body.set('image',new File([bytes],name,{type}))}const headers={cookie:`vd_session=${session}`,...(key?{'idempotency-key':key}:{})};if(requestLength!==null)headers['content-length']=String(requestLength==='auto'?bytes.byteLength+4096:requestLength);return new Request(`https://visiondonline.com${path}`,{method,headers,body})};
const upload=(options={})=>uploadMedia({env,params:{id:options.pageId||pageId},request:ctxRequest(`/api/vpage/pages/${options.pageId||pageId}/media`,options)});
const parse=async response=>({status:response.status,data:await response.json()});

let response=await uploadMedia({env,params:{id:pageId},request:new Request(`https://visiondonline.com/api/vpage/pages/${pageId}/media`,{method:'POST'})});
assert.equal(response.status,401,'upload requires a user session');
assert.equal(puts.length,0);
for(const [label,requestLength,status] of [['missing',null,411],['NaN','NaN',411],['negative','-1',411],['oversize',VPAGE_IMAGE_MAX_REQUEST_BYTES+1,413]])assert.equal((await upload({key:`media-key-length-${label}`,requestLength})).status,status,`${label} multipart Content-Length fails before formData buffering`);

let result=await parse(await upload());
assert.equal(result.status,201,JSON.stringify(result.data));
assert.equal(result.data.replayed,false);
assert.match(result.data.item.id,/^vpm_[a-f0-9]{32}$/);
assert.equal(result.data.item.url,`https://visiondonline.com/api/vpage/media/${result.data.item.id}`);
assert.deepEqual([result.data.item.mime_type,result.data.item.width,result.data.item.height],['image/webp',320,240]);
const mediaId=result.data.item.id,stored=database.prepare('SELECT owner_id,page_id,object_key,state FROM vpage_media WHERE id=?').get(mediaId);
assert.deepEqual({owner_id:stored.owner_id,page_id:stored.page_id,state:stored.state},{owner_id:1,page_id:pageId,state:'ready'});
assert.match(stored.object_key,/^vpage-media\/[a-f0-9]{32}\.(png|jpg|webp)$/);
assert.equal(puts.length,1);
assert.deepEqual(await sharp(Buffer.from(objects.get(stored.object_key).bytes)).metadata().then(value=>[value.format,value.width,value.height]),['webp',320,240],'stored output passes an independent real decoder');

objects.set(stored.object_key,{...objects.get(stored.object_key),customMetadata:{sha256:'wrong-same-size-hash'}});
result=await parse(await upload());
assert.equal(result.status,200);
assert.equal(puts.length,2,'same-size R2 object with the wrong hash is overwritten before replay');

result=await parse(await upload());
assert.equal(result.status,200);
assert.equal(result.data.replayed,true);
assert.equal(result.data.item.id,mediaId);
assert.equal(puts.length,2,'ready replay never rewrites a verified R2 object');
assert.equal((await parse(await upload({bytes:png(321,240)}))).status,409,'same idempotency key cannot change the image');
assert.equal((await parse(await upload({session:'two',key:'media-key-other'}))).status,404,'another owner cannot upload to this page');
assert.equal((await parse(await upload({session:'boss',key:'media-key-boss'}))).status,404,'Boss cannot silently upload as the page owner');
assert.equal((await parse(await upload({key:'media-key-mime',type:'image/jpeg'}))).status,422,'declared MIME must match magic bytes');
assert.equal((await parse(await upload({key:'media-key-svg',type:'image/svg+xml',bytes:new TextEncoder().encode('<svg/>')}))).status,422,'SVG is rejected');
assert.equal((await parse(await upload({key:'media-key-huge-dimensions',bytes:malformedPng(10000,10000)}))).status,422,'oversized dimensions are rejected before decode');
assert.equal((await parse(await upload({key:'media-key-too-large',bytes:new Uint8Array(5*1024*1024+1)}))).status,413,'oversized payload is rejected before R2');

const jpegUpload=await parse(await upload({key:'media-key-jpeg',bytes:jpeg(),type:'image/jpeg',name:'client.svg'}));assert.equal(jpegUpload.status,201,'real decoder-verified JPEG ignores the client extension');
const webpUpload=await parse(await upload({key:'media-key-webp',bytes:webp(),type:'image/webp',name:'client.txt'}));assert.equal(webpUpload.status,201,'real decoder-verified WEBP ignores the client extension');
for(const uploaded of [jpegUpload,webpUpload]){const row=database.prepare('SELECT object_key FROM vpage_media WHERE id=?').get(uploaded.data.item.id),decoded=await sharp(Buffer.from(objects.get(row.object_key).bytes)).raw().toBuffer({resolveWithObject:true});assert.deepEqual([decoded.info.width,decoded.info.height],[320,240],'each accepted source produces independently decodable stored pixels')}
for(const [key,bytes,type] of [['corrupt-png',malformedPng(),'image/png'],['corrupt-jpeg',malformedJpeg(),'image/jpeg'],['corrupt-webp',malformedWebp(),'image/webp'],['truncated-png',png().slice(0,-8),'image/png'],['polyglot-png',concat(png(),new TextEncoder().encode('<script>alert(1)</script>')),'image/png'],['metadata-png',withPngText(png()),'image/png']])assert.equal((await parse(await upload({key:`media-key-${key}`,bytes,type}))).status,422,`${key} is rejected before storage`);
for(const fault of ['missing','nan','negative','oversize','length-mismatch','dimensions-mismatch','hash-mismatch']){sanitizerFault=fault;assert.equal((await upload({key:`media-key-output-${fault}`,bytes:png(),type:'image/png'})).status,503,`sanitizer ${fault} output contract fails closed`)}sanitizerFault='';
const putsAfterInvalid=puts.length,noSanitizer=await uploadMedia({env:{...env,PORTRAIT_SANITIZER:null},params:{id:pageId},request:ctxRequest(`/api/vpage/pages/${pageId}/media`,{key:'media-key-no-sanitizer',bytes:png(),type:'image/png'})});assert.equal(noSanitizer.status,503,'missing decoder service fails closed');assert.equal(puts.length,putsAfterInvalid);

const parallelKey='media-key-parallel',insertSeen=deferred(),releaseInsert=deferred(),putsBeforeParallel=puts.length;let pausedInsert=false;
sanitizerParallel={entries:0,release:deferred()};afterRunHook=async(sql,args)=>{if(!pausedInsert&&sql.includes('INSERT INTO vpage_media(')&&args[9]===parallelKey){pausedInsert=true;insertSeen.resolve();await releaseInsert.promise}};
const parallelA=upload({key:parallelKey,bytes:png(),type:'image/png'}),parallelB=upload({key:parallelKey,bytes:png(),type:'image/png'});await insertSeen.promise;const loser=await Promise.race([parallelA,parallelB]);assert.equal(loser.status,409,'parallel UNIQUE loser never writes its independently sanitized bytes');releaseInsert.resolve();const parallelResponses=await Promise.all([parallelA,parallelB]);afterRunHook=null;sanitizerParallel=null;assert.deepEqual(parallelResponses.map(item=>item.status).sort((a,b)=>a-b),[201,409]);
const parallelRow=database.prepare('SELECT object_key,content_hash FROM vpage_media WHERE owner_id=1 AND idempotency_key=?').get(parallelKey),parallelObject=objects.get(parallelRow.object_key),parallelActualHash=await hashVpageBytes(parallelObject.bytes);assert.equal(database.prepare('SELECT COUNT(*) count FROM vpage_media WHERE owner_id=1 AND idempotency_key=?').get(parallelKey).count,1);assert.equal(puts.length-putsBeforeParallel,1);assert.equal(parallelActualHash,parallelRow.content_hash);assert.equal(parallelObject.customMetadata.sha256,parallelActualHash);assert.ok(sameLengthOutputs.some(output=>Buffer.from(output).equals(Buffer.from(parallelObject.bytes))),'winner stores one of the two valid same-length codec outputs');

failNextPut=true;
result=await parse(await upload({key:'media-key-retry',bytes:png(640,480)}));
assert.equal(result.status,502,'R2 failure remains retryable');
const pending=database.prepare("SELECT id,object_key,state FROM vpage_media WHERE owner_id=1 AND idempotency_key='media-key-retry'").get();
assert.equal(pending.state,'pending');
result=await parse(await upload({key:'media-key-retry',bytes:png(640,480)}));
assert.equal(result.status,200);
assert.equal(result.data.replayed,true);
assert.equal(result.data.item.id,pending.id);
assert.equal(database.prepare("SELECT COUNT(*) count FROM vpage_media WHERE owner_id=1 AND idempotency_key='media-key-retry'").get().count,1,'retry never creates duplicate media rows');

response=await getMedia({env,params:{id:mediaId},request:new Request(`https://visiondonline.com/api/vpage/media/${mediaId}`)});
assert.equal(response.status,404,'uncommitted upload is not public');
database.prepare("UPDATE vpage_pages SET media_active_set=1,media_active_state='synced' WHERE id=?").run(pageId);
database.prepare("INSERT INTO vpage_media_refs(page_id,owner_id,set_no,slot_key,media_id) VALUES(?,1,2,'hero',?)").run(pageId,mediaId);
assert.equal((await getMedia({env,params:{id:mediaId},request:new Request(`https://visiondonline.com/api/vpage/media/${mediaId}`)})).status,404,'inactive-set media is not public');
const bossPreview=(session='boss',targetPage=pageId,method='GET')=>({env,params:{id:targetPage,mediaId},request:new Request(`https://visiondonline.com/api/admin/vpage/pages/${targetPage}/media/${mediaId}`,{method,headers:session?{cookie:`vd_session=${session}`}:{}})});
assert.equal((await getBossMedia(bossPreview(''))).status,401,'guest cannot preview inactive media');
assert.equal((await getBossMedia(bossPreview('one'))).status,403,'owner cannot use Boss preview');
assert.equal((await getBossMedia(bossPreview('two'))).status,403,'unrelated owner cannot use Boss preview');
assert.equal((await getBossMedia(bossPreview('boss','vpl_22222222222222222222222222222222'))).status,404,'Boss cannot preview a media ID under the wrong page');
response=await getBossMedia(bossPreview());assert.equal(response.status,200,'Boss can preview saved inactive-set media without activation');assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual(await sharp(Buffer.from(await response.arrayBuffer())).metadata().then(value=>[value.format,value.width,value.height]),['webp',320,240]);
response=await headBossMedia(bossPreview('boss',pageId,'HEAD'));assert.equal(response.status,200);assert.equal((await response.arrayBuffer()).byteLength,0);
const bossStored=database.prepare('SELECT object_key FROM vpage_media WHERE id=?').get(mediaId),bossObject=objects.get(bossStored.object_key);objects.set(bossStored.object_key,{...bossObject,customMetadata:{sha256:'forged-boss-hash'}});assert.equal((await getBossMedia(bossPreview())).status,404,'Boss preview fails closed on R2 integrity mismatch');objects.set(bossStored.object_key,bossObject);
database.prepare('DELETE FROM vpage_media_refs WHERE page_id=?').run(pageId);
database.prepare("INSERT INTO vpage_media_refs(page_id,owner_id,set_no,slot_key,media_id) VALUES(?,1,1,'hero',?)").run(pageId,mediaId);
response=await getMedia({env,params:{id:mediaId},request:new Request(`https://visiondonline.com/api/vpage/media/${mediaId}`)});
assert.equal(response.status,200);
assert.equal(response.headers.get('content-type'),'image/webp');
assert.equal(response.headers.get('x-content-type-options'),'nosniff');
assert.equal(response.headers.get('cache-control'),'private, no-store');
assert.equal(response.headers.get('cross-origin-resource-policy'),'cross-origin');
assert.deepEqual(await sharp(Buffer.from(await response.arrayBuffer())).metadata().then(value=>[value.format,value.width,value.height]),['webp',320,240]);
response=await headMedia({env,params:{id:mediaId},request:new Request(`https://visiondonline.com/api/vpage/media/${mediaId}`,{method:'HEAD'})});
assert.equal(response.status,200);
assert.equal((await response.arrayBuffer()).byteLength,0);
const verifiedPublicObject=objects.get(stored.object_key);objects.set(stored.object_key,{...verifiedPublicObject,customMetadata:{sha256:'forged-public-hash'}});assert.equal((await getMedia({env,params:{id:mediaId},request:new Request(`https://visiondonline.com/api/vpage/media/${mediaId}`)})).status,404,'public serving fails closed when R2 integrity metadata differs from D1');objects.set(stored.object_key,verifiedPublicObject);

result=await parse(await deleteMedia({env,params:{id:pageId,mediaId},request:ctxRequest(`/api/vpage/pages/${pageId}/media/${mediaId}`,{method:'DELETE',key:''})}));
assert.equal(result.status,409);
assert.equal(result.data.code,'VPAGE_MEDIA_IN_USE');
assert.equal(deletes.length,0);
assert.equal((await parse(await deleteMedia({env,params:{id:pageId,mediaId},request:ctxRequest(`/api/vpage/pages/${pageId}/media/${mediaId}`,{method:'DELETE',session:'two',key:''})}))).status,404,'cross-owner delete is denied');
database.prepare('DELETE FROM vpage_media_refs WHERE media_id=?').run(mediaId);
result=await parse(await deleteMedia({env:{...env,FILES:null},params:{id:pageId,mediaId},request:ctxRequest(`/api/vpage/pages/${pageId}/media/${mediaId}`,{method:'DELETE',key:''})}));
assert.equal(result.status,503,'missing R2 binding never tombstones an extant object');
result=await parse(await deleteMedia({env,params:{id:pageId,mediaId},request:ctxRequest(`/api/vpage/pages/${pageId}/media/${mediaId}`,{method:'DELETE',key:''})}));
assert.equal(result.status,200);
assert.equal(database.prepare('SELECT state FROM vpage_media WHERE id=?').get(mediaId).state,'deleted');
assert.equal(objects.has(stored.object_key),false);
assert.equal((await getMedia({env,params:{id:mediaId},request:new Request(`https://visiondonline.com/api/vpage/media/${mediaId}`)})).status,404,'deleted media is never public');

const raceUpload=await parse(await upload({key:'media-key-race',bytes:png(800,600)}));
assert.equal(raceUpload.status,201);
const raceId=raceUpload.data.item.id,raceUrl=raceUpload.data.item.url,racePayload={product_image_url:raceUrl,detail_text:'race',text_size:'medium',text_style:'normal',youtube_url:'',product_items:[{destination_url:'https://shop.example/race',image_url:''}],contact_items:[{contact_type:'line',destination_url:'https://line.me/R/ti/p/@race',image_url:''}],background_image_url:'https://images.example/background.jpg',expected_revision:0},oldRemote={item:{active_set:1,content_sets:[{set_no:1,product_image_url:'https://images.example/old.jpg',background_image_url:'',product_items:[],contact_items:[]},{set_no:2,product_image_url:'',background_image_url:'',product_items:[],contact_items:[]}]}};
const originalFetch=globalThis.fetch;let remote=oldRemote,remoteReads=0;
try{
  globalThis.fetch=async()=>{remoteReads++;return new Response(JSON.stringify(remote),{status:200,headers:{'content-type':'application/json'}})};
  clearVpageCaches();await readRemoteVpageEditor(env,{userId:1,pageId:'vp_11111111111111111111111111111111'});
  const operation=await prepareVpageMediaSave(env,{request:new Request(`https://visiondonline.com/api/vpage/pages/${pageId}/content-sets/2`),ownerId:1,pageId,vpageId:'vp_11111111111111111111111111111111',setNo:2,key:'save-race-key',payload:racePayload});
  await assert.rejects(()=>prepareVpageMediaSave(env,{request:new Request(`https://visiondonline.com/api/vpage/pages/${pageId}/content-sets/1`),ownerId:1,pageId,vpageId:'vp_11111111111111111111111111111111',setNo:1,key:'save-race-key',payload:racePayload}),error=>error.code==='VPAGE_MEDIA_SAVE_IDEMPOTENCY_CONFLICT','same owner/key/payload cannot cross set identity');
  await assert.rejects(()=>prepareVpageMediaSave(env,{request:new Request(`https://visiondonline.com/api/vpage/pages/${pageId}/content-sets/2`),ownerId:1,pageId,vpageId:'vp_11111111111111111111111111111111',setNo:2,key:'save-wrong-port',payload:{...racePayload,product_image_url:`https://visiondonline.com:444/api/vpage/media/${raceId}`}}),error=>error.code==='VPAGE_MEDIA_URL_INVALID','canonical media hostname with the wrong port is denied');
  remote={item:{active_set:2,content_sets:[oldRemote.item.content_sets[0],{set_no:2,...racePayload}]}};
  assert.equal(await reconcilePendingVpageMedia(env,raceId,'https://visiondonline.com'),true,'save response-loss reconciliation bypasses the primed old editor cache');
  assert.equal(database.prepare('SELECT COUNT(*) count FROM vpage_media_refs WHERE media_id=?').get(raceId).count,1);
  database.prepare("UPDATE vpage_pages SET media_active_set=1,media_active_state='pending' WHERE id=?").run(pageId);
  assert.equal(await reconcileVpageMediaActiveSet(env,raceId),true,'switch response-loss reconciliation bypasses the primed old editor cache');
  assert.deepEqual({...database.prepare('SELECT media_active_set,media_active_state FROM vpage_pages WHERE id=?').get(pageId)},{media_active_set:2,media_active_state:'synced'});
  assert.equal((await getMedia({env,params:{id:raceId},request:new Request(`https://visiondonline.com/api/vpage/media/${raceId}`)})).status,200);
  assert.equal(remoteReads,3,'prime, save reconcile and switch reconcile each have the expected fresh-read behavior');
  assert.equal(database.prepare('SELECT state FROM vpage_media_save_ops WHERE id=?').get(operation.id).state,'committed');
}finally{globalThis.fetch=originalFetch;clearVpageCaches()}

const indexed=database.prepare("EXPLAIN QUERY PLAN SELECT m.object_key,m.mime_type,m.file_size FROM vpage_media m JOIN vpage_pages p ON p.id=m.page_id AND p.user_id=m.owner_id JOIN vpage_media_refs r ON r.media_id=m.id AND r.page_id=m.page_id AND r.set_no=p.media_active_set WHERE m.id=? AND m.state='ready' AND p.status='active'").all('vpm_00000000000000000000000000000000').map(row=>String(row.detail)).join(' | ');
assert.match(indexed,/sqlite_autoindex_vpage_media_1|PRIMARY KEY/i,indexed);
const bossPlan=database.prepare("EXPLAIN QUERY PLAN SELECT m.object_key,m.mime_type,m.file_size,m.content_hash FROM vpage_media m JOIN vpage_pages p ON p.id=m.page_id AND p.user_id=m.owner_id JOIN vpage_media_refs r ON r.media_id=m.id AND r.page_id=p.id AND r.owner_id=m.owner_id WHERE m.id=? AND m.page_id=? AND m.state='ready' AND p.domain_id='dom_smartlinkpage' AND p.status='active' AND datetime(p.expires_at)>CURRENT_TIMESTAMP LIMIT 1").all(mediaId,pageId).map(row=>String(row.detail)).join(' | ');assert.match(bossPlan,/sqlite_autoindex_vpage_pages_1|PRIMARY KEY/i,bossPlan);assert.match(bossPlan,/idx_vpage_media_owner_page|sqlite_autoindex_vpage_media_1/i,bossPlan);assert.match(bossPlan,/idx_vpage_media_refs_media/i,bossPlan);
const ownerPlan=database.prepare("EXPLAIN QUERY PLAN SELECT id FROM vpage_media WHERE owner_id=? AND page_id=? AND state IN ('pending','ready') ORDER BY id DESC LIMIT 49").all(1,pageId).map(row=>String(row.detail)).join(' | ');
assert.match(ownerPlan,/idx_vpage_media_owner_page|idx_vpage_media_page_state/i,ownerPlan);
const cleanupPlan=database.prepare("EXPLAIN QUERY PLAN SELECT id FROM vpage_media WHERE owner_id=? AND page_id=? AND state='deleted' ORDER BY updated_at DESC,id DESC LIMIT 8 OFFSET 24").all(1,pageId).map(row=>String(row.detail)).join(' | ');
assert.match(cleanupPlan,/idx_vpage_media_cleanup/i,cleanupPlan);

for(let index=0;index<48;index++)database.prepare("INSERT INTO vpage_media(id,owner_id,page_id,object_key,mime_type,file_size,width,height,content_hash,idempotency_key,request_hash,state) VALUES(?,1,'vpl_33333333333333333333333333333333',?,'image/png',60,320,240,?,?,?,'ready')").run(`vpm_${index.toString(16).padStart(32,'0')}`,`vpage-media/${index.toString(16).padStart(32,'0')}.png`,`content-${index}`,`cap-${index}`,`hash-${index}`);
assert.equal((await parse(await upload({pageId:'vpl_33333333333333333333333333333333',key:'media-key-over-cap'}))).status,409,'per-page media cap bounds orphan growth');

console.log('PASS Vpage owner media validation, idempotency, retry, cleanup, serving and indexed quota');
