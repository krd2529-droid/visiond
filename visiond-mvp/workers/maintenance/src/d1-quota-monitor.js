const GRAPHQL_URL='https://api.cloudflare.com/client/v4/graphql';
export const D1_FREE_DAILY_READ_LIMIT=5_000_000;
export const D1_FREE_DAILY_WRITE_LIMIT=100_000;
const timeoutMs=8000;
let monitorInflight=null;

const clean=value=>String(value??'').trim();
const validSecret=value=>clean(value).length>=32&&clean(value).length<=512;
const accountId=value=>/^[a-f0-9]{32}$/i.test(clean(value))?clean(value):'';
const origin=value=>{let url;try{url=new URL(clean(value))}catch{throw new Error('APP_ORIGIN_INVALID')}if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('APP_ORIGIN_INVALID');return url.origin};
const intervalId=now=>String(Math.floor(now/300000));
const errorText=error=>clean(error?.message||error||'D1_QUOTA_MONITOR_ERROR').slice(0,300);

async function request(fetcher,url,init){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);try{return await fetcher(url,{...init,redirect:'manual',signal:controller.signal})}finally{clearTimeout(timer)}}

async function control(fetcher,config,body){
  const response=await request(fetcher,`${config.origin}/api/internal/d1-quota-breaker`,{method:'POST',headers:{authorization:`Bearer ${config.breakerToken}`,'content-type':'application/json',accept:'application/json'},body:JSON.stringify(body)});if(response.status>=300&&response.status<400)throw new Error('D1_QUOTA_CONTROL_REDIRECT_REFUSED');const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.code||payload.error||`D1_QUOTA_CONTROL_HTTP_${response.status}`);return payload;
}

export function parseD1AccountUsage(payload){
  if(Array.isArray(payload?.errors)&&payload.errors.length)throw new Error('CF_ANALYTICS_GRAPHQL_ERROR');
  const accounts=payload?.data?.viewer?.accounts;if(!Array.isArray(accounts)||accounts.length!==1)throw new Error('CF_ANALYTICS_ACCOUNT_MISSING');
  const groups=accounts[0]?.d1AnalyticsAdaptiveGroups;if(!Array.isArray(groups)||!groups.length)throw new Error('CF_ANALYTICS_D1_DATA_MISSING');
  let rowsRead=0,rowsWritten=0;
  for(const group of groups){const read=group?.sum?.rowsRead,written=group?.sum?.rowsWritten;if(typeof read!=='number'||!Number.isFinite(read)||read<0||typeof written!=='number'||!Number.isFinite(written)||written<0)throw new Error('CF_ANALYTICS_D1_SUM_INVALID');rowsRead+=read;rowsWritten+=written}
  return {rowsRead,rowsWritten};
}

export async function fetchD1AccountUsage(config,{fetcher=fetch,now=Date.now()}={}){
  const sampledAt=new Date(now).toISOString(),sampleDay=sampledAt.slice(0,10),query=`query VisionDD1DailyUsage($accountTag:string!,$start:Date,$end:Date){viewer{accounts(filter:{accountTag:$accountTag}){d1AnalyticsAdaptiveGroups(limit:10000,filter:{date_geq:$start,date_leq:$end}){sum{rowsRead rowsWritten}}}}}`;
  const response=await request(fetcher,GRAPHQL_URL,{method:'POST',headers:{authorization:`Bearer ${config.analyticsToken}`,'content-type':'application/json'},body:JSON.stringify({query,variables:{accountTag:config.accountId,start:sampleDay,end:sampleDay}})});if(response.status>=300&&response.status<400)throw new Error('CF_ANALYTICS_REDIRECT_REFUSED');const payload=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(`CF_ANALYTICS_HTTP_${response.status}`);const usage=parseD1AccountUsage(payload);
  return {sampleDay,sampledAt,...usage};
}

function config(env){return {origin:origin(env?.APP_ORIGIN),breakerToken:clean(env?.D1_QUOTA_BREAKER_TOKEN),accountId:accountId(env?.CF_ACCOUNT_ID),analyticsToken:clean(env?.CF_ACCOUNT_ANALYTICS_TOKEN)}}

async function execute(env,{fetcher=fetch,now=Date.now,randomUUID=()=>crypto.randomUUID()}={}){
  const current=Number(now()),settings=config(env);if(!validSecret(settings.breakerToken))throw new Error('D1_QUOTA_BREAKER_TOKEN_INVALID');
  const owner=`monitor:${intervalId(current)}:${randomUUID()}`,claim=await control(fetcher,settings,{action:'claim',owner,interval:intervalId(current)});if(!claim.claimed)return {ok:true,skipped:true,reason:claim.already_claimed?'interval_already_claimed':'lease_busy'};
  if(!settings.accountId||!validSecret(settings.analyticsToken)){
    const code=!settings.accountId?'CF_ACCOUNT_ID_INVALID':'CF_ACCOUNT_ANALYTICS_TOKEN_INVALID';await control(fetcher,settings,{action:'error',lease_token:owner,configured:false,error:code,reported_at:new Date(current).toISOString()});return {ok:false,skipped:true,error:code};
  }
  try{
    const usage=await fetchD1AccountUsage(settings,{fetcher,now:current}),result=await control(fetcher,settings,{action:'sample',lease_token:owner,sample_day:usage.sampleDay,sampled_at:usage.sampledAt,reported_at:new Date(Number(now())).toISOString(),rows_read:usage.rowsRead,rows_written:usage.rowsWritten,read_limit:D1_FREE_DAILY_READ_LIMIT,write_limit:D1_FREE_DAILY_WRITE_LIMIT});
    return {ok:true,skipped:false,quota_breaker:result.quota_breaker};
  }catch(error){
    const message=errorText(error);try{await control(fetcher,settings,{action:'error',lease_token:owner,configured:true,error:message,reported_at:new Date(Number(now())).toISOString()})}catch{}return {ok:false,skipped:true,error:message};
  }
}

export function runD1QuotaMonitor(env,options={}){if(monitorInflight)return monitorInflight;monitorInflight=execute(env,options).finally(()=>{monitorInflight=null});return monitorInflight}
