import {json,sha256} from './_lib.js';
import {requestIp} from './_security.js';

const MAX_MEMORY_KEYS=5000;
const limits=new Map();
const dedupe=new Map();

function prune(store,now){
  if(store.size<MAX_MEMORY_KEYS)return;
  for(const [key,value] of store){if(value.expires<=now)store.delete(key)}
  while(store.size>=MAX_MEMORY_KEYS)store.delete(store.keys().next().value);
}

export async function edgeTelemetryLimit(request,action,limit,windowSeconds){
  const now=Date.now(),fingerprint=(await sha256(`${action}|${requestIp(request)}`)).slice(0,32);
  prune(limits,now);
  const current=limits.get(fingerprint);
  if(!current||current.expires<=now){limits.set(fingerprint,{hits:1,expires:now+windowSeconds*1000});return {ok:true}}
  current.hits+=1;
  if(current.hits>limit)return {error:json({error:'คำขอมากเกินไป ระบบพักชั่วคราว'},429,{'retry-after':String(Math.max(1,Math.ceil((current.expires-now)/1000)))})};
  return {ok:true};
}

const memoryKey=async value=>(await sha256(value)).slice(0,40);
const cacheKey=async(request,value)=>new Request(`${new URL(request.url).origin}/__edge-telemetry/${await memoryKey(value)}`,{method:'GET'});

export async function edgeTelemetryDuplicate(request,value){
  const cache=globalThis.caches?.default;
  if(cache)return Boolean(await cache.match(await cacheKey(request,value)));
  const now=Date.now();prune(dedupe,now);return (dedupe.get(await memoryKey(value))?.expires||0)>now;
}

export async function rememberEdgeTelemetry(request,value,seconds){
  const cache=globalThis.caches?.default;
  if(cache){await cache.put(await cacheKey(request,value),new Response('1',{headers:{'cache-control':`public, max-age=${seconds}`}}));return}
  const now=Date.now();prune(dedupe,now);dedupe.set(await memoryKey(value),{expires:now+seconds*1000});
}

export function resetEdgeTelemetryForTest(){limits.clear();dedupe.clear()}
