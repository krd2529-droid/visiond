import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createToyImagePipeline,isHeicUpload,TOY_IMAGE_MAX_BYTES} from '../public/toys-center-image.js';
import {readToyImage,storeToyImage} from '../functions/_toys_center.js';
import {onRequestPost as createProduct} from '../functions/api/admin/toys-center/index.js';
import {onRequestPut as updateProduct} from '../functions/api/admin/toys-center/[id].js';
import {onRequestPost as aiFill} from '../functions/api/admin/toys-center/ai-fill.js';

const jpegBytes=new Uint8Array([0xff,0xd8,0xff,0xe0,0,1,0xff,0xd9]);
const pngBytes=new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
const webpBytes=new Uint8Array([0x52,0x49,0x46,0x46,4,0,0,0,0x57,0x45,0x42,0x50]);
const heicBytes=fs.readFileSync(new URL('./fixtures/toys-center-libheif-example.heic',import.meta.url));
const file=(bytes,name,type)=>new File([bytes],name,{type,lastModified:123});
const magic=async value=>[...new Uint8Array(await value.slice(0,3).arrayBuffer())];

for(const candidate of[
  file(heicBytes,'iphone.HEIC',''),file(heicBytes,'iphone.HEIF','application/octet-stream'),
  file(heicBytes,'iphone.bin','image/heic'),file(heicBytes,'iphone.bin','image/heif'),
  file(heicBytes,'iphone.bin','image/heic-sequence'),file(heicBytes,'iphone.bin','image/heif-sequence')
])assert.equal(isHeicUpload(candidate),true);

let decodeCount=0;
const decoder={isHeic:async()=>true,heicTo:async()=>{decodeCount++;return new Blob([jpegBytes],{type:'image/jpeg'})}};
const created=[],revoked=[];
const pipeline=createToyImagePipeline({loadDecoder:async()=>decoder,createObjectURL:value=>{created.push(value);return `blob:${created.length}`},revokeObjectURL:url=>revoked.push(url)});
const source=file(heicBytes,'IMG_0042.HEIC','image/heic');
const input={files:[source]},form={elements:{image_1:input,image_2:{files:[]}}},img={hidden:true,removeAttribute(name){if(name==='src')delete this.src}};
const [previewed,resolved]=await Promise.all([pipeline.preview('image_1',img,source),pipeline.resolveFile(source,'image_1')]);
assert.equal(previewed,resolved);assert.equal(decodeCount,1);assert.equal(img.src,'blob:1');assert.equal(img.hidden,false);
assert.equal(resolved.type,'image/jpeg');assert.equal(resolved.name,'IMG_0042.jpg');assert.deepEqual(await magic(resolved),[0xff,0xd8,0xff]);assert.ok(resolved.size<=TOY_IMAGE_MAX_BYTES);
const aiPayload=await pipeline.appendSelected(form,new FormData());
const savePayload=await pipeline.appendSelected(form,new FormData());
for(const submitted of[aiPayload.get('image_1'),savePayload.get('image_1')]){assert.equal(submitted.name,resolved.name);assert.equal(submitted.type,resolved.type);assert.deepEqual(await magic(submitted),[0xff,0xd8,0xff])}assert.equal(decodeCount,1);

for(const standard of[file(jpegBytes,'keep.jpg','image/jpeg'),file(pngBytes,'keep.png','image/png'),file(webpBytes,'keep.webp','image/webp')]){
  assert.equal(await pipeline.resolveFile(standard,'image_2'),standard);
}

const second=file(heicBytes,'second.heif','image/heif');
await pipeline.preview('image_1',img,second);assert.deepEqual(revoked,['blob:1']);assert.equal(img.src,'blob:2');
pipeline.reset('image_1');assert.deepEqual(revoked,['blob:1','blob:2']);

let releaseFirst;
const lateA=new Promise(resolve=>{releaseFirst=resolve});
const racePipeline=createToyImagePipeline({loadDecoder:async()=>({isHeic:async()=>true,heicTo:async({blob})=>blob.name==='A.heic'?lateA:new Blob([jpegBytes],{type:'image/jpeg'})}),createObjectURL:value=>`blob:${value.name}`,revokeObjectURL(){}});
const raceImg={hidden:true,removeAttribute(name){if(name==='src')delete this.src}};
const a=file(heicBytes,'A.heic','image/heic'),b=file(heicBytes,'B.heic','image/heic');
const latePreview=racePipeline.preview('image_1',raceImg,a);await racePipeline.preview('image_1',raceImg,b);releaseFirst(new Blob([jpegBytes],{type:'image/jpeg'}));
assert.equal(await latePreview,null);assert.equal(raceImg.src,'blob:B.jpg');

