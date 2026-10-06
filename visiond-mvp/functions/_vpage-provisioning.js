import {sha256} from './_lib.js';

const encoder=new TextEncoder();
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
export const VPAGE_RESERVED_SLUGS=new Set(['admin','api','login','support','www','cdn-cgi','health','internal','status']);
const domainCache={expires:0,value:null,inflight:null};
const availabilityCache=new Map();

export class VpageRemoteError extends Error{
  constructor(message,{status=502,code='VPAGE_REMOTE_FAILED',ambiguous=false}={}){super(message);this.status=status;this.code=code;this.ambiguous=ambiguous}
}

export const validVpageSlug=value=>typeof value==='string'&&value.length>=3&&value.length<=50&&SLUG.test(value)&&!VPAGE_RESERVED_SLUGS.has(value);
export const validVpageDisplayName=value=>typeof value==='string'&&value.trim().length>=1&&value.trim().length<=120;
export const validVpageIdempotencyKey=value=>ID.test(String(value||''));
export const vpageOwnerRef=userId=>sha256(`visiond-vpage-owner-v1:${Number(userId)}`);
const hex=buffer=>[...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const sign=async(secret,canonical)=>{const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(canonical)))};

async function request(env,path,{method='GET',ownerRef='system',body=null,idempotencyKey=''}={}){
  const base=String(env.VPAGE_API_BASE||'').replace(/\/$/,'');
  const keyId=String(env.VPAGE_KEY_ID||''),secret=String(env.VPAGE_SHARED_SECRET||'');
  let baseUrl;try{baseUrl=new URL(base)}catch{}
  const secureBase=baseUrl?.protocol==='https:'||(baseUrl?.protocol==='http:'&&['127.0.0.1','localhost'].includes(baseUrl.hostname));
  if(!secureBase||!keyId||secret.length<32)throw new VpageRemoteError('ยังไม่ได้ตั้งค่าบริการ Vpage',{status:503,code:'VPAGE_SERVICE_NOT_CONFIGURED'});
  const rawBody=body===null?'':JSON.stringify(body);if(encoder.encode(rawBody).byteLength>16384)throw new VpageRemoteError('ข้อมูลยาวเกินกำหนด',{status:413,code:'VPAGE_PAYLOAD_TOO_LARGE'});
  const timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID().replaceAll('-',''),digest=await sha256(rawBody),canonical=['vpage-v1',method,path,keyId,timestamp,nonce,ownerRef,digest].join('\n'),signature=await sign(secret,canonical);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  let response;
  try{response=await fetch(base+path,{method,headers:{'accept':'application/json','content-type':'application/json','x-vpage-key-id':keyId,'x-vpage-timestamp':timestamp,'x-vpage-nonce':nonce,'x-vpage-owner-ref':ownerRef,'x-vpage-signature':signature,...(idempotencyKey?{'idempotency-key':idempotencyKey}:{})},body:rawBody||undefined,signal:controller.signal})}
  catch{throw new VpageRemoteError('ติดต่อบริการ Vpage ไม่สำเร็จ',{status:502,code:'VPAGE_REMOTE_UNCERTAIN',ambiguous:true})}
  finally{clearTimeout(timer)}
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new VpageRemoteError(String(payload.error||'บริการ Vpage ปฏิเสธคำขอ'),{status:response.status,code:String(payload.code||'VPAGE_REMOTE_FAILED'),ambiguous:response.status>=500||response.status===408});
  return payload;
}

export async function listVpageDomains(env){
  const now=Date.now();if(domainCache.value&&domainCache.expires>now)return domainCache.value;if(domainCache.inflight)return domainCache.inflight;
  domainCache.inflight=request(env,'/api/v1/domains').then(payload=>{const value=Array.isArray(payload.items)?payload.items.slice(0,24):[];domainCache.value=value;domainCache.expires=Date.now()+60000;return value}).finally(()=>{domainCache.inflight=null});return domainCache.inflight;
}
export async function checkVpageAvailability(env,domainId,slug){
  const key=`${domainId}:${slug}`,cached=availabilityCache.get(key);if(cached?.value&&cached.expires>Date.now())return cached.value;if(cached?.inflight)return cached.inflight;
  const path=`/api/v1/domains/${encodeURIComponent(domainId)}/slugs/${encodeURIComponent(slug)}/availability`,inflight=request(env,path).then(value=>{availabilityCache.set(key,{value,expires:Date.now()+10000});return value}).catch(error=>{availabilityCache.delete(key);throw error});availabilityCache.set(key,{inflight});return inflight;
}
export async function createRemoteVpage(env,userId,key,payload){return request(env,'/api/v1/pages',{method:'POST',ownerRef:await vpageOwnerRef(userId),body:payload,idempotencyKey:key})}
export function invalidateVpageAvailability(domainId,slug){availabilityCache.delete(`${domainId}:${slug}`)}
export function clearVpageCaches(){domainCache.value=null;domainCache.expires=0;domainCache.inflight=null;availabilityCache.clear()}
