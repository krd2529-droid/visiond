export const D1_QUOTA_BREAKER_KEY='controls/d1-quota-breaker-v1.json';
export const D1_QUOTA_CLOSE_PERCENT=70;
export const D1_QUOTA_REOPEN_PERCENT=60;
export const D1_QUOTA_STALE_MS=15*60*1000;

const cachedByBucket=new WeakMap();
const inflightByBucket=new WeakMap();
const generationByBucket=new WeakMap();
const text=value=>String(value??'').trim();
const finite=value=>value!==null&&value!==undefined&&value!==''&&typeof value!=='boolean'&&Number.isFinite(Number(value))?Number(value):null;
const reportNumber=value=>typeof value==='number'&&Number.isFinite(value)?value:null;
const percent=(used,limit)=>limit>0?Number((used/limit*100).toFixed(4)):null;
const iso=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time).toISOString():''};
const day=value=>/^\d{4}-\d{2}-\d{2}$/.test(text(value))?text(value):'';
const nullableStoredNumber=value=>value===null||(typeof value==='number'&&Number.isFinite(value)&&value>=0);

function initialState(status='missing'){
  return {version:1,revision:0,auto_closed:false,auto_closed_day:'',status,reason:status==='unconfigured'?'monitor_not_configured':'no_sample',sample_day:'',sampled_at:'',reported_at:'',rows_read:null,rows_written:null,read_limit:null,write_limit:null,read_percent:null,write_percent:null,usage_percent:null,source:'cloudflare_d1_account_daily',last_error:'',monitor_configured:false,monitor_interval:'',monitor_lease:null,audit:[]};
}

export function normalizeD1QuotaBreakerState(input){
  const base=initialState(),value=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const lease=value.monitor_lease&&typeof value.monitor_lease==='object'?{owner:text(value.monitor_lease.owner).slice(0,100),expires_at:iso(value.monitor_lease.expires_at)}:null;
  return {...base,version:1,revision:Math.max(0,Math.floor(finite(value.revision)||0)),auto_closed:value.auto_closed===true,auto_closed_day:day(value.auto_closed_day),status:['ok','error','missing','unconfigured'].includes(value.status)?value.status:'error',reason:text(value.reason).slice(0,120)||base.reason,sample_day:day(value.sample_day),sampled_at:iso(value.sampled_at),reported_at:iso(value.reported_at),rows_read:finite(value.rows_read),rows_written:finite(value.rows_written),read_limit:finite(value.read_limit),write_limit:finite(value.write_limit),read_percent:finite(value.read_percent),write_percent:finite(value.write_percent),usage_percent:finite(value.usage_percent),source:text(value.source).slice(0,120)||base.source,last_error:text(value.last_error).slice(0,300),monitor_configured:value.monitor_configured===true,monitor_interval:/^\d{6,12}$/.test(text(value.monitor_interval))?text(value.monitor_interval):'',monitor_lease:lease?.owner&&lease.expires_at?lease:null,audit:Array.isArray(value.audit)?value.audit.slice(-12):[]};
}

export function d1QuotaBreakerPublicState(state){
  const value=state&&typeof state==='object'?state:{};
  return {configured:value.configured===true,storage_configured:value.storage_configured===true,control_available:value.control_available===true,status:text(value.status),auto_closed:value.auto_closed===true,reason:text(value.reason),sample_day:day(value.sample_day),sampled_at:iso(value.sampled_at),reported_at:iso(value.reported_at),rows_read:finite(value.rows_read),rows_written:finite(value.rows_written),read_limit:finite(value.read_limit),write_limit:finite(value.write_limit),read_percent:finite(value.read_percent),write_percent:finite(value.write_percent),usage_percent:finite(value.usage_percent),source:text(value.source),stale:value.stale===true,last_error:text(value.last_error),revision:Math.max(0,Math.floor(finite(value.revision)||0))};
}