let releaseSecond;
const slowSecond=new Promise(resolve=>{releaseSecond=resolve}),submitPipeline=createToyImagePipeline({loadDecoder:async()=>({isHeic:async()=>true,heicTo:async({blob})=>blob.name==='slow.heic'?slowSecond:new Blob([jpegBytes],{type:'image/jpeg'})})});
const firstInput={files:[file(heicBytes,'first.heic','image/heic')]},secondInput={files:[file(heicBytes,'slow.heic','image/heic')]},submitForm={elements:{image_1:firstInput,image_2:secondInput}};
const pendingSubmit=submitPipeline.appendSelected(submitForm,new FormData());await new Promise(resolve=>setImmediate(resolve));firstInput.files=[file(heicBytes,'changed.heic','image/heic')];submitPipeline.select('image_1',firstInput.files[0]);releaseSecond(new Blob([jpegBytes],{type:'image/jpeg'}));await assert.rejects(pendingSubmit,/รูป VisionD ถูกเปลี่ยน/);

for(const [output,pattern]of[
  [new Blob([new Uint8Array([1,2,3])],{type:'image/jpeg'}),/แปลงรูป VisionD/],
  [new Blob([jpegBytes],{type:'image/png'}),/แปลงรูป VisionD/],
  [new Blob([jpegBytes,new Uint8Array(TOY_IMAGE_MAX_BYTES+1-jpegBytes.length)],{type:'image/jpeg'}),/เกิน 5 MB/]
]){
  const failing=createToyImagePipeline({loadDecoder:async()=>({isHeic:async()=>true,heicTo:async()=>output})});
  await assert.rejects(failing.resolveFile(source,'image_1'),pattern);
}
await assert.rejects(createToyImagePipeline({loadDecoder:async()=>({isHeic:async()=>false,heicTo:async()=>null})}).resolveFile(source,'image_2'),/แปลงรูป Meta/);

for(const valid of[file(jpegBytes,'x.jpg','image/jpeg'),file(pngBytes,'x.png','image/png'),file(webpBytes,'x.webp','image/webp')])assert.equal((await readToyImage(valid,1)).type,valid.type);
for(const spoof of[file(heicBytes,'spoof.jpg','image/jpeg'),file(heicBytes,'spoof.png','image/png'),file(heicBytes,'spoof.webp','image/webp')])await assert.rejects(readToyImage(spoof,1),/JPG, PNG หรือ WEBP/);
let directPuts=0;await assert.rejects(storeToyImage({FILES:{put:async()=>directPuts++}},file(heicBytes,'raw.jpg','image/jpeg'),1),/JPG, PNG หรือ WEBP/);assert.equal(directPuts,0);

const boss={id:7,email:'boss@example.com',username:'boss',name:'Boss',role:'boss',created_at:'',is_course_owner:false};
const old={id:9,image_1_key:'old-1.jpg',image_2_key:'old-2.jpg'};
function mockEnv({oldRow=old,storedObject=null}={}){
  const stats={puts:[],deletes:[],runs:[]};
  const env={
    GEMINI_API_KEY:'test-key',
    FILES:{put:async(...args)=>stats.puts.push(args),delete:async key=>stats.deletes.push(key),get:async()=>storedObject},
    DB:{batch:async statements=>Promise.all(statements.map(statement=>statement.run())),prepare(sql){return{
      bind(...args){return{
        first:async()=>sql.includes('FROM sessions')?boss:sql.includes('FROM toys_center_products')?oldRow:null,
        run:async()=>{stats.runs.push({sql,args});return{meta:{last_row_id:101}}},
        all:async()=>({results:[]})
      }},
      first:async()=>null
    }}}
  };
  return{env,stats};
}
function productForm(image1,image2){const form=new FormData();for(const[name,value]of Object.entries({meta_id:'TOY-HEIC',title:'สินค้า',description:'รายละเอียด',price:'100',brand:'VisionD',quantity:'1',status:'draft'}))form.set(name,value);if(image1)form.set('image_1',image1,image1.name);if(image2)form.set('image_2',image2,image2.name);return form}
const requestFor=(url,method,form)=>new Request(url,{method,headers:{cookie:'vd_session=session'},body:form});
const goodJpeg=file(jpegBytes,'converted.jpg','image/jpeg'),rawHonest=file(heicBytes,'raw.heic','image/heic'),rawSpoof=file(heicBytes,'raw.jpg','image/jpeg');

