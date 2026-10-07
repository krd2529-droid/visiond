import {json,requireUser,sha256} from '../../../../_lib.js';
import {ensureDatabase} from '../../../../_schema.js';
import {renewRemoteVpage,resumeRenewedVpage,validVpageIdempotencyKey,VpageRemoteError} from '../../../../_vpage-provisioning.js';

const headers={'cache-control':'private, no-store'};
const pageIdPattern=/^vpl_[a-f0-9]{32}$/;
const view=row=>({id:row.id,vpage_id:row.vpage_id,domain_id:row.domain_id,slug:row.slug,display_name:row.display_name,status:row.status,lifecycle_status:row.status==='active'&&row.expires_at&&new Date(row.expires_at)<=new Date()?'expired':row.status,public_url:row.public_url,created_at:row.remote_created_at||row.created_at,expires_at:row.expires_at,last_error_code:row.last_error_code||null,renewal_state:row.renewal_state||null});
const readPage=(env,userId,id)=>env.DB.prepare("SELECT * FROM vpage_pages WHERE id=? AND user_id=? AND domain_id='dom_smartlinkpage'").bind(id,userId).first();
const readRequest=(env,userId,key)=>env.DB.prepare('SELECT * FROM vpage_renewal_requests WHERE user_id=? AND idempotency_key=?').bind(userId,key).first();
const readPending=(env,userId,pageId)=>env.DB.prepare("SELECT * FROM vpage_renewal_requests INDEXED BY idx_vpage_renewals_owner_page WHERE user_id=? AND page_id=? AND state IN ('held','remote_committed') ORDER BY id DESC LIMIT 1").bind(userId,pageId).first();