function validPersistedState(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||!Number.isSafeInteger(value.revision)||value.revision<0||typeof value.auto_closed!=='boolean'||typeof value.auto_closed_day!=='string'||!['ok','error','missing','unconfigured'].includes(value.status)||typeof value.reason!=='string'||typeof value.sample_day!=='string'||typeof value.sampled_at!=='string'||typeof value.reported_at!=='string'||typeof value.source!=='string'||typeof value.last_error!=='string'||typeof value.monitor_configured!=='boolean'||typeof value.monitor_interval!=='string'||!Array.isArray(value.audit))return false;
  for(const field of ['rows_read','rows_written','read_limit','write_limit','read_percent','write_percent','usage_percent'])if(!nullableStoredNumber(value[field]))return false;
  if(value.monitor_lease!==null&&(!value.monitor_lease||typeof value.monitor_lease!=='object'||Array.isArray(value.monitor_lease)||typeof value.monitor_lease.owner!=='string'||typeof value.monitor_lease.expires_at!=='string'))return false;
  return true;
}

async function readObject(bucket){
  const object=await bucket.get(D1_QUOTA_BREAKER_KEY);
  if(!object)return {state:initialState(),etag:'',valid:true};
  try{const parsed=JSON.parse(await object.text());if(!validPersistedState(parsed))throw new Error('BREAKER_STATE_INVALID');return {state:normalizeD1QuotaBreakerState(parsed),etag:text(object.etag),valid:true}}catch{return {state:{...initialState('error'),reason:'state_invalid',last_error:'BREAKER_STATE_INVALID'},etag:text(object.etag),valid:false}}
}

export async function loadD1QuotaBreakerState(env,{fresh=false,now=Date.now}={}){
  const bucket=env?.FILES;
  if(!bucket)return {...initialState('unconfigured'),stale:true,configured:false,storage_configured:false,control_available:false};
  const currentTime=Number(now()),cached=cachedByBucket.get(bucket);
  if(!fresh&&cached&&currentTime-cached.loadedAt<30000)return decorate(cached.state,currentTime);
  if(fresh)generationByBucket.set(bucket,(generationByBucket.get(bucket)||0)+1);
  const generation=generationByBucket.get(bucket)||0,inflight=inflightByBucket.get(bucket);if(!fresh&&inflight&&inflight.generation===generation)return decorate(await inflight.promise,currentTime);
  const task=readObject(bucket).then(result=>{if(!result.valid&&cached)return {...cached.state,control_available:true,status:'error',reason:cached.state.auto_closed?'state_read_error_latched':'state_read_error_last_known_open',last_error:result.state.last_error};const state={...result.state,control_available:result.valid};if(result.valid&&(generationByBucket.get(bucket)||0)===generation)cachedByBucket.set(bucket,{state,loadedAt:Number(now())});return state}).catch(error=>{const prior=cached?.state||initialState('error');return {...prior,control_available:Boolean(cached),status:'error',reason:prior.auto_closed?'state_read_error_latched':'state_read_error_last_known_open',last_error:text(error?.message||'BREAKER_STATE_READ_FAILED').slice(0,300)}}).finally(()=>{if(inflightByBucket.get(bucket)?.promise===task)inflightByBucket.delete(bucket)});
  inflightByBucket.set(bucket,{promise:task,generation});
  return decorate(await task,currentTime);
}

function decorate(state,currentTime){
  const sampled=Date.parse(state.sampled_at),stale=state.status!=='ok'||!Number.isFinite(sampled)||currentTime-sampled>D1_QUOTA_STALE_MS;
  return {...state,configured:state.monitor_configured===true,storage_configured:true,control_available:state.control_available!==false,stale};
}

