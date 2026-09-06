import crypto from 'node:crypto';

const clean=(value,max=500)=>String(value??'').trim().slice(0,max);

export function readConfig(env=process.env){
  let accounts=[];
  try{accounts=JSON.parse(env.TIKTOK_COMMISSION_ACCOUNTS_JSON||'[]')}catch{throw new Error('ACCOUNTS_JSON_INVALID')}
  if(!Array.isArray(accounts))throw new Error('ACCOUNTS_JSON_INVALID');
  accounts=accounts.map(item=>({connection_id:clean(item?.connection_id,100),session_secret_name:clean(item?.session_secret_name,300)})).filter(item=>item.connection_id&&item.session_secret_name);
  return{ingestUrl:clean(env.VISIOND_INGEST_URL,1000),statusUrl:clean(env.VISIOND_STATUS_URL,1000),secret:String(env.TIKTOK_COMMISSION_COLLECTOR_SECRET||''),adapter:clean(env.TIKTOK_COMMISSION_SOURCE_ADAPTER,100),maxAttempts:Math.min(5,Math.max(1,Number(env.TIKTOK_COMMISSION_MAX_ATTEMPTS)||3)),accounts};
}

export function readiness(config){
  const missing=[];
  if(!config.ingestUrl)missing.push('VISIOND_INGEST_URL');
  if(config.secret.length<32)missing.push('TIKTOK_COMMISSION_COLLECTOR_SECRET');
  if(!config.adapter)missing.push('TIKTOK_COMMISSION_SOURCE_ADAPTER');
  if(!config.accounts.length)missing.push('TIKTOK_COMMISSION_ACCOUNTS_JSON');
  return{ready:missing.length===0,missing,accounts:config.accounts.length};
}

export function signedRequest(body,secret,now=Date.now()){
  const timestamp=String(now),text=JSON.stringify(body),signature=crypto.createHmac('sha256',secret).update(`${timestamp}.${text}`).digest('hex');
  return{timestamp,text,signature};
}

export async function runCollector(config,{readRows,fetchImpl=fetch,now=Date.now()}={}){
  const state=readiness(config);if(!state.ready)return{ok:false,status:503,error:'collector_not_configured',...state};
  if(typeof readRows!=='function')return{ok:false,status:503,error:'source_adapter_not_loaded'};
  const results=[],report=async(account,status,error='')=>{if(!config.statusUrl)return;const body={connection_id:account.connection_id,status,error,at:new Date(now).toISOString()},signed=signedRequest(body,config.secret,now);await fetchImpl(config.statusUrl,{method:'POST',headers:{'content-type':'application/json','x-visiond-timestamp':signed.timestamp,'x-visiond-signature':signed.signature},body:signed.text})};
  for(const account of config.accounts){
    await report(account,'connecting');let rows,lastError;
    for(let attempt=1;attempt<=config.maxAttempts;attempt++){try{rows=await readRows(account);lastError=null;break}catch(error){lastError=error}}
    if(lastError){const message=String(lastError.message||'read_failed').slice(0,300);await report(account,/login|session|auth/i.test(message)?'reconnect_required':'error',message);results.push({connection_id:account.connection_id,stored:0,error:message});continue}
    if(!Array.isArray(rows)||!rows.length){await report(account,'ready');results.push({connection_id:account.connection_id,stored:0});continue}
    const payload={connection_id:account.connection_id,captured_at:new Date(now).toISOString(),rows},signed=signedRequest(payload,config.secret,now);
    const response=await fetchImpl(config.ingestUrl,{method:'POST',headers:{'content-type':'application/json','x-visiond-timestamp':signed.timestamp,'x-visiond-signature':signed.signature},body:signed.text});
    if(!response.ok)throw new Error(`INGEST_FAILED_${response.status}`);
    const data=await response.json();await report(account,'ready');results.push({connection_id:account.connection_id,stored:Number(data.stored)||0});
  }
  return{ok:true,status:200,results};
}
