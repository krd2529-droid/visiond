import {json} from '../../_lib.js';
import {claimD1QuotaMonitor,d1QuotaBreakerPublicState,loadD1QuotaBreakerState,updateD1QuotaBreakerState} from '../../_d1_quota_breaker.js';
import {verifyCollectorRequest} from './tiktok-commission-snapshots.js';

const noStore={'cache-control':'private, no-store'};
const bytes=value=>new TextEncoder().encode(value);
async function validToken(request,secret){
  const expected=String(secret||''),header=request.headers.get('authorization')||'',provided=header.startsWith('Bearer ')?header.slice(7):'';
  if(expected.length<32||!provided||provided.length>512)return false;
  const [left,right]=await Promise.all([crypto.subtle.digest('SHA-256',bytes(expected)),crypto.subtle.digest('SHA-256',bytes(provided))]),a=new Uint8Array(left),b=new Uint8Array(right);let different=a.length===b.length?0:1;
  for(let index=0;index<Math.min(a.length,b.length);index++)different|=a[index]^b[index];return different===0;
}

export async function onRequestGet(ctx){
  if(!await validToken(ctx.request,ctx.env.D1_QUOTA_BREAKER_TOKEN))return json({error:'ไม่อนุญาต'},401,noStore);
  return json({ok:true,quota_breaker:d1QuotaBreakerPublicState(await loadD1QuotaBreakerState(ctx.env,{fresh:true}))},200,noStore);
}

export async function onRequestPost(ctx){
  const bearerAuthorized=await validToken(ctx.request,ctx.env.D1_QUOTA_BREAKER_TOKEN);let body;
  if(bearerAuthorized)body=await ctx.request.json().catch(()=>null);
  else{
    const verifiedBody=await verifyCollectorRequest(ctx.request.clone(),ctx.env.TIKTOK_COMMISSION_COLLECTOR_SECRET);
    if(verifiedBody===null)return json({error:'ไม่อนุญาต'},401,noStore);
    try{body=JSON.parse(verifiedBody)}catch{return json({error:'ข้อมูลไม่ถูกต้อง'},400,noStore)}
    if(body?.action!=='collector_status')return json({error:'ไม่อนุญาต'},401,noStore);
  }
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'ข้อมูลไม่ถูกต้อง'},400,noStore);
  if(body.action==='collector_status'){
    return json({ok:true,quota_breaker:d1QuotaBreakerPublicState(await loadD1QuotaBreakerState(ctx.env,{fresh:true}))},200,noStore);
  }
  if(!bearerAuthorized)return json({error:'ไม่อนุญาต'},401,noStore);
  try{
    if(body.action==='claim'){
      const claim=await claimD1QuotaMonitor(ctx.env,{owner:body.owner,interval:body.interval});
      return json({ok:true,...claim},claim.busy?202:200,noStore);
    }
    if(!['sample','error'].includes(body.action))return json({error:'คำสั่งไม่ถูกต้อง'},400,noStore);
    if(!/^[A-Za-z0-9:_-]{16,100}$/.test(String(body.lease_token||'')))return json({error:'D1_QUOTA_LEASE_TOKEN_REQUIRED'},409,noStore);
    const state=await updateD1QuotaBreakerState(ctx.env,body.action==='error'?{status:'error',error:body.error,reported_at:body.reported_at,configured:body.configured}:{status:'ok',sample_day:body.sample_day,sampled_at:body.sampled_at,reported_at:body.reported_at,rows_read:body.rows_read,rows_written:body.rows_written,read_limit:body.read_limit,write_limit:body.write_limit},{leaseToken:String(body.lease_token||'')});
    return json({ok:true,updated:state.updated,quota_breaker:d1QuotaBreakerPublicState(state)},200,noStore);
  }catch(error){
    const code=String(error?.message||'D1_QUOTA_BREAKER_FAILED');
    return json({error:code,code},code==='D1_QUOTA_LEASE_NOT_OWNED'?409:code.includes('INVALID')||code.includes('FUTURE')?400:503,noStore);
  }
}