function validateReport(report,now){
  const value=report&&typeof report==='object'&&!Array.isArray(report)?report:{};
  const reportedAt=iso(value.reported_at)||new Date(now).toISOString();
  if(value.status==='error')return {kind:'error',reportedAt,error:text(value.error||value.code||'MONITOR_ERROR').slice(0,300),configured:value.configured===true};
  const sampleDay=day(value.sample_day),sampledAt=iso(value.sampled_at),rowsRead=reportNumber(value.rows_read),rowsWritten=reportNumber(value.rows_written),readLimit=reportNumber(value.read_limit),writeLimit=reportNumber(value.write_limit);
  if(!sampleDay||!sampledAt||sampledAt.slice(0,10)!==sampleDay||rowsRead===null||rowsWritten===null||rowsRead<0||rowsWritten<0||readLimit===null||writeLimit===null||readLimit<=0||writeLimit<=0)throw new Error('D1_QUOTA_SAMPLE_INVALID');
  if(Date.parse(sampledAt)>now+5*60*1000)throw new Error('D1_QUOTA_SAMPLE_FROM_FUTURE');
  return {kind:'sample',reportedAt,sampleDay,sampledAt,rowsRead,rowsWritten,readLimit,writeLimit,readPercent:percent(rowsRead,readLimit),writePercent:percent(rowsWritten,writeLimit),freshForReset:sampleDay===new Date(now).toISOString().slice(0,10)&&now-Date.parse(sampledAt)<=D1_QUOTA_STALE_MS};
}

function transition(current,report){
  if(report.kind==='error'){
    if(current.reported_at&&Date.parse(report.reportedAt)<=Date.parse(current.reported_at))return null;
    return {...current,revision:current.revision+1,status:'error',reason:current.auto_closed?'monitor_error_latched':'monitor_error_last_known_open',reported_at:report.reportedAt,last_error:report.error,monitor_configured:report.configured};
  }
  const currentSample=Date.parse(current.sampled_at)||0,nextSample=Date.parse(report.sampledAt);
  if(nextSample<=currentSample)return null;
  const usagePercent=Math.max(report.readPercent,report.writePercent),readAtClose=report.rowsRead*100>=report.readLimit*D1_QUOTA_CLOSE_PERCENT,writeAtClose=report.rowsWritten*100>=report.writeLimit*D1_QUOTA_CLOSE_PERCENT,readBelowReopen=report.rowsRead*100<report.readLimit*D1_QUOTA_REOPEN_PERCENT,writeBelowReopen=report.rowsWritten*100<report.writeLimit*D1_QUOTA_REOPEN_PERCENT,closedDay=current.auto_closed_day||current.sample_day,newDay=Boolean(closedDay&&report.sampleDay>closedDay);let autoClosed=current.auto_closed,autoClosedDay=closedDay,reason='below_close_threshold';
  if(autoClosed){
    if(newDay&&report.freshForReset&&readBelowReopen&&writeBelowReopen){autoClosed=false;autoClosedDay='';reason='confirmed_new_day_below_reopen_threshold'}
    else reason=newDay?'new_day_not_below_reopen_threshold':'quota_latched_for_utc_day';
  }else if(readAtClose||writeAtClose){autoClosed=true;autoClosedDay=report.sampleDay;reason=readAtClose&&writeAtClose?'read_and_write_threshold_reached':readAtClose?'read_threshold_reached':'write_threshold_reached'}
  const changed=autoClosed!==current.auto_closed,audit=changed?[...current.audit,{revision:current.revision+1,auto_closed:autoClosed,reason,sample_day:report.sampleDay,sampled_at:report.sampledAt}].slice(-12):current.audit;
  return {...current,revision:current.revision+1,auto_closed:autoClosed,auto_closed_day:autoClosedDay,status:'ok',reason,sample_day:report.sampleDay,sampled_at:report.sampledAt,reported_at:report.reportedAt,rows_read:report.rowsRead,rows_written:report.rowsWritten,read_limit:report.readLimit,write_limit:report.writeLimit,read_percent:report.readPercent,write_percent:report.writePercent,usage_percent:usagePercent,source:'cloudflare_d1_account_daily',last_error:'',monitor_configured:true,audit};
}

async function conditionalWrite(bucket,current,etag,next,now){const onlyIf=etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},written=await bucket.put(D1_QUOTA_BREAKER_KEY,JSON.stringify(next),{httpMetadata:{contentType:'application/json'},onlyIf});if(!written)return null;generationByBucket.set(bucket,(generationByBucket.get(bucket)||0)+1);cachedByBucket.set(bucket,{state:{...next,control_available:true},loadedAt:Number(now())});return next}

