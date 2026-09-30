import {json,requireAdmin,sha256} from '../../../_lib.js';

const privateHeaders={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
const changes=result=>Number(result?.meta?.changes||0);
const after=seconds=>new Date(Date.now()+seconds*1000).toISOString();

async function cleanupDeletedAsset(env,receipt){
  const job=await env.DB.prepare('SELECT id,object_key,status,attempts,next_attempt_at FROM vsport_object_cleanup_jobs WHERE id=? AND owner_id=? AND project_id=? AND object_key=?').bind(receipt.cleanup_job_id,receipt.owner_id,receipt.project_id,receipt.object_key).first();
  if(!job)return{pending:true,processed:false};
  if(job.status==='done')return{pending:false,processed:false};
  if(!env.FILES||!['pending','error'].includes(job.status))return{pending:true,processed:false};
  const now=new Date().toISOString(),claimed=await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='pending',attempts=attempts+1,next_attempt_at=?,last_error_code='',updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND project_id=? AND object_key=? AND status=? AND attempts=? AND (next_attempt_at IS NULL OR julianday(next_attempt_at)<=julianday(?))").bind(after(120),job.id,receipt.owner_id,receipt.project_id,receipt.object_key,job.status,Number(job.attempts||0),now).run();
  if(!changes(claimed))return{pending:true,processed:false};
  let errorCode='';
  try{await env.FILES.head(job.object_key);await env.FILES.delete(job.object_key);if(await env.FILES.head(job.object_key))errorCode='R2_OBJECT_REMAINS'}catch{errorCode='R2_CLEANUP_FAILED'}
  if(errorCode){const delay=Math.min(900,30*2**Math.min(5,Number(job.attempts||0)));await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='error',next_attempt_at=?,last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND object_key=? AND status='pending'").bind(after(delay),errorCode,job.id,receipt.owner_id,receipt.object_key).run();return{pending:true,processed:true}}
  await env.DB.prepare("UPDATE vsport_object_cleanup_jobs SET status='done',next_attempt_at=NULL,last_error_code='',completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND object_key=? AND status='pending'").bind(job.id,receipt.owner_id,receipt.object_key).run();
  return{pending:false,processed:true};
}

export async function onRequestDelete(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const assetId=Number(ctx.params.id),projectId=Number(new URL(ctx.request.url).searchParams.get('project_id')),key=String(ctx.request.headers.get('Idempotency-Key')||'').trim();
  if(!Number.isSafeInteger(assetId)||assetId<1||!Number.isSafeInteger(projectId)||projectId<1||!/^[\x21-\x7e]{8,128}$/.test(key))return json({error:'รหัสรูป โปรเจกต์ หรือ Idempotency-Key ไม่ถูกต้อง'},400,privateHeaders);
  const requestHash=await sha256(JSON.stringify({project_id:projectId,asset_id:assetId}));
  const receiptFields='owner_id,project_id,asset_id,candidate_id,object_key,cleanup_job_id,idempotency_key,request_hash';
  let receipt=await ctx.env.DB.prepare(`SELECT ${receiptFields} FROM vsport_asset_deletions WHERE owner_id=? AND idempotency_key=?`).bind(auth.user.id,key).first(),replayed=Boolean(receipt);
  if(receipt&&(Number(receipt.project_id)!==projectId||Number(receipt.asset_id)!==assetId||receipt.request_hash!==requestHash))return json({error:'Idempotency-Key นี้ถูกใช้กับรูปอื่นแล้ว'},409,privateHeaders);
  if(!receipt){
    const prior=await ctx.env.DB.prepare(`SELECT ${receiptFields} FROM vsport_asset_deletions WHERE owner_id=? AND asset_id=?`).bind(auth.user.id,assetId).first();
    if(prior)return json({error:'รูปนี้ถูกลบแล้วด้วยคำขออื่น กรุณารีเฟรชรายการรูป'},409,privateHeaders);
    const asset=await ctx.env.DB.prepare('SELECT id FROM vsport_assets WHERE id=? AND owner_id=? AND project_id=?').bind(assetId,auth.user.id,projectId).first();
    if(!asset)return json({error:'ไม่พบรูปนี้ในโปรเจกต์ของคุณ'},404,privateHeaders);
    const jobId=crypto.randomUUID(),now=new Date().toISOString();let result;
    try{result=await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO vsport_asset_deletions(owner_id,project_id,asset_id,candidate_id,object_key,cleanup_job_id,idempotency_key,request_hash) SELECT a.owner_id,a.project_id,a.id,a.candidate_id,a.object_key,?, ?,? FROM vsport_assets a JOIN vsport_projects p ON p.id=a.project_id AND p.owner_id=a.owner_id WHERE a.id=? AND a.owner_id=? AND a.project_id=? AND NOT EXISTS(SELECT 1 FROM vsport_jobs j WHERE j.project_id=a.project_id AND j.status IN ('queued','running')) AND NOT EXISTS(SELECT 1 FROM vsport_image_candidates c WHERE c.project_id=a.project_id AND c.state='ingesting' AND (c.ingest_lease_expires_at IS NULL OR julianday(c.ingest_lease_expires_at)>julianday(?))) AND NOT EXISTS(SELECT 1 FROM vsport_project_deletions d WHERE d.owner_id=a.owner_id AND d.project_id=a.project_id)").bind(jobId,key,requestHash,assetId,auth.user.id,projectId,now),
      ctx.env.DB.prepare("INSERT INTO vsport_object_cleanup_jobs(id,owner_id,project_id,object_key,reason,status,next_attempt_at) SELECT d.cleanup_job_id,d.owner_id,d.project_id,d.object_key,'deleted','pending',? FROM vsport_asset_deletions d WHERE d.owner_id=? AND d.asset_id=? AND d.project_id=? AND d.idempotency_key=? AND d.request_hash=?").bind(now,auth.user.id,assetId,projectId,key,requestHash),
      ctx.env.DB.prepare('UPDATE vsport_projects SET thumbnail_focus_asset_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_id=? AND thumbnail_focus_asset_id=? AND EXISTS(SELECT 1 FROM vsport_asset_deletions WHERE owner_id=? AND asset_id=? AND project_id=? AND idempotency_key=?)').bind(projectId,auth.user.id,assetId,auth.user.id,assetId,projectId,key),
      ctx.env.DB.prepare("UPDATE vsport_image_candidates SET state='candidate',error_message='',updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT candidate_id FROM vsport_asset_deletions WHERE owner_id=? AND asset_id=? AND project_id=? AND idempotency_key=?) AND project_id=? AND state='ready'").bind(auth.user.id,assetId,projectId,key,projectId),
      ctx.env.DB.prepare('DELETE FROM vsport_assets WHERE id=? AND owner_id=? AND project_id=? AND EXISTS(SELECT 1 FROM vsport_asset_deletions d JOIN vsport_object_cleanup_jobs g ON g.id=d.cleanup_job_id AND g.object_key=d.object_key WHERE d.owner_id=? AND d.asset_id=? AND d.project_id=? AND d.idempotency_key=? AND d.request_hash=?)').bind(assetId,auth.user.id,projectId,auth.user.id,assetId,projectId,key,requestHash)
    ])}catch{
      receipt=await ctx.env.DB.prepare(`SELECT ${receiptFields} FROM vsport_asset_deletions WHERE owner_id=? AND idempotency_key=?`).bind(auth.user.id,key).first();
      if(!receipt){const competing=await ctx.env.DB.prepare('SELECT asset_id FROM vsport_asset_deletions WHERE owner_id=? AND asset_id=?').bind(auth.user.id,assetId).first();return competing?json({error:'รูปนี้ถูกลบแล้วด้วยคำขออื่น กรุณารีเฟรชรายการรูป'},409,privateHeaders):json({error:'บันทึกการลบรูปไม่สำเร็จ รูปยังอยู่ กรุณาลองใหม่'},500,privateHeaders)}
      replayed=true;
    }
    if(result&&!changes(result[4])){
      receipt=await ctx.env.DB.prepare(`SELECT ${receiptFields} FROM vsport_asset_deletions WHERE owner_id=? AND idempotency_key=?`).bind(auth.user.id,key).first();
      if(!receipt)return json({error:'รูปกำลังถูกใช้งานหรือโปรเจกต์กำลังทำงาน กรุณารอแล้วลองใหม่'},409,privateHeaders);
      replayed=true;
    }
    if(!receipt)receipt=await ctx.env.DB.prepare(`SELECT ${receiptFields} FROM vsport_asset_deletions WHERE owner_id=? AND idempotency_key=?`).bind(auth.user.id,key).first();
  }
  if(!receipt||Number(receipt.asset_id)!==assetId||Number(receipt.project_id)!==projectId||receipt.request_hash!==requestHash)return json({error:'หลักฐานการลบรูปไม่ตรงกับคำขอ'},409,privateHeaders);
  const cleanup=await cleanupDeletedAsset(ctx.env,receipt);
  return json({ok:true,deleted:true,asset_id:assetId,project_id:projectId,replayed,cleanup_pending:cleanup.pending,cleanup_processed:cleanup.processed},200,privateHeaders);
}

export async function onRequestGet(ctx){
  const auth=await requireAdmin(ctx);if(auth.error)return auth.error;
  const id=Number(ctx.params.id);if(!Number.isInteger(id)||id<1)return json({error:'รหัสรูปไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  const asset=await ctx.env.DB.prepare('SELECT id,object_key,mime_type,file_size FROM vsport_assets WHERE id=? AND owner_id=?').bind(id,auth.user.id).first();if(!asset)return json({error:'ไม่พบรูป vSport'},404,{'cache-control':'private, no-store'});
  const object=await ctx.env.FILES?.get(asset.object_key);if(!object)return json({error:'ไฟล์รูป vSport สูญหาย'},404,{'cache-control':'private, no-store'});
  const headers=new Headers();object.writeHttpMetadata(headers);headers.set('content-type',asset.mime_type);headers.set('content-length',String(asset.file_size));headers.set('cache-control','private, no-store');headers.set('content-disposition',`inline; filename="vsport-${asset.id}"`);headers.set('x-content-type-options','nosniff');return new Response(object.body,{headers});
}
