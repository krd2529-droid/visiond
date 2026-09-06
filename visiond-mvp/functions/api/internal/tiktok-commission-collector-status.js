import{json}from'../../_lib.js';
import{ensureDatabase}from'../../_schema.js';
import{ensureTikTokAnalyzerSchema}from'../../_tiktok_analyzer.js';
import{verifyCollectorRequest}from'./tiktok-commission-snapshots.js';
const allowed=new Set(['not_connected','connecting','ready','reconnect_required','error']),clean=(value,max=300)=>String(value??'').trim().slice(0,max);
export async function onRequestPost(ctx){
  const text=await verifyCollectorRequest(ctx.request,ctx.env.TIKTOK_COMMISSION_COLLECTOR_SECRET);if(text===null)return json({error:'unauthorized'},401);
  let body;try{body=JSON.parse(text)}catch{return json({error:'invalid_json'},400)}
  const connectionId=clean(body.connection_id,100),status=clean(body.status,40),error=clean(body.error,300),at=Number.isFinite(Date.parse(body.at))?new Date(body.at).toISOString():new Date().toISOString();
  if(!connectionId||!allowed.has(status))return json({error:'invalid_status'},400);
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);
  const result=await ctx.env.DB.prepare(`UPDATE tiktok_shop_creator_connections SET collector_status=?,collector_last_attempt_at=?,collector_last_success_at=CASE WHEN ?='ready' THEN ? ELSE collector_last_success_at END,collector_last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='active'`).bind(status,at,status,at,status==='ready'?'':error,connectionId).run();
  return Number(result.meta?.changes)===1?json({ok:true},200,{'cache-control':'no-store'}):json({error:'connection_not_found'},404);
}