export async function claimD1QuotaMonitor(env,{owner,interval,now=Date.now,leaseMs=2*60*1000,maxAttempts=4}={}){
  const bucket=env?.FILES,claimOwner=text(owner).slice(0,100),intervalId=text(interval),currentTime=Number(now()),intervalNumber=Number(intervalId);if(!bucket)throw new Error('FILES_BINDING_REQUIRED');if(!/^[A-Za-z0-9:_-]{16,100}$/.test(claimOwner))throw new Error('D1_QUOTA_LEASE_OWNER_INVALID');if(!/^\d{6,12}$/.test(intervalId)||!Number.isSafeInteger(intervalNumber)||Math.abs(intervalNumber-Math.floor(currentTime/300000))>1)throw new Error('D1_QUOTA_INTERVAL_INVALID');
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const read=await readObject(bucket);if(!read.valid)throw new Error('D1_QUOTA_STATE_INVALID');const {state:current,etag}=read,expires=Date.parse(current.monitor_lease?.expires_at||'');
    if(current.monitor_interval===intervalId)return {claimed:false,busy:false,already_claimed:true};
    if(current.monitor_lease?.owner&&Number.isFinite(expires)&&expires>currentTime)return {claimed:false,busy:true,expires_at:current.monitor_lease.expires_at};
    const next={...current,revision:current.revision+1,monitor_interval:intervalId,monitor_lease:{owner:claimOwner,expires_at:new Date(currentTime+leaseMs).toISOString()}},written=await conditionalWrite(bucket,current,etag,next,now);
    if(written)return {claimed:true,busy:false,lease_token:claimOwner,expires_at:next.monitor_lease.expires_at};
  }
  throw new Error('D1_QUOTA_STATE_CONFLICT');
}

export async function updateD1QuotaBreakerState(env,input,{now=Date.now,maxAttempts=4,leaseToken=''}={}){
  const bucket=env?.FILES;if(!bucket)throw new Error('FILES_BINDING_REQUIRED');const report=validateReport(input,Number(now())),expectedLease=text(leaseToken);
  for(let attempt=0;attempt<maxAttempts;attempt++){
    const read=await readObject(bucket);if(!read.valid)throw new Error('D1_QUOTA_STATE_INVALID');const {state:current,etag}=read,next=transition(current,report);
    if(expectedLease&&current.monitor_lease?.owner!==expectedLease)throw new Error('D1_QUOTA_LEASE_NOT_OWNED');
    if(!next&&!expectedLease)return {...decorate(current,Number(now())),updated:false};
    const candidate={...(next||current),monitor_lease:expectedLease?null:current.monitor_lease},written=await conditionalWrite(bucket,current,etag,candidate,now);
    if(written)return {...decorate(candidate,Number(now())),updated:Boolean(next)};
  }
  throw new Error('D1_QUOTA_STATE_CONFLICT');
}

export async function requireD1DataFetchAvailable(ctx,scope){
  const state=await loadD1QuotaBreakerState(ctx.env,{fresh:true});
  if(!state.control_available)return new Response(JSON.stringify({error:'ยังอ่านสถานะควบคุมโควตา D1 ไม่ได้ งานดึงข้อมูลจึงถูกพักไว้ชั่วคราว',code:'D1_QUOTA_CONTROL_UNAVAILABLE',scope:text(scope).slice(0,80)}),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','retry-after':'300','x-visiond-control':'d1-quota-unavailable'}});
  if(!state.auto_closed)return null;
  return new Response(JSON.stringify({error:'ระบบพักงานดึงข้อมูลชั่วคราวเพื่อควบคุมโควตา Cloudflare D1',code:'D1_QUOTA_BREAKER_OPEN',scope:text(scope).slice(0,80),quota_breaker:{auto_closed:true,reason:state.reason,sample_day:state.sample_day,sampled_at:state.sampled_at,usage_percent:state.usage_percent}}),{status:503,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','retry-after':'1800','x-visiond-control':'d1-quota-breaker'}});
}

export function clearD1QuotaBreakerMemoryCache(env){if(env?.FILES){cachedByBucket.delete(env.FILES);inflightByBucket.delete(env.FILES);generationByBucket.delete(env.FILES)}}