async function finalise(ctx,userId,page,renewal){
  const guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;
  try{await ctx.env.DB.batch([
    ctx.env.DB.prepare("INSERT INTO vpage_transition_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_renewal_requests r JOIN vpage_credits c ON c.id=r.credit_id JOIN vpage_pages p ON p.id=r.page_id WHERE r.id=? AND r.user_id=? AND r.page_id=? AND r.state='remote_committed' AND r.remote_status='active' AND datetime(r.remote_expires_at)>CURRENT_TIMESTAMP AND c.status='available' AND p.user_id=r.user_id AND p.status IN ('active','suspended')) THEN ? ELSE NULL END)").bind(renewal.id,userId,page.id,guard),
    ctx.env.DB.prepare("UPDATE vpage_pages SET status='active',expires_at=?,last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(renewal.remote_expires_at,page.id,userId),
    ctx.env.DB.prepare("UPDATE vpage_credits SET status='consumed',consumed_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='available'").bind(renewal.credit_id,userId),
    ctx.env.DB.prepare("UPDATE vpage_renewal_requests SET state='committed',last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND state='remote_committed'").bind(renewal.id,userId),
    ctx.env.DB.prepare('DELETE FROM vpage_transition_guards WHERE token=?').bind(guard)
  ])}catch{
    const raced=await readRequest(ctx.env,userId,renewal.idempotency_key);
    if(raced?.state==='committed'){const current=await readPage(ctx.env,userId,page.id);return json({item:view(current),replayed:true},200,headers)}
    return json({item:{...view(page),renewal_state:'repair_required'},error:'ต่ออายุที่ Vpage แล้ว แต่ VisionD ต้องตรวจสอบผลอีกครั้ง เครดิตยังไม่ถูกตัดซ้ำ',code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},202,headers)
  }
  const current=await readPage(ctx.env,userId,page.id);return json({item:view(current),replayed:false},200,headers);
}

async function reconcile(ctx,userId,page,renewal){
  if(renewal.state==='committed')return json({item:view(page),replayed:true},200,headers);
  if(renewal.state==='released')return json({error:'คำขอต่ออายุเดิมสิ้นสุดแล้ว กรุณาลองใหม่',code:renewal.last_error_code||'VPAGE_RENEWAL_FAILED'},409,headers);
  if(renewal.state==='remote_committed'){
    if(renewal.remote_status==='active')return finalise(ctx,userId,page,renewal);
    if(renewal.remote_status!=='suspended'||!renewal.remote_expires_at)return json({item:{...view(page),renewal_state:'repair_required'},error:'ผลต่ออายุต้องตรวจสอบซ้ำ เครดิตยังถูกพักไว้',code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},202,headers);
    let resumed;
    try{resumed=await resumeRenewedVpage(ctx.env,{userId,pageId:page.vpage_id,key:renewal.idempotency_key,expectedExpiry:renewal.remote_expires_at})}
    catch(error){const code=error instanceof VpageRemoteError?error.code:'VPAGE_RENEWAL_RESUME_UNCERTAIN';await ctx.env.DB.prepare('UPDATE vpage_renewal_requests SET last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND state=\'remote_committed\'').bind(code,renewal.id,userId).run();return json({item:{...view(page),renewal_state:'repair_required'},error:'ต่ออายุแล้ว แต่หน้ายังระงับอยู่ ระบบจะใช้ผลเดิมเพื่อตรวจสอบอีกครั้ง',code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},202,headers)}
    const item=resumed?.item;
    if(!item||item.id!==page.vpage_id||item.status!=='active'||!item.expires_at||new Date(item.expires_at).getTime()!==new Date(renewal.remote_expires_at).getTime())return json({item:{...view(page),renewal_state:'repair_required'},error:'ผลเปิดใช้หลังต่ออายุต้องตรวจสอบซ้ำ เครดิตยังถูกพักไว้',code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},202,headers);
    await ctx.env.DB.prepare("UPDATE vpage_renewal_requests SET remote_status='active',last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND state='remote_committed' AND remote_status='suspended'").bind(renewal.id,userId).run();renewal=await readRequest(ctx.env,userId,renewal.idempotency_key);return finalise(ctx,userId,page,renewal);
  }
  let remote;
  try{remote=await renewRemoteVpage(ctx.env,{userId,pageId:page.vpage_id,key:renewal.idempotency_key})}
  catch(error){
    const known=error instanceof VpageRemoteError,ambiguous=!known||error.ambiguous,code=known?error.code:'VPAGE_REMOTE_UNCERTAIN';
    const partial=known?error.partial?.item:null,partialConfirmed=partial?.id===page.vpage_id&&partial.status==='suspended'&&partial.expires_at&&new Date(partial.expires_at)>new Date();
    if(partialConfirmed){try{await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE vpage_renewal_requests SET state='remote_committed',remote_status='suspended',remote_expires_at=?,last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND state='held'").bind(partial.expires_at,code,renewal.id,userId),
      ctx.env.DB.prepare("UPDATE vpage_pages SET status='suspended',expires_at=?,last_error_code='VPAGE_RENEWAL_REPAIR_REQUIRED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND EXISTS(SELECT 1 FROM vpage_renewal_requests WHERE id=? AND user_id=? AND state='remote_committed' AND remote_status='suspended')").bind(partial.expires_at,page.id,userId,renewal.id,userId)
    ])}catch{}const current=await readPage(ctx.env,userId,page.id);return json({item:{...view(current||page),renewal_state:'repair_required'},error:'ต่ออายุแล้ว แต่หน้ายังระงับอยู่ เครดิตถูกพักไว้จนกว่าจะเปิดใช้สำเร็จ',code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},202,headers)}
    await ctx.env.DB.prepare(`UPDATE vpage_renewal_requests SET state=?,last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND state='held'`).bind(ambiguous?'held':'released',code,renewal.id,userId).run();
    if(ambiguous)return json({item:{...view(page),renewal_state:'repair_required'},error:'ยังยืนยันผลการต่ออายุไม่ได้ เครดิตถูกพักไว้และสามารถตรวจสอบซ้ำได้',code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},202,headers);
    return json({error:known?error.message:'ต่ออายุ Vpage ไม่สำเร็จ',code},known?error.status:502,headers);
  }
  const item=remote?.item;
  if(!item?.id||item.id!==page.vpage_id||item.status!=='active'||!item.expires_at||new Date(item.expires_at)<=new Date()){
    await ctx.env.DB.prepare("UPDATE vpage_renewal_requests SET last_error_code='VPAGE_REMOTE_RESPONSE_INVALID',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND state='held'").bind(renewal.id,userId).run();
    return json({item:{...view(page),renewal_state:'repair_required'},error:'ผลต่ออายุต้องตรวจสอบซ้ำ เครดิตยังไม่ถูกตัด',code:'VPAGE_RENEWAL_REPAIR_REQUIRED'},202,headers);
  }
  await ctx.env.DB.prepare("UPDATE vpage_renewal_requests SET state='remote_committed',remote_status='active',remote_expires_at=?,last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND state='held'").bind(item.expires_at,renewal.id,userId).run();
  renewal=await readRequest(ctx.env,userId,renewal.idempotency_key);return finalise(ctx,userId,page,renewal);
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const id=String(ctx.params?.id||'');if(!pageIdPattern.test(id))return json({error:'ไม่พบเซลเพจ'},404,headers);
  let raw='';try{raw=await ctx.request.text()}catch{return json({error:'อ่านข้อมูลไม่สำเร็จ',code:'VPAGE_INPUT_INVALID'},400,headers)}if(raw.trim())return json({error:'คำขอต่ออายุไม่รับข้อมูลจากเบราว์เซอร์',code:'VPAGE_RENEWAL_BODY_FORBIDDEN'},400,headers);
  const page=await readPage(ctx.env,auth.user.id,id);if(!page?.vpage_id||!['active','suspended'].includes(page.status))return json({error:'ไม่พบเซลเพจ'},404,headers);
  const suppliedKey=String(ctx.request.headers.get('idempotency-key')||'').trim();let renewal;
  if(suppliedKey){
    if(!validVpageIdempotencyKey(suppliedKey))return json({error:'Idempotency-Key ไม่ถูกต้อง',code:'VPAGE_IDEMPOTENCY_REQUIRED'},400,headers);
    renewal=await readRequest(ctx.env,auth.user.id,suppliedKey);
    if(renewal&&renewal.page_id!==id)return json({error:'Idempotency-Key นี้ถูกใช้กับหน้าอื่นแล้ว',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409,headers);
  }else renewal=await readPending(ctx.env,auth.user.id,id);
  if(!renewal&&!suppliedKey)return json({error:'ไม่พบคำขอต่ออายุที่ต้องตรวจสอบ',code:'VPAGE_RENEWAL_NOT_PENDING'},409,headers);
  if(!renewal){
    const due=page.status==='suspended'||!page.expires_at||new Date(page.expires_at)<=new Date();if(!due)return json({error:'หน้านี้ยังไม่ถึงกำหนดต่ออายุ',code:'VPAGE_RENEWAL_NOT_DUE'},409,headers);
    const credit=await ctx.env.DB.prepare("SELECT c.id FROM vpage_credits c INDEXED BY idx_vpage_credits_owner_status WHERE c.user_id=? AND c.status='available' AND NOT EXISTS(SELECT 1 FROM vpage_credit_claims x WHERE x.credit_id=c.id AND x.state IN ('held','committed')) AND NOT EXISTS(SELECT 1 FROM vpage_renewal_requests r WHERE r.credit_id=c.id AND r.state IN ('held','remote_committed')) ORDER BY c.id LIMIT 1").bind(auth.user.id).first();
    if(!credit)return json({error:'ไม่มีเครดิต Vpage ที่พร้อมใช้สำหรับต่ออายุ',code:'VPAGE_CREDIT_REQUIRED'},409,headers);
    const requestHash=await sha256(JSON.stringify({page_id:id,user_id:Number(auth.user.id),action:'renew'})),requestId=`vpr_${crypto.randomUUID().replaceAll('-','')}`,guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;
    try{await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO vpage_transition_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_pages p JOIN vpage_credits c ON c.id=? AND c.user_id=p.user_id WHERE p.id=? AND p.user_id=? AND p.status IN ('active','suspended') AND (p.status='suspended' OR p.expires_at IS NULL OR datetime(p.expires_at)<=CURRENT_TIMESTAMP) AND c.status='available' AND NOT EXISTS(SELECT 1 FROM vpage_credit_claims x WHERE x.credit_id=c.id AND x.state IN ('held','committed')) AND NOT EXISTS(SELECT 1 FROM vpage_renewal_requests r WHERE (r.credit_id=c.id OR r.page_id=p.id) AND r.state IN ('held','remote_committed'))) THEN ? ELSE NULL END)").bind(credit.id,id,auth.user.id,guard),
      ctx.env.DB.prepare("INSERT INTO vpage_renewal_requests(id,user_id,page_id,credit_id,idempotency_key,request_hash,state) VALUES(?,?,?,?,?,?,'held')").bind(requestId,auth.user.id,id,credit.id,suppliedKey,requestHash),
      ctx.env.DB.prepare('DELETE FROM vpage_transition_guards WHERE token=?').bind(guard)
    ])}catch{
      renewal=await readRequest(ctx.env,auth.user.id,suppliedKey)||await readPending(ctx.env,auth.user.id,id);
      if(!renewal){const current=await readPage(ctx.env,auth.user.id,id);if(current?.status==='active'&&current.expires_at&&new Date(current.expires_at)>new Date())return json({item:view(current),replayed:true},200,headers);return json({error:'เครดิตหรือหน้านี้กำลังถูกใช้งาน',code:'VPAGE_RENEWAL_CONFLICT'},409,headers)}
    }
    renewal=renewal||await readRequest(ctx.env,auth.user.id,suppliedKey);
  }
  return reconcile(ctx,auth.user.id,page,renewal);
}
