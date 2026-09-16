'use strict';

const TRUSTED_ORIGIN='https://visiondonline.com';
const MAX_IMAGE_BYTES=5*1024*1024;
const CHUNK_BYTES=192*1024;
const ALLOWED_TYPES=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);
const STATE_PREFIX='visiondShopeeFill:';
const senderAllowed=sender=>{try{const url=new URL(sender?.tab?.url||'');return sender?.frameId===0&&url.hostname==='seller.shopee.co.th'&&url.pathname==='/portal/product/new'}catch{return false}};
const stateKey=sender=>`${STATE_PREFIX}${sender.tab.id}:${sender.documentId||'document'}`;
const toBase64=bytes=>{let output='';for(let index=0;index<bytes.length;index+=0x8000)output+=String.fromCharCode(...bytes.subarray(index,index+0x8000));return btoa(output)};
const magicType=bytes=>{
  if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return'image/jpeg';
  if(bytes.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value))return'image/png';
  if(bytes.length>=12&&String.fromCharCode(...bytes.subarray(0,4))==='RIFF'&&String.fromCharCode(...bytes.subarray(8,12))==='WEBP')return'image/webp';
  return'';
};

function parseGalleryUrl(rawUrl,productId){
  let url;
  try{url=new URL(rawUrl)}catch{return null}
  if(url.origin!==TRUSTED_ORIGIN||url.port||url.username||url.password||url.hash)return null;
  const route=url.pathname.match(/^\/api\/toys-center\/gallery\/(\d+)\/(\d+)$/),query=[...url.searchParams.entries()];
  const position=route?Number(route[2]):-1;
  if(!route||route[1]!==String(productId)||route[2]!==String(position)||position<0||position>9)return null;
  if(query.length!==1||query[0][0]!=='v'||!/^[1-9]\d*$/.test(query[0][1]))return null;
  return url;
}

async function fetchImage(rawUrl,productId,signal){
  const url=parseGalleryUrl(rawUrl,productId);
  if(!url)return{ok:false,code:'untrusted_image_url'};
  const response=await fetch(url.href,{credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal});
  if(!response.ok)return{ok:false,code:'image_http',status:response.status};
  const type=String(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
  if(!ALLOWED_TYPES.has(type))return{ok:false,code:'image_mime',type};
  const declared=Number(response.headers.get('content-length')||0);
  if(Number.isFinite(declared)&&declared>MAX_IMAGE_BYTES)return{ok:false,code:'image_too_large',bytes:declared,max_bytes:MAX_IMAGE_BYTES};
  if(!response.body)return{ok:false,code:'image_body'};
  const reader=response.body.getReader(),chunks=[];let total=0;
  try{
    while(true){
      const part=await reader.read();
      if(part.done)break;
      total+=part.value.byteLength;
      if(total>MAX_IMAGE_BYTES){await reader.cancel();return{ok:false,code:'image_too_large',bytes:total,max_bytes:MAX_IMAGE_BYTES}}
      chunks.push(part.value);
    }
  }finally{reader.releaseLock()}
  if(!total)return{ok:false,code:'image_empty'};
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  const detected=magicType(bytes);
  if(detected!==type)return{ok:false,code:'image_magic',type,detected:detected||null};
  return{ok:true,type,extension:ALLOWED_TYPES.get(type),bytes,size:total};
}

chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='visiond-shopee-image-fetch'||!senderAllowed(port.sender)){port.disconnect();return}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  port.onDisconnect.addListener(()=>controller.abort());
  port.onMessage.addListener(async request=>{
    if(request?.type!=='fetch')return;
    try{
      const result=await fetchImage(request.url,request.productId,controller.signal);
      if(!result.ok){port.postMessage(result);return}
      port.postMessage({ok:true,type:'start',mime:result.type,extension:result.extension,size:result.size});
      for(let offset=0,index=0;offset<result.bytes.length;offset+=CHUNK_BYTES,index++)port.postMessage({ok:true,type:'chunk',index,data:toBase64(result.bytes.subarray(offset,Math.min(offset+CHUNK_BYTES,result.bytes.length)))});
      port.postMessage({ok:true,type:'end'});
    }catch(error){port.postMessage({ok:false,code:error?.name==='AbortError'?'image_timeout':'image_download'})}
    finally{clearTimeout(timer)}
  });
});

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(!senderAllowed(sender))return false;
  if(message?.type==='VISIOND_SHOPEE_GET_FILL_STATE'){
    chrome.storage.session.get(stateKey(sender),value=>{if(chrome.runtime.lastError)return sendResponse({ok:false,code:'state_storage'});sendResponse({ok:true,state:value[stateKey(sender)]||null})});
    return true;
  }
  if(message?.type==='VISIOND_SHOPEE_SET_FILL_STATE'){
    chrome.storage.session.set({[stateKey(sender)]:message.state},()=>sendResponse(chrome.runtime.lastError?{ok:false,code:'state_storage'}:{ok:true}));
    return true;
  }
  return false;
});

globalThis.VisionDShopeeBackgroundTest=Object.freeze({parseGalleryUrl,magicType,fetchImage,MAX_IMAGE_BYTES});
