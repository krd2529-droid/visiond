import {json,requireUser,sha256} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';
import {createRemoteVpage,invalidateVpageAvailability,listVpageDomains,validVpageDisplayName,validVpageIdempotencyKey,validVpageSlug,VpageRemoteError} from '../../../_vpage-provisioning.js';

const responseHeaders={'cache-control':'private, no-store'};
const view=row=>({id:row.id,vpage_id:row.vpage_id,domain_id:row.domain_id,slug:row.slug,display_name:row.display_name,status:row.status,public_url:row.public_url,created_at:row.remote_created_at||row.created_at,expires_at:row.expires_at,last_error_code:row.last_error_code||null});
const pageParams=request=>{const url=new URL(request.url),rawLimit=url.searchParams.get('limit'),rawCursor=url.searchParams.get('cursor'),limit=Math.min(24,Math.max(1,Number.parseInt(rawLimit,10)||24));if(rawCursor!==null&&!/^[A-Za-z0-9_-]{8,80}$/.test(rawCursor))return {error:true};return{limit,cursor:rawCursor}};
const existingPage=(env,userId,key)=>env.DB.prepare('SELECT * FROM vpage_pages WHERE user_id=? AND create_idempotency_key=?').bind(userId,key).first();

export async function reconcileVpageProvisioning(ctx,userId,local,{domain=null,successStatus=200}={}){
  if(local?.status==='active')return json({item:view(local),replayed:true},200,responseHeaders);
  if(!local||!['provisioning','repair_required'].includes(local.status))return json({error:'คำขอนี้ไม่อยู่ในสถานะที่ตรวจสอบซ้ำได้',code:'VPAGE_REPAIR_NOT_ALLOWED'},409,responseHeaders);
  if(!domain){try{domain=(await listVpageDomains(ctx.env)).find(item=>item.id===local.domain_id)}catch(error){const known=error instanceof VpageRemoteError;return json({error:known?error.message:'โหลดโดเมนไม่สำเร็จ',code:known?error.code:'VPAGE_DOMAIN_LOAD_FAILED'},known?error.status:502,responseHeaders)}}
  if(!domain)return json({error:'โดเมนนี้ยังไม่เปิดใช้งาน',code:'VPAGE_DOMAIN_UNAVAILABLE'},409,responseHeaders);
  let remote;
  try{remote=await createRemoteVpage(ctx.env,userId,local.create_idempotency_key,{domain_id:local.domain_id,slug:local.slug,display_name:local.display_name})}
  catch(error){
    const known=error instanceof VpageRemoteError,ambiguous=!known||error.ambiguous,status=ambiguous?'repair_required':'failed',code=known?error.code:'VPAGE_REMOTE_UNCERTAIN';
    const statements=[ctx.env.DB.prepare('UPDATE vpage_pages SET status=?,last_error_code=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?').bind(status,code,local.id,userId)];
    if(!ambiguous)statements.push(ctx.env.DB.prepare("UPDATE vpage_credit_claims SET state='released',updated_at=CURRENT_TIMESTAMP WHERE page_id=? AND state='held'").bind(local.id));
    await ctx.env.DB.batch(statements);
    if(ambiguous)return json({item:{...view(local),status,last_error_code:code},error:'ยังไม่ตัดเครดิต ระบบจะใช้ข้อมูลเดิมตรวจสอบผลอีกครั้ง',code:'VPAGE_REPAIR_REQUIRED'},202,responseHeaders);
    return json({error:known?error.message:'สร้าง Vpage ไม่สำเร็จ',code},known?error.status:502,responseHeaders);
  }
  const item=remote?.item,expectedUrl=`https://${domain.hostname}/${local.slug}`;
  if(!item?.id||item.domain_id!==local.domain_id||item.slug!==local.slug||item.public_url!==expectedUrl){
    await ctx.env.DB.prepare("UPDATE vpage_pages SET status='repair_required',last_error_code='VPAGE_REMOTE_RESPONSE_INVALID',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(local.id,userId).run();
    return json({error:'ผลตอบกลับต้องตรวจสอบก่อน ยังไม่ตัดเครดิต',code:'VPAGE_REPAIR_REQUIRED'},202,responseHeaders);
  }
  const guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;
  try{await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO vpage_transition_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_pages p JOIN vpage_credits c ON c.id=p.credit_id JOIN vpage_credit_claims x ON x.page_id=p.id AND x.credit_id=c.id WHERE p.id=? AND p.user_id=? AND p.status IN ('provisioning','repair_required') AND c.status='available' AND x.state='held') THEN ? ELSE NULL END)").bind(local.id,userId,guard),
      ctx.env.DB.prepare("UPDATE vpage_pages SET vpage_id=?,status='active',public_url=?,remote_created_at=?,expires_at=?,last_error_code=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status IN ('provisioning','repair_required')").bind(item.id,item.public_url,item.created_at,item.expires_at,local.id,userId),
      ctx.env.DB.prepare("UPDATE vpage_credits SET status='consumed',consumed_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='available'").bind(local.credit_id,userId),
      ctx.env.DB.prepare("UPDATE vpage_credit_claims SET state='committed',updated_at=CURRENT_TIMESTAMP WHERE page_id=? AND credit_id=? AND state='held'").bind(local.id,local.credit_id),
      ctx.env.DB.prepare('DELETE FROM vpage_transition_guards WHERE token=?').bind(guard)
    ])
  }catch{
    const raced=await existingPage(ctx.env,userId,local.create_idempotency_key);if(raced?.status==='active')return json({item:view(raced),replayed:true},200,responseHeaders);
    await ctx.env.DB.prepare("UPDATE vpage_pages SET status='repair_required',last_error_code='VPAGE_LOCAL_COMMIT_UNCERTAIN',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND status='provisioning'").bind(local.id,userId).run().catch(()=>{});
    return json({error:'สร้าง Vpage แล้ว แต่การบันทึกใน VisionD ต้องตรวจสอบซ้ำ ยังไม่ตัดเครดิตเพิ่ม',code:'VPAGE_REPAIR_REQUIRED'},202,responseHeaders);
  }
  invalidateVpageAvailability(local.domain_id,local.slug);local=await existingPage(ctx.env,userId,local.create_idempotency_key);return json({item:view(local),replayed:Boolean(remote.replayed)},remote.replayed?200:successStatus,responseHeaders);
}

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;const page=pageParams(ctx.request);if(page.error)return json({error:'เคอร์เซอร์ไม่ถูกต้อง'},400,responseHeaders);
  const statement=page.cursor
    ?ctx.env.DB.prepare('SELECT * FROM vpage_pages WHERE user_id=? AND id<? ORDER BY id DESC LIMIT ?').bind(auth.user.id,page.cursor,page.limit+1)
    :ctx.env.DB.prepare('SELECT * FROM vpage_pages WHERE user_id=? ORDER BY id DESC LIMIT ?').bind(auth.user.id,page.limit+1);
  const result=await statement.all(),items=result.results||[],hasMore=items.length>page.limit;if(hasMore)items.pop();return json({items:items.map(view),pagination:{limit:page.limit,has_more:hasMore,next_cursor:hasMore&&items.length?items.at(-1).id:null}},200,responseHeaders);
}

