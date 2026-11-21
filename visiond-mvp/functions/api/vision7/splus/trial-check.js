import { json } from '../../../_lib.js';
import { trialKeyActive } from '../../../_splus.js';

export async function onRequestPost(ctx){
  const declared=Number(ctx.request.headers.get('content-length')||0);
  if(declared>2048)return json({active:false},413,{'cache-control':'private, no-store'});
  const reader=ctx.request.body?.getReader();let text='';
  try{
    if(!reader)return json({active:false},400,{'cache-control':'private, no-store'});
    const decoder=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;
      text+=decoder.decode(value,{stream:true});if(text.length>2048){await reader.cancel();return json({active:false},413,{'cache-control':'private, no-store'});}}
    text+=decoder.decode();
  }catch{return json({active:false},400,{'cache-control':'private, no-store'})}
  let body;try{body=JSON.parse(text)}catch{body={}}
  if(!body||typeof body!=='object')body={};
  const key=String(body.key||''),trialId=Number(body.trial_id);
  if(key.length>1200||!/^SPLUS-[A-Za-z0-9_-]{20,800}\.[A-Za-z0-9_-]{86}$/.test(key)||!Number.isSafeInteger(trialId)||trialId<=0)
    return json({active:false},400,{'cache-control':'private, no-store'});
  const active=await trialKeyActive(ctx.env,key,trialId);
  return json({active},active?200:403,{'cache-control':'private, no-store'});
}
