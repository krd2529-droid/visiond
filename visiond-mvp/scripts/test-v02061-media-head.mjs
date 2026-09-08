import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {onRequest as middleware} from '../functions/_middleware.js';
import {onRequestGet,onRequestHead} from '../functions/api/media/[key].js';

const published=new Set(['/api/media/cover-public.jpg','/api/media/cover-gone.jpg']);
const drafts=new Set(['/api/media/cover-draft.jpg']);
const pending=new Set(['/api/media/vision4-pending-preview-test.jpg']);
const qr=new Set(['/api/media/payment-qr-test.jpg']);
class Bound{
  constructor(sql){this.sql=sql;this.args=[]}
  bind(...args){this.args=args;return this}
  async first(){
    const url=this.args[0];
    if(this.sql.includes('FROM products'))return (this.sql.includes("status='published'")?published:drafts).has(url)?{ok:1}:null;
    if(this.sql.includes('FROM vision4_pending_files'))return pending.has(url)?{ok:1}:null;
    if(this.sql.includes("key='qr_url'"))return qr.has(url)?{ok:1}:null;
    return null;
  }
}
const calls={get:[],head:[]};
const stored=new Set(['cover-public.jpg','cover-draft.jpg','vision4-pending-preview-test.jpg','payment-qr-test.jpg']);
const object=key=>({body:new Uint8Array([1,2,3]),httpEtag:`etag-${key}`,httpMetadata:{contentType:'image/jpeg'},writeHttpMetadata(headers){headers.set('content-type','image/jpeg')}});
const env={
  DB:{prepare:sql=>new Bound(sql)},
  FILES:{
    async get(key){calls.get.push(key);return stored.has(key)?object(key):null},
    async head(key){calls.head.push(key);if(!stored.has(key))return null;const {body,...metadata}=object(key);return metadata},
  },
};
const dispatch=ctx=>ctx.request.method==='HEAD'?onRequestHead(ctx):onRequestGet(ctx);
const request=async(key,method='HEAD')=>{
  const incoming=new Request(`https://visiondonline.com/api/media/${key}`,{method,headers:{accept:'image/*'}});
  return middleware({request:incoming,next:()=>dispatch({env,params:{key},request:incoming})});
};

assert.equal(typeof onRequestHead,'function','Pages route must export an explicit HEAD handler');
const publicHead=await request('cover-public.jpg');
assert.equal(publicHead.status,200);assert.equal(publicHead.headers.get('content-type'),'image/jpeg');assert.match(publicHead.headers.get('cache-control')||'',/^public, max-age=86400/);assert.equal(publicHead.body,null);assert.equal((await publicHead.arrayBuffer()).byteLength,0);
assert.deepEqual(calls.head,['cover-public.jpg']);assert.deepEqual(calls.get,[],'HEAD must use R2 metadata without downloading the object body');
for(const key of ['cover-draft.jpg','vision4-pending-preview-test.jpg']){
  const response=await request(key);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.body,null);
}
const unknown=await request('cover-unknown.jpg');assert.equal(unknown.status,404);assert.equal(unknown.headers.get('cache-control'),'private, no-store');assert.equal(unknown.body,null);
const missingObject=await request('cover-gone.jpg');assert.equal(missingObject.status,404);assert.equal(missingObject.headers.get('cache-control'),'private, no-store');assert.equal(missingObject.body,null);
const publicGet=await request('cover-public.jpg','GET');assert.equal(publicGet.status,200);assert.equal((await publicGet.arrayBuffer()).byteLength,3);assert.deepEqual(calls.get,['cover-public.jpg'],'GET must preserve its body-fetch path');

const [source,version,indexHtml,adminHtml]=await Promise.all([
  readFile(new URL('../functions/api/media/[key].js',import.meta.url),'utf8'),readFile(new URL('../VERSION.txt',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/admin.html',import.meta.url),'utf8'),
]);
assert.match(source,/export const onRequestHead=ctx=>readMedia\(ctx,\{head:true\}\)/);assert.match(source,/ctx\.env\.FILES\.head\(key\)/);assert.equal(version.trim(),'v0.20.64');assert.match(indexHtml,/WEB v0\.20\.64/);assert.match(adminHtml,/ADMIN v0\.20\.64/);
console.log('PASS v0.20.63 explicit media HEAD: dispatch, R2 metadata-only body, privacy and GET regression');
