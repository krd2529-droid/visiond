import {json,requireBoss} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {cleanId,idempotencyKey} from '../../../../_partner_sync.js';
import {ensurePartnerSandboxReady as ensurePartnerSandboxSchema,maskedExternalId,SANDBOX_SCENARIOS,sandboxHash,sandboxPayload} from '../../../../_partner_sandbox.js';
const headers={'cache-control':'private, no-store'};
async function auth(ctx){
  await ensureDatabase(ctx.env); await ensurePartnerSandboxSchema(ctx.env);
  const value=await requireBoss(ctx); if(value.error)return{error:value.error};
  const website=await ctx.env.DB.prepare('SELECT id,name,status,scopes,client_id,secret_last4 FROM partner_websites WHERE id=?').bind(ctx.params.id).first();
  return website?{user:value.user,website}:{error:json({error:'ไม่พบเว็บไซต์คู่ค้า'},404,headers)};
}
const safeRun=row=>({id:row.id,scenario:row.scenario,external_id_masked:maskedExternalId(row.external_id),idempotency_key_masked:maskedExternalId(row.idempotency_key),request:JSON.parse(row.request_summary),response_status:Number(row.response_status),response:JSON.parse(row.response_summary),replayed:Boolean(row.replayed),created_at:row.created_at});
export async function onRequestGet(ctx){
  const a=await auth(ctx); if(a.error)return a.error;
  const rows=(await ctx.env.DB.prepare('SELECT * FROM partner_sandbox_runs WHERE website_id=? ORDER BY created_at DESC LIMIT 50').bind(a.website.id).all()).results||[];
  return json({website:{id:a.website.id,name:a.website.name,status:a.website.status,credential_display:`${maskedExternalId(a.website.client_id)} / ••••${a.website.secret_last4}`},items:rows.map(safeRun)},200,headers);
}
export async function onRequestPost(ctx){
  const a=await auth(ctx); if(a.error)return a.error;
  const body=await ctx.request.json().catch(()=>({})),scenario=String(body.scenario||''),externalId=cleanId(body.external_id),key=idempotencyKey(new Request(ctx.request.url,{headers:{'idempotency-key':String(body.idempotency_key||'')}}));
  if(!SANDBOX_SCENARIOS.includes(scenario)||!externalId||!key)return json({error:'กรุณาเลือกเหตุการณ์และกรอก External ID กับ Idempotency Key ให้ถูกต้อง'},400,headers);
  const scopes=JSON.parse(a.website.scopes||'[]'),required=scenario==='customer'?'customers:write':'orders:write';
  if(!scopes.includes(required))return json({error:'SANDBOX_SCOPE_MISSING',required_scope:required},403,headers);
  const payload=sandboxPayload({scenario,externalId}),hash=await sandboxHash({scenario,externalId}),prior=await ctx.env.DB.prepare('SELECT * FROM partner_sandbox_runs WHERE website_id=? AND idempotency_key=?').bind(a.website.id,key).first();
  if(prior){if(prior.request_hash!==hash)return json({error:'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD'},409,headers);return json({ok:true,replayed:true,run:safeRun({...prior,replayed:1})},Number(prior.response_status),headers)}
  const requestSummary={scenario,external_id:maskedExternalId(externalId),idempotency_key:maskedExternalId(key),credential:'[REDACTED]',personal_data:'[MASKED]',status:payload.status,payment_status:payload.payment_status||null,currency:payload.currency||null,total:payload.total??null};
  const responseSummary={ok:true,sandbox:true,validated:{external_id:true,idempotency_key:true,scope:required,sensitive_data_stored:false},message:'ตรวจสอบข้อมูลจำลองสำเร็จ ไม่เขียนข้อมูล Production'},status=200,id=`psr_${crypto.randomUUID().replaceAll('-','')}`;
  await ctx.env.DB.prepare('INSERT INTO partner_sandbox_runs(id,website_id,scenario,external_id,idempotency_key,request_hash,request_summary,response_status,response_summary,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,a.website.id,scenario,externalId,key,hash,JSON.stringify(requestSummary),status,JSON.stringify(responseSummary),a.user.id).run();
  const row=await ctx.env.DB.prepare('SELECT * FROM partner_sandbox_runs WHERE id=?').bind(id).first();
  return json({ok:true,replayed:false,run:safeRun(row)},status,headers);
}
