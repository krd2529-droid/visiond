import {json,requireAdmin,requireBoss} from '../../../_lib.js';
import {ensureDatabase} from '../../../_schema.js';

export async function onRequestGet(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireAdmin(ctx,{includeCourseOwner:false});if(auth.error)return auth.error;
  const url=new URL(ctx.request.url),rawCursor=url.searchParams.get('cursor'),rawUserId=url.searchParams.get('user_id'),limit=Math.min(24,Math.max(1,Number.parseInt(url.searchParams.get('limit'),10)||24));
  if(rawCursor!==null&&(!/^\d+$/.test(rawCursor)||!Number.isSafeInteger(Number(rawCursor))||Number(rawCursor)<1))return json({error:'เคอร์เซอร์ไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  if(rawUserId!==null&&(!/^\d+$/.test(rawUserId)||!Number.isSafeInteger(Number(rawUserId))||Number(rawUserId)<1))return json({error:'รหัสลูกค้าไม่ถูกต้อง'},400,{'cache-control':'private, no-store'});
  const cursor=rawCursor===null?null:Number(rawCursor),userId=rawUserId===null?null:Number(rawUserId),where=['1=1'],args=[];
  if(userId){where.push('c.user_id=?');args.push(userId)}
  if(cursor){where.push('c.id<?');args.push(cursor)}
  args.push(limit+1);
  const result=await ctx.env.DB.prepare(`SELECT c.id,c.user_id,CASE WHEN c.status='available' AND EXISTS(SELECT 1 FROM vpage_credit_claims x WHERE x.credit_id=c.id AND x.state='held') THEN 'provisioning' ELSE c.status END status,c.service_days,c.granted_at,c.consumed_at,o.order_no,u.name customer_name,u.email customer_email,CASE WHEN c.grant_id IS NULL THEN 'purchase' ELSE 'boss_grant' END source_type,g.id grant_id,g.note,g.quantity,actor.name granted_by_name FROM vpage_credits c LEFT JOIN orders o ON o.id=c.order_id LEFT JOIN vpage_credit_grants g ON g.id=c.grant_id LEFT JOIN users actor ON actor.id=g.granted_by JOIN users u ON u.id=c.user_id WHERE ${where.join(' AND ')} ORDER BY c.id DESC LIMIT ?`).bind(...args).all(),items=result.results||[],hasMore=items.length>limit;if(hasMore)items.pop();
  return json({items,pagination:{limit,has_more:hasMore,next_cursor:hasMore&&items.length?String(items.at(-1).id):null}},200,{'cache-control':'private, no-store'});
}

const validKey=value=>/^[A-Za-z0-9._:-]{16,128}$/.test(value);
export async function onRequestPost(ctx){
  await ensureDatabase(ctx.env);
  const auth=await requireBoss(ctx);if(auth.error)return auth.error;
  const headers={'cache-control':'private, no-store'},key=String(ctx.request.headers.get('idempotency-key')||'').trim(),body=await ctx.request.json().catch(()=>({})),userId=Number(body.user_id),quantity=Number(body.quantity),note=String(body.note||'').trim();
  if(!validKey(key)||!Number.isSafeInteger(userId)||userId<1||!Number.isInteger(quantity)||quantity<1||quantity>100||note.length>500)return json({error:'ข้อมูลเพิ่มเครดิต Vpage ไม่ถูกต้อง'},400,headers);
  const customer=await ctx.env.DB.prepare("SELECT id,name,email,username FROM users WHERE id=? AND role IN ('user','customer')").bind(userId).first();
  if(!customer)return json({error:'ไม่พบบัญชีลูกค้าสำหรับเครดิต Vpage'},404,headers);
  const replay=await ctx.env.DB.prepare('SELECT id,user_id,quantity,note,granted_by FROM vpage_credit_grants WHERE idempotency_key=?').bind(key).first();
  if(replay){if(Number(replay.user_id)!==userId||Number(replay.quantity)!==quantity||String(replay.note)!==note||Number(replay.granted_by)!==Number(auth.user.id))return json({error:'คีย์คำขอเครดิต Vpage ถูกใช้กับข้อมูลอื่นแล้ว'},409,headers);const balance=await availableBalance(ctx.env,userId);return json({replayed:true,credits_added:quantity,credit_balance:balance,grant_id:replay.id,customer},200,headers)}
  const grantId=`vcg_${crypto.randomUUID().replaceAll('-','')}`;
  try{await ctx.env.DB.batch([
    ctx.env.DB.prepare("INSERT INTO vpage_credit_grants(id,user_id,quantity,note,granted_by,idempotency_key) VALUES(?,?,?,?,?,?)").bind(grantId,userId,quantity,note,auth.user.id,key),
    ctx.env.DB.prepare("INSERT INTO vpage_credits(user_id,grant_id,grant_sequence,status,service_days) WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<?) SELECT ?,?,n,'available',30 FROM seq").bind(quantity,userId,grantId)
  ])}catch(error){const existing=await ctx.env.DB.prepare('SELECT id,user_id,quantity,note,granted_by FROM vpage_credit_grants WHERE idempotency_key=?').bind(key).first();if(!existing||Number(existing.user_id)!==userId||Number(existing.quantity)!==quantity||String(existing.note)!==note||Number(existing.granted_by)!==Number(auth.user.id))throw error;const balance=await availableBalance(ctx.env,userId);return json({replayed:true,credits_added:quantity,credit_balance:balance,grant_id:existing.id,customer},200,headers)}
  const balance=await availableBalance(ctx.env,userId);return json({replayed:false,credits_added:quantity,credit_balance:balance,grant_id:grantId,customer},201,headers);
}
async function availableBalance(env,userId){const row=await env.DB.prepare("SELECT COUNT(*) count FROM vpage_credits c WHERE c.user_id=? AND c.status='available' AND NOT EXISTS(SELECT 1 FROM vpage_credit_claims x WHERE x.credit_id=c.id AND x.state='held') AND NOT EXISTS(SELECT 1 FROM vpage_renewal_requests r WHERE r.credit_id=c.id AND r.state IN ('held','remote_committed'))").bind(userId).first();return Number(row?.count)||0}