export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);const auth=await requireUser(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const key=String(ctx.request.headers.get('idempotency-key')||'').trim();if(!validVpageIdempotencyKey(key))return json({error:'กรุณาส่ง Idempotency-Key',code:'VPAGE_IDEMPOTENCY_REQUIRED'},400,responseHeaders);
  let raw;try{raw=await ctx.request.text()}catch{return json({error:'อ่านข้อมูลไม่สำเร็จ',code:'VPAGE_INPUT_INVALID'},400,responseHeaders)}if(new TextEncoder().encode(raw).byteLength>4096)return json({error:'ข้อมูลยาวเกินกำหนด',code:'VPAGE_PAYLOAD_TOO_LARGE'},413,responseHeaders);
  let body;try{body=JSON.parse(raw||'{}')}catch{return json({error:'ข้อมูลไม่ถูกต้อง',code:'VPAGE_INPUT_INVALID'},400,responseHeaders)}
  const displayName=typeof body.display_name==='string'?body.display_name.trim():'',domainId=String(body.domain_id||''),slug=String(body.slug||'');
  if(!validVpageDisplayName(displayName)||domainId.length<1||domainId.length>64||!validVpageSlug(slug))return json({error:'ชื่อร้าน โดเมน หรือ slug ไม่ถูกต้อง',code:'VPAGE_INPUT_INVALID'},400,responseHeaders);
  let domain;try{domain=(await listVpageDomains(ctx.env)).find(item=>item.id===domainId)}catch(error){const known=error instanceof VpageRemoteError;return json({error:known?error.message:'โหลดโดเมนไม่สำเร็จ',code:known?error.code:'VPAGE_DOMAIN_LOAD_FAILED'},known?error.status:502,responseHeaders)}
  if(!domain)return json({error:'โดเมนนี้ยังไม่เปิดใช้งาน',code:'VPAGE_DOMAIN_UNAVAILABLE'},400,responseHeaders);
  const requestHash=await sha256(JSON.stringify({display_name:displayName,domain_id:domainId,slug,user_id:Number(auth.user.id)}));let local=await existingPage(ctx.env,auth.user.id,key);
  if(local&&local.create_request_hash!==requestHash)return json({error:'Idempotency-Key นี้ถูกใช้กับข้อมูลอื่นแล้ว',code:'VPAGE_IDEMPOTENCY_CONFLICT'},409,responseHeaders);
  if(local?.status==='active')return json({item:view(local),replayed:true},200,responseHeaders);
  if(local?.status==='failed')return json({error:'คำขอเดิมสิ้นสุดแล้ว กรุณาส่งคำขอใหม่',code:local.last_error_code||'VPAGE_REQUEST_FAILED'},409,responseHeaders);
  if(!local){
    const credit=await ctx.env.DB.prepare("SELECT c.id FROM vpage_credits c INDEXED BY idx_vpage_credits_owner_status WHERE c.user_id=? AND c.status='available' AND NOT EXISTS(SELECT 1 FROM vpage_credit_claims x WHERE x.credit_id=c.id AND x.state IN ('held','committed')) ORDER BY c.id LIMIT 1").bind(auth.user.id).first();
    if(!credit)return json({error:'ไม่มีเครดิต Vpage ที่พร้อมใช้',code:'VPAGE_CREDIT_REQUIRED'},409,responseHeaders);
    const id=`vpl_${crypto.randomUUID().replaceAll('-','')}`,claimId=`vpc_${crypto.randomUUID().replaceAll('-','')}`,guard=`guard_${crypto.randomUUID().replaceAll('-','')}`;
    try{await ctx.env.DB.batch([
      ctx.env.DB.prepare("INSERT INTO vpage_transition_guards(token) VALUES(CASE WHEN EXISTS(SELECT 1 FROM vpage_credits c WHERE c.id=? AND c.user_id=? AND c.status='available' AND NOT EXISTS(SELECT 1 FROM vpage_credit_claims x WHERE x.credit_id=c.id AND x.state IN ('held','committed'))) THEN ? ELSE NULL END)").bind(credit.id,auth.user.id,guard),
      ctx.env.DB.prepare("INSERT INTO vpage_pages(id,user_id,credit_id,domain_id,slug,display_name,status,create_idempotency_key,create_request_hash) VALUES(?,?,?,?,?,?,'provisioning',?,?)").bind(id,auth.user.id,credit.id,domainId,slug,displayName,key,requestHash),
      ctx.env.DB.prepare("INSERT INTO vpage_credit_claims(id,credit_id,page_id,state) VALUES(?,?,?,'held')").bind(claimId,credit.id,id),
      ctx.env.DB.prepare('DELETE FROM vpage_transition_guards WHERE token=?').bind(guard)
    ])}catch(error){local=await existingPage(ctx.env,auth.user.id,key);if(!local){const slugTaken=await ctx.env.DB.prepare("SELECT id FROM vpage_pages WHERE domain_id=? AND slug=? AND status IN ('provisioning','repair_required','active','suspended') LIMIT 1").bind(domainId,slug).first();if(slugTaken)return json({error:'URL นี้ถูกใช้แล้ว',code:'VPAGE_SLUG_CONFLICT'},409,responseHeaders);const creditHeld=await ctx.env.DB.prepare("SELECT id FROM vpage_credit_claims WHERE credit_id=? AND state IN ('held','committed') LIMIT 1").bind(credit.id).first();if(creditHeld)return json({error:'เครดิตกำลังถูกใช้งาน',code:'VPAGE_PROVISIONING_CONFLICT'},409,responseHeaders);throw error}}
    local=local||await existingPage(ctx.env,auth.user.id,key);
    if(local?.status==='active')return json({item:view(local),replayed:true},200,responseHeaders);
    if(local?.status==='failed')return json({error:'คำขอเดิมสิ้นสุดแล้ว กรุณาส่งคำขอใหม่',code:local.last_error_code||'VPAGE_REQUEST_FAILED'},409,responseHeaders);
  }
  return reconcileVpageProvisioning(ctx,auth.user.id,local,{domain,successStatus:201});
}
