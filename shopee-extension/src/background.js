'use strict';

const TRUSTED_ORIGIN='https://visiondonline.com';
const CHUNK_BYTES=192*1024;
const PLATFORM={
  shopee:{host:'seller.shopee.co.th',path:'/portal/product/new',port:'visiond-shopee-image-fetch',message:'VISIOND_SHOPEE',statePrefix:'visiondShopeeFill:',maxImageBytes:5*1024*1024,allowedTypes:new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']])},
  thaimart:{host:'seller.thaimart.com',path:'/products/create',port:'visiond-thaimart-image-fetch',message:'VISIOND_THAIMART',statePrefix:'visiondThaiMartFill:',maxImageBytes:10*1024*1024,allowedTypes:new Map([['image/jpeg','jpg'],['image/png','png']])}
};
const senderAllowed=(sender,platform)=>{const config=PLATFORM[platform];try{const url=new URL(sender?.tab?.url||'');return sender?.frameId===0&&url.protocol==='https:'&&url.host===config.host&&url.pathname===config.path}catch{return false}};
const stateKey=(sender,platform)=>`${PLATFORM[platform].statePrefix}${sender.tab.id}:${sender.documentId||'document'}`;
const toBase64=bytes=>{let output='';for(let index=0;index<bytes.length;index+=0x8000)output+=String.fromCharCode(...bytes.subarray(index,index+0x8000));return btoa(output)};
const magicType=bytes=>{if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg';if(bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value))return'image/png';if(bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return'image/webp';return''};

function parseGalleryUrl(rawUrl,productId){let url;try{url=new URL(rawUrl)}catch{return null}if(url.origin!==TRUSTED_ORIGIN||url.port||url.username||url.password||url.hash)return null;const route=url.pathname.match(/^\/api\/toys-center\/gallery\/(\d+)\/(\d+)$/),query=[...url.searchParams.entries()],position=route?Number(route[2]):-1;if(!route||route[1]!==String(productId)||route[2]!==String(position)||position<0||position>9)return null;if(query.length!==1||query[0][0]!=='v'||!/^[1-9]\d*$/.test(query[0][1]))return null;return url}

async function fetchImage(rawUrl,productId,signal,options={}){
  const maxImageBytes=options.maxImageBytes||PLATFORM.shopee.maxImageBytes,allowedTypes=options.allowedTypes||PLATFORM.shopee.allowedTypes,url=parseGalleryUrl(rawUrl,productId);if(!url)return{ok:false,code:'untrusted_image_url'};
  const response=await fetch(url.href,{credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal});if(!response.ok)return{ok:false,code:'image_http',status:response.status};
  const type=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();if(!allowedTypes.has(type))return{ok:false,code:'image_mime',type};
  const declared=Number(response.headers.get('content-length')||0);if(Number.isFinite(declared)&&declared>maxImageBytes)return{ok:false,code:'image_too_large',bytes:declared,max_bytes:maxImageBytes};if(!response.body)return{ok:false,code:'image_body'};
  const reader=response.body.getReader(),chunks=[];let total=0;try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>maxImageBytes){await reader.cancel();return{ok:false,code:'image_too_large',bytes:total,max_bytes:maxImageBytes}}chunks.push(part.value)}}finally{reader.releaseLock()}
  if(!total)return{ok:false,code:'image_empty'};const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}const detected=magicType(bytes);if(detected!==type)return{ok:false,code:'image_magic',type,detected:detected||null};return{ok:true,type,extension:allowedTypes.get(type),bytes,size:total};
}

chrome.runtime.onConnect.addListener(port=>{
  const platform=Object.keys(PLATFORM).find(key=>PLATFORM[key].port===port.name&&senderAllowed(port.sender,key));if(!platform){port.disconnect();return}
  const config=PLATFORM[platform],controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);port.onDisconnect.addListener(()=>controller.abort());
  port.onMessage.addListener(async request=>{if(request?.type!=='fetch')return;try{const result=await fetchImage(request.url,request.productId,controller.signal,config);if(!result.ok){port.postMessage(result);return}port.postMessage({ok:true,type:'start',mime:result.type,extension:result.extension,size:result.size});for(let offset=0,index=0;offset<result.bytes.length;offset+=CHUNK_BYTES,index++)port.postMessage({ok:true,type:'chunk',index,data:toBase64(result.bytes.subarray(offset,Math.min(offset+CHUNK_BYTES,result.bytes.length)))});port.postMessage({ok:true,type:'end'})}catch(error){port.postMessage({ok:false,code:error?.name==='AbortError'?'image_timeout':'image_download'})}finally{clearTimeout(timer)}});
});

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  const platform=Object.keys(PLATFORM).find(key=>senderAllowed(sender,key)&&typeof message?.type==='string'&&message.type.startsWith(PLATFORM[key].message));if(!platform)return false;
  const key=stateKey(sender,platform),prefix=PLATFORM[platform].message;
  if(message.type===`${prefix}_GET_FILL_STATE`){chrome.storage.session.get(key,value=>{if(chrome.runtime.lastError)return sendResponse({ok:false,code:'state_storage'});sendResponse({ok:true,state:value[key]||null})});return true}
  if(message.type===`${prefix}_SET_FILL_STATE`){chrome.storage.session.set({[key]:message.state},()=>sendResponse(chrome.runtime.lastError?{ok:false,code:'state_storage'}:{ok:true}));return true}
  return false;
});

globalThis.VisionDShopeeBackgroundTest=Object.freeze({parseGalleryUrl,magicType,fetchImage,MAX_IMAGE_BYTES:PLATFORM.shopee.maxImageBytes,PLATFORM,senderAllowed});
