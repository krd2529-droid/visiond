import{json}from'../../_lib.js';
import{ensureDatabase}from'../../_schema.js';
import{ensureTikTokAnalyzerSchema}from'../../_tiktok_analyzer.js';
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
const hex=bytes=>[...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
const safeEqual=(a,b)=>a.length===b.length&&[...a].reduce((same,char,index)=>same&(char===b[index]?1:0),1)===1;
export async function verifyCollectorRequest(request,secret,now=Date.now()){
  const timestamp=clean(request.headers.get('x-visiond-timestamp'),20),signature=clean(request.headers.get('x-visiond-signature'),128).toLowerCase();
  if(!secret||!/^\d{10,13}$/.test(timestamp)||!/^[a-f0-9]{64}$/.test(signature))return null;
  const epoch=Number(timestamp.length===10?`${timestamp}000`:timestamp);if(!Number.isFinite(epoch)||Math.abs(now-epoch)>300000)return null;
  const body=await request.text(),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const expected=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${timestamp}.${body}`)));
  return safeEqual(expected,signature)?body:null;
}
export async function onRequestPost(ctx){
  const bodyText=await verifyCollectorRequest(ctx.request,ctx.env.TIKTOK_COMMISSION_COLLECTOR_SECRET);if(bodyText===null)return json({error:'unauthorized'},401);
  await ensureDatabase(ctx.env);await ensureTikTokAnalyzerSchema(ctx.env);let body;try{body=JSON.parse(bodyText)}catch{return json({error:'invalid_json'},400)}
  const connectionId=clean(body.connection_id,100),rows=Array.isArray(body.rows)?body.rows.slice(0,366):[];
  if(!connectionId||!await ctx.env.DB.prepare("SELECT id FROM tiktok_shop_creator_connections WHERE id=? AND status='active'").bind(connectionId).first())return json({error:'connection_not_found'},404);
  if(!rows.length)return json({error:'rows_required'},400);const capturedAt=Number.isFinite(Date.parse(body.captured_at))?new Date(body.captured_at).toISOString():new Date().toISOString(),statements=[];
  for(const row of rows){const day=clean(row.day,10),currency=clean(row.currency||'THB',8).toUpperCase(),amount=Number(row.amount);if(!DAY.test(day)||!/^[A-Z]{3,8}$/.test(currency)||!Number.isFinite(amount)||amount<0)return json({error:'invalid_row'},400);statements.push(ctx.env.DB.prepare(`INSERT INTO tiktok_commission_center_snapshots(connection_id,commission_day,currency,amount,status,captured_at) VALUES(?,?,?,?,?,?) ON CONFLICT(connection_id,commission_day,currency) DO UPDATE SET amount=excluded.amount,status=excluded.status,captured_at=excluded.captured_at`).bind(connectionId,day,currency,Number(amount.toFixed(2)),clean(row.status||'actual',30),capturedAt))}
  statements.push(ctx.env.DB.prepare("UPDATE tiktok_shop_creator_connections SET collector_status='ready',collector_last_attempt_at=?,collector_last_success_at=?,collector_last_error='',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(capturedAt,capturedAt,connectionId));
  await ctx.env.DB.batch(statements);return json({ok:true,stored:statements.length-1},200,{'cache-control':'no-store'});
}
