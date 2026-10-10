import {json,requireBoss} from '../../../../../_lib.js';
import {ensureDatabase} from '../../../../../_schema.js';
import {ensureVpageCompensationSchema} from '../../../../../_vpage-compensation-schema.js';
import {compensateRemoteVpage,validVpageIdempotencyKey,VpageRemoteError} from '../../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
const readReceipt=(env,key)=>env.DB.prepare('SELECT * FROM vpage_compensation_requests WHERE idempotency_key=?').bind(key).first();
const readPage=(env,id)=>env.DB.prepare("SELECT id,user_id,vpage_id,display_name,slug,public_url,status,expires_at FROM vpage_pages WHERE id=? AND domain_id='dom_smartlinkpage'").bind(id).first();
const view=(page,receipt)=>({id:page.id,user_id:page.user_id,display_name:page.display_name,slug:page.slug,public_url:page.public_url,status:page.status,expires_at:receipt?.after_expires_at||page.expires_at,compensation_state:receipt?.state||null});

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireBoss(ctx);if(auth.error)return auth.error;await ensureVpageCompensationSchema(ctx.env);
  const id=String(ctx.params.id||''),key=String(ctx.request.headers.get('idempotency-key')||'').trim(),body=await ctx.request.json().catch(()=>null),days=body?.days;
  if(!/^vpl_[a-f0-9]{32}$/.test(id)||!validVpageIdempotencyKey(key)||!Number.isInteger(days)||days<1||days>365)return json({error:'ข้อมูลชดเชยวัน Vpage ไม่ถูกต้อง'},400,headers);
  let receipt=await readReceipt(ctx.env,key),page=await readPage(ctx.env,id);
  if(receipt&&(receipt.page_id!==id||receipt.actor_id!==auth.user.id||receipt.days!==days))return json({error:'คีย์คำขอถูกใช้กับข้อมูลอื่นแล้ว',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409,headers);
  if(!page||!page.vpage_id||page.status!=='active'&&!receipt)return json({error:'ไม่พบเซลเพจที่ชดเชยวันได้'},404,headers);
  if(receipt?.state==='committed')return json({item:view(page,receipt),before_expires_at:receipt.before_expires_at,replayed:true},200,headers);
  if(receipt?.state==='released')return json({error:'คำขอนี้สิ้นสุดแล้ว กรุณาเริ่มคำขอใหม่',code:receipt.last_error_code||'VPAGE_COMPENSATION_FAILED'},409,headers);
  if(!receipt){
    if(!page.expires_at||!Number.isFinite(Date.parse(page.expires_at)))return json({error:'วันหมดอายุเดิมไม่ถูกต้อง',code:'VPAGE_EXPIRY_INVALID'},409,headers);
    const requestId=`vpc_${crypto.randomUUID().replaceAll('-','')}`,guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;
    try{await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO vpage_transition_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_pages p WHERE p.id=? AND p.user_id=? AND p.vpage_id=? AND p.status='active' AND p.expires_at=? AND NOT EXISTS(SELECT 1 FROM vpage_renewal_requests r WHERE r.page_id=p.id AND r.state IN ('held','remote_committed')) AND NOT EXISTS(SELECT 1 FROM vpage_compensation_requests x WHERE x.page_id=p.id AND x.state='held')) THEN ? ELSE NULL END)").bind(id,page.user_id,page.vpage_id,page.expires_at,guard),
      ctx.env.DB.prepare("INSERT INTO vpage_compensation_requests(id,page_id,user_id,actor_id,days,idempotency_key,state,before_expires_at) VALUES(?,?,?,?,?,?,'held',?)").bind(requestId,id,page.user_id,auth.user.id,days,key,page.expires_at),
      ctx.env.DB.prepare('DELETE FROM vpage_transition_guards WHERE token=?').bind(guard)
    ])}catch{receipt=await readReceipt(ctx.env,key);if(!receipt)return json({error:'หน้านี้กำลังต่ออายุหรือชดเชยวันอยู่',code:'VPAGE_COMPENSATION_CONFLICT'},409,headers)}
    receipt=receipt||await readReceipt(ctx.env,key);
  }
  if(!receipt||receipt.page_id!==id||receipt.actor_id!==auth.user.id||receipt.days!==days)return json({error:'คีย์คำขอถูกใช้กับข้อมูลอื่นแล้ว',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409,headers);
  let remote;
  try{remote=await compensateRemoteVpage(ctx.env,{userId:receipt.user_id,actorId:receipt.actor_id,pageId:page.vpage_id,key,days,expectedExpiry:receipt.before_expires_at})}
  catch(error){const known=error instanceof VpageRemoteError,code=known?error.code:'VPAGE_REMOTE_UNCERTAIN',ambiguous=!known||error.ambiguous||error.status>=500||code==='VPAGE_IDEMPOTENCY_IN_PROGRESS'||code==='VPAGE_COMPENSATION_CONFLICT';
    if(!ambiguous)await ctx.env.DB.prepare("UPDATE vpage_compensation_requests SET state='released',last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='held'").bind(code,receipt.id).run();
    return json({item:view(page,receipt),error:ambiguous?'ยังยืนยันผลชดเชยวันไม่ได้ กรุณากดซ้ำเพื่อใช้คำขอเดิม':error.message,code:ambiguous?'VPAGE_COMPENSATION_REPAIR_REQUIRED':code},ambiguous?202:error.status,headers);
  }
  const after=remote?.item?.expires_at,before=remote?.before_expires_at;
  if(remote?.item?.id!==page.vpage_id||before!==receipt.before_expires_at||typeof after!=='string'||!Number.isFinite(Date.parse(after))||Date.parse(after)<=Date.parse(before))return json({item:view(page,receipt),error:'ผลจาก Vpage ต้องตรวจสอบซ้ำ กรุณากดซ้ำ',code:'VPAGE_COMPENSATION_REPAIR_REQUIRED'},202,headers);
  const guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;
  try{await ctx.env.DB.batch([
    ctx.env.DB.prepare("INSERT INTO vpage_transition_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_compensation_requests x JOIN vpage_pages p ON p.id=x.page_id WHERE x.id=? AND x.state='held' AND p.id=? AND p.user_id=x.user_id AND p.vpage_id=? AND p.status='active' AND p.expires_at=x.before_expires_at) THEN ? ELSE NULL END)").bind(receipt.id,id,page.vpage_id,guard),
    ctx.env.DB.prepare("UPDATE vpage_pages SET expires_at=?,last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND expires_at=?").bind(after,id,receipt.user_id,receipt.before_expires_at),
    ctx.env.DB.prepare("UPDATE vpage_compensation_requests SET state='committed',after_expires_at=?,last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND state='held'").bind(after,receipt.id),
    ctx.env.DB.prepare('DELETE FROM vpage_transition_guards WHERE token=?').bind(guard)
  ])}catch{return json({item:view(page,receipt),error:'Vpage ต่อวันแล้ว แต่ VisionD ต้องยืนยันผล กรุณากดซ้ำ',code:'VPAGE_COMPENSATION_REPAIR_REQUIRED'},202,headers)}
  page=await readPage(ctx.env,id);return json({item:view(page),before_expires_at:before,replayed:Boolean(remote.replayed)},200,headers);
}