for(const raw of[rawHonest,rawSpoof]){
  const{env,stats}=mockEnv();const response=await createProduct({request:requestFor('https://example.test/api/admin/toys-center','POST',productForm(goodJpeg,raw)),env});
  assert.equal(response.status,400);assert.equal(stats.puts.length,0);assert.equal(stats.runs.length,0);
}
for(const raw of[rawHonest,rawSpoof]){
  const{env,stats}=mockEnv();const response=await updateProduct({request:requestFor('https://example.test/api/admin/toys-center/9','PUT',productForm(goodJpeg,raw)),env,params:{id:'9'}});
  assert.equal(response.status,400);assert.equal(stats.puts.length,0);assert.equal(stats.runs.length,0);
}
{
  const{env,stats}=mockEnv();const response=await createProduct({request:requestFor('https://example.test/api/admin/toys-center','POST',productForm(goodJpeg,goodJpeg)),env});
  assert.equal(response.status,201);assert.equal(stats.puts.length,2);assert.equal(stats.runs.length,2);for(const[,buffer,metadata]of stats.puts){assert.deepEqual([...new Uint8Array(buffer).slice(0,3)],[0xff,0xd8,0xff]);assert.equal(metadata.httpMetadata.contentType,'image/jpeg')}
}
{
  const{env,stats}=mockEnv();const response=await updateProduct({request:requestFor('https://example.test/api/admin/toys-center/9','PUT',productForm()),env,params:{id:'9'}});
  assert.equal(response.status,200);assert.equal(stats.puts.length,0);assert.equal(stats.deletes.length,0);assert.equal(stats.runs.length,1);assert.ok(stats.runs[0].args.includes('old-1.jpg'));assert.ok(stats.runs[0].args.includes('old-2.jpg'));
}
for(const raw of[rawHonest,rawSpoof]){
  const{env}=mockEnv();let providerRequests=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{providerRequests++;return new Response('{}')};
  try{const form=new FormData();form.set('image_1',raw,raw.name);const response=await aiFill({request:requestFor('https://example.test/api/admin/toys-center/ai-fill','POST',form),env});assert.equal(response.status,400);assert.equal(providerRequests,0)}finally{globalThis.fetch=originalFetch}
}
{
  const rawBuffer=heicBytes.buffer.slice(heicBytes.byteOffset,heicBytes.byteOffset+heicBytes.byteLength),storedObject={httpMetadata:{contentType:'image/jpeg'},arrayBuffer:async()=>rawBuffer};
  const{env}=mockEnv({storedObject});let providerRequests=0;const originalFetch=globalThis.fetch;globalThis.fetch=async()=>{providerRequests++;return new Response('{}')};
  try{const form=new FormData();form.set('product_id','9');const response=await aiFill({request:requestFor('https://example.test/api/admin/toys-center/ai-fill','POST',form),env});assert.equal(response.status,400);assert.equal(providerRequests,0)}finally{globalThis.fetch=originalFetch}
}

const html=fs.readFileSync(new URL('../public/toys-center-admin.html',import.meta.url),'utf8');
assert.equal((html.match(/\.heic,\.heif/g)||[]).length,2);assert.match(html,/toys-center-admin\.js\?v=020113/);assert.match(html,/toys-center\.css\?v=020113/);assert.match(html,/v0\.20\.113/);
assert.match(fs.readFileSync(new URL('../functions/_middleware.js',import.meta.url),'utf8'),/worker-src 'self' blob:/);
assert.equal(fs.readFileSync(new URL('../VERSION.txt',import.meta.url),'utf8').trim(),'v0.20.113');
console.log('PASS v0.20.107 Toys Center HEIC pipeline, cache/race/errors, server magic parity, no partial writes and edit preservation');
