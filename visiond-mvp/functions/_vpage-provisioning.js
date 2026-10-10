import {sha256} from './_lib.js';

const encoder=new TextEncoder();
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
export const VPAGE_RESERVED_SLUGS=new Set(['admin','api','login','support','www','cdn-cgi','health','internal','status']);
const domainCache={expires:0,value:null,inflight:null};
const availabilityCache=new Map();
const editorCache=new Map();
const editorGenerations=new Map();

export class VpageRemoteError extends Error{
  constructor(message,{status=502,code='VPAGE_REMOTE_FAILED',ambiguous=false,partial=null}={}){super(message);this.status=status;this.code=code;this.ambiguous=ambiguous;this.partial=partial}
}

export const validVpageSlug=value=>typeof value==='string'&&value.length>=3&&value.length<=50&&SLUG.test(value)&&!VPAGE_RESERVED_SLUGS.has(value);
export const validVpageDisplayName=value=>typeof value==='string'&&value.trim().length>=1&&value.trim().length<=120;
export const validVpageIdempotencyKey=value=>ID.test(String(value||''));
const normalizedHttpsUrl=(value,{hosts=null,required=true,max=2048}={})=>{if(!value)return required?null:'';if(typeof value!=='string'||value.length>max||value!==value.trim())return null;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.href!==value||url.href.length>max)return null;const host=url.hostname.toLowerCase();if(hosts&&!hosts.some(item=>host===item||host.endsWith(`.${item}`)))return null;return url.href}catch{return null}};
const normalizedYoutube=value=>{if(!value)return'';if(typeof value!=='string'||value!==value.trim())return null;try{const url=new URL(value),id=url.hostname==='www.youtube.com'&&url.pathname==='/watch'?url.searchParams.get('v')||'':'';if(!/^[A-Za-z0-9_-]{6,20}$/.test(id))return null;const canonical=`https://www.youtube.com/watch?v=${id}`;return !url.username&&!url.password&&url.href===canonical&&value===canonical?canonical:null}catch{return null}};
const normalizedColor=value=>typeof value==='string'&&/^#[0-9a-fA-F]{6}$/.test(value)?value.toLowerCase():null;
export function normalizeVpageContentSet(body,setNo){
  if(!body||Number(body.set_no)!==setNo)return null;
  const productImage=normalizedHttpsUrl(body.product_image_url),backgroundImage=normalizedHttpsUrl(body.background_image_url,{required:false}),backgroundColor=body.background_color===undefined?undefined:normalizedColor(body.background_color),textFont=body.text_font===undefined?undefined:String(body.text_font),textColor=body.text_color===undefined?undefined:normalizedColor(body.text_color),youtubeUrl=normalizedYoutube(body.youtube_url),detail=typeof body.detail_text==='string'?body.detail_text.trim():'',textSize=String(body.text_size||''),textStyle=String(body.text_style||''),rawProducts=Array.isArray(body.product_items)?body.product_items:null,rawContacts=Array.isArray(body.contact_items)?body.contact_items:null;
  if(!rawProducts||rawProducts.length<1||rawProducts.length>3||!rawContacts||rawContacts.length<1||rawContacts.length>3)return null;
  const productItems=rawProducts.map(item=>({destination_url:normalizedHttpsUrl(item?.destination_url),image_url:normalizedHttpsUrl(item?.image_url,{required:false})}));
  const contactItems=rawContacts.map(item=>{const contactType=String(item?.contact_type||''),hosts=contactType==='facebook'?['facebook.com','m.me']:contactType==='line'?['line.me']:[];return{contact_type:contactType,destination_url:hosts.length?normalizedHttpsUrl(item?.destination_url,{hosts}):null,image_url:normalizedHttpsUrl(item?.image_url,{required:false})}});
  if(!productImage||backgroundImage===null||!backgroundImage&&!backgroundColor||backgroundColor===null||textFont!==undefined&&!['system','sans','serif','mono'].includes(textFont)||textColor===null||youtubeUrl===null||detail.length<1||detail.length>4000||!['small','medium','large'].includes(textSize)||!['normal','strong','emphasis'].includes(textStyle)||productItems.some(item=>!item.destination_url||item.image_url===null)||contactItems.some(item=>!['facebook','line'].includes(item.contact_type)||!item.destination_url||item.image_url===null))return null;
  return{set_no:setNo,product_image_url:productImage,detail_text:detail,text_size:textSize,text_style:textStyle,youtube_url:youtubeUrl,product_url:productItems[0].destination_url,contact_url:contactItems[0].destination_url,background_image_url:backgroundImage,...(backgroundColor!==undefined?{background_color:backgroundColor}:{}),...(textFont!==undefined?{text_font:textFont}:{}),...(textColor!==undefined?{text_color:textColor}:{}),product_items:productItems.map((item,index)=>({position:index+1,...item})),contact_items:contactItems.map((item,index)=>({position:index+1,...item}))};
}
export function normalizeVpageCreateContent(body){
  const activeSet=Number(body?.active_set),sets=Array.isArray(body?.content_sets)&&body.content_sets.length===2?[normalizeVpageContentSet(body.content_sets[0],1),normalizeVpageContentSet(body.content_sets[1],2)]:null;
  return [1,2].includes(activeSet)&&sets?.every(Boolean)?{active_set:activeSet,content_sets:sets}:null;
}
export const vpageOwnerRef=userId=>sha256(`visiond-vpage-owner-v1:${Number(userId)}`);
export const vpageActorRef=userId=>sha256(`visiond-vpage-actor-v1:${Number(userId)}`);
const hex=buffer=>[...new Uint8Array(buffer)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const sign=async(secret,canonical)=>{const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',key,encoder.encode(canonical)))};

async function request(env,path,{method='GET',ownerRef='system',body=null,idempotencyKey=''}={}){
  const base=String(env.VPAGE_API_BASE||'').replace(/\/$/,'');
  const keyId=String(env.VPAGE_KEY_ID||''),secret=String(env.VPAGE_SHARED_SECRET||'');
  let baseUrl;try{baseUrl=new URL(base)}catch{}
  const secureBase=baseUrl?.protocol==='https:'||(baseUrl?.protocol==='http:'&&['127.0.0.1','localhost'].includes(baseUrl.hostname));
  if(!secureBase||!keyId||secret.length<32)throw new VpageRemoteError('ยังไม่ได้ตั้งค่าบริการ Vpage',{status:503,code:'VPAGE_SERVICE_NOT_CONFIGURED'});
  const rawBody=body===null?'':JSON.stringify(body);if(encoder.encode(rawBody).byteLength>131072)throw new VpageRemoteError('ข้อมูลยาวเกินกำหนด',{status:413,code:'VPAGE_PAYLOAD_TOO_LARGE'});
  const timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID().replaceAll('-',''),digest=await sha256(rawBody),canonical=['vpage-v1',method,path,keyId,timestamp,nonce,ownerRef,digest].join('\n'),signature=await sign(secret,canonical);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  let response;
  try{response=await fetch(base+path,{method,headers:{'accept':'application/json','content-type':'application/json','x-vpage-key-id':keyId,'x-vpage-timestamp':timestamp,'x-vpage-nonce':nonce,'x-vpage-owner-ref':ownerRef,'x-vpage-signature':signature,...(idempotencyKey?{'idempotency-key':idempotencyKey}:{})},body:rawBody||undefined,signal:controller.signal})}
  catch{throw new VpageRemoteError('ติดต่อบริการ Vpage ไม่สำเร็จ',{status:502,code:'VPAGE_REMOTE_UNCERTAIN',ambiguous:true})}
  finally{clearTimeout(timer)}
  const payload=await response.json().catch(()=>({}));
  if(!response.ok){const code=String(payload.code||'VPAGE_REMOTE_FAILED');throw new VpageRemoteError(String(payload.error||'บริการ Vpage ปฏิเสธคำขอ'),{status:response.status,code,ambiguous:response.status>=500||response.status===408||code==='VPAGE_IDEMPOTENCY_IN_PROGRESS'})}
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
export async function renewRemoteVpage(env,{userId,pageId,key}){
  const ownerRef=await vpageOwnerRef(userId),body={},renewed=await request(env,`/api/v1/pages/${encodeURIComponent(pageId)}/renew`,{method:'POST',ownerRef,body,idempotencyKey:key});
  if(renewed?.item?.status!=='suspended'){invalidateEditor(pageId);return renewed}
  try{return await resumeRenewedVpage(env,{userId,pageId,key,expectedExpiry:renewed.item.expires_at})}
  catch(error){const known=error instanceof VpageRemoteError;throw new VpageRemoteError('ต่ออายุแล้ว แต่ยังยืนยันการกลับมาเปิดใช้ไม่ได้',{status:known?error.status:502,code:known?error.code:'VPAGE_RENEWAL_RESUME_UNCERTAIN',ambiguous:true,partial:{item:renewed.item}})}
}
export async function compensateRemoteVpage(env,{userId,actorId,pageId,key,days,expectedExpiry}){
  const value=await request(env,`/api/v1/pages/${encodeURIComponent(pageId)}/compensate`,{method:'POST',ownerRef:'system',body:{owner_ref:await vpageOwnerRef(userId),actor_ref:await vpageActorRef(actorId),days,expected_expiry:expectedExpiry},idempotencyKey:key});
  invalidateEditor(pageId);return value;
}
export async function resumeRenewedVpage(env,{userId,pageId,key,expectedExpiry}){
  const ownerRef=await vpageOwnerRef(userId),body={},resumeKey=`renew-resume-${await sha256(key)}`,resumed=await request(env,`/api/v1/pages/${encodeURIComponent(pageId)}/resume`,{method:'POST',ownerRef,body,idempotencyKey:resumeKey}),item=resumed?.item;
  if(!item||item.id!==pageId||item.status!=='active'||!item.expires_at||new Date(item.expires_at).getTime()!==new Date(expectedExpiry).getTime())throw new VpageRemoteError('ผลเปิดใช้หลังต่ออายุไม่ถูกต้อง',{status:502,code:'VPAGE_RENEWAL_RESUME_RESPONSE_INVALID',ambiguous:true});
  invalidateEditor(pageId);return resumed;
}
export function invalidateVpageAvailability(domainId,slug){availabilityCache.delete(`${domainId}:${slug}`)}
const editorKey=(ownerRef,pageId)=>`${ownerRef}:${pageId}`;
function invalidateEditor(pageId){editorGenerations.set(pageId,(editorGenerations.get(pageId)||0)+1);for(const key of editorCache.keys())if(key.endsWith(`:${pageId}`))editorCache.delete(key)}
export async function readRemoteVpageEditor(env,{userId,pageId,boss=false}){
  const ownerRef=boss?'system':await vpageOwnerRef(userId),key=editorKey(ownerRef,pageId),generation=editorGenerations.get(pageId)||0,cached=editorCache.get(key);if(cached?.generation===generation&&cached?.value&&cached.expires>Date.now())return cached.value;if(cached?.generation===generation&&cached?.inflight)return cached.inflight;
  let inflight;inflight=request(env,`/api/v1/pages/${encodeURIComponent(pageId)}/editor`,{ownerRef}).then(value=>{if((editorGenerations.get(pageId)||0)===generation&&editorCache.get(key)?.inflight===inflight)editorCache.set(key,{generation,value,expires:Date.now()+5000});return value}).catch(error=>{if(editorCache.get(key)?.inflight===inflight)editorCache.delete(key);throw error});editorCache.set(key,{generation,inflight});return inflight;
}
export async function readRemoteVpageEditorFresh(env,{userId,pageId,boss=false}){invalidateEditor(pageId);return request(env,`/api/v1/pages/${encodeURIComponent(pageId)}/editor`,{ownerRef:boss?'system':await vpageOwnerRef(userId)})}
export async function saveRemoteVpageContent(env,{userId,pageId,setNo,key,payload,boss=false}){const value=await request(env,`/api/v1/pages/${encodeURIComponent(pageId)}/content-sets/${setNo}`,{method:'PUT',ownerRef:boss?'system':await vpageOwnerRef(userId),body:payload,idempotencyKey:key});invalidateEditor(pageId);return value}
export async function switchRemoteVpageSet(env,{userId,pageId,setNo,key,boss=false}){const ownerRef=boss?'system':await vpageOwnerRef(userId),value=await request(env,`/api/v1/pages/${encodeURIComponent(pageId)}/active-set`,{method:'POST',ownerRef,body:{active_set:setNo,actor_ref:boss?await vpageActorRef(userId):ownerRef,actor_kind:boss?'boss':'owner'},idempotencyKey:key});invalidateEditor(pageId);return value}
export function clearVpageCaches(){domainCache.value=null;domainCache.expires=0;domainCache.inflight=null;availabilityCache.clear();editorCache.clear();editorGenerations.clear()}
