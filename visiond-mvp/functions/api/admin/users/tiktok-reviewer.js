import {json,requireBoss} from '../../../_lib.js';
import {hashPassword,verifyPassword,securityLog} from '../../../_security.js';

const PRIVATE={'cache-control':'private, no-store'};
const reply=(body,status=200)=>json(body,status,PRIVATE);
const privateResponse=(response)=>{const headers=new Headers(response.headers);headers.set('cache-control','private, no-store');return new Response(response.body,{status:response.status,statusText:response.statusText,headers})};
const primitive=(value)=>typeof value==='string'?value:null;
const canonicalId=(value)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0?value:typeof value==='string'&&/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):null;
const schemaMissing=error=>/no such table[^]*vx_review_access_grants/i.test(String(error?.message||error||''));
const uniqueConflict=error=>/unique constraint/i.test(String(error?.message||error||''));
const statusOf=(grant,now=Date.now())=>grant?.revoked_at?'revoked':Date.parse(String(grant?.expires_at||'').replace(' ','T')+'Z')<=now?'expired':'active';
const safeGrant=(row)=>row?{id:Number(row.id),user_id:Number(row.user_id),username:row.username,email:row.email,name:row.name,scope:row.scope,account_limit:Number(row.account_limit),starts_at:row.starts_at,expires_at:row.expires_at,revoked_at:row.revoked_at||null,status:statusOf(row)}:null;

async function findIdentity(env,email,username){
  const rows=(await env.DB.prepare(`SELECT id,email,username,name,role,is_test_user,password_hash FROM users
    WHERE lower(email)=? OR lower(email)=? OR lower(username)=? OR lower(username)=? ORDER BY id LIMIT 3`).bind(email,username,email,username).all()).results||[];
  const user=rows.find(row=>String(row.email).toLowerCase()===email&&String(row.username).toLowerCase()===username)||null;
  return {user,collision:rows.some(row=>!user||Number(row.id)!==Number(user.id))};
}

const grantQuery=`SELECT g.id,g.user_id,g.scope,g.account_limit,g.starts_at,g.expires_at,g.revoked_at,g.created_at,
  u.username,u.email,u.name FROM vx_review_access_grants g JOIN users u ON u.id=g.user_id
  WHERE g.user_id=? AND g.scope='tiktok_app_review' AND g.superseded_at IS NULL ORDER BY g.id DESC LIMIT 1`;

async function replayProvision(env,email,username,password){
  const identity=await findIdentity(env,email,username),user=identity.user;
  if(identity.collision||!user||String(user.email).toLowerCase()!==email||String(user.username).toLowerCase()!==username||user.role!=='user'||Number(user.is_test_user)!==0)return null;
  const grant=await env.DB.prepare(grantQuery).bind(user.id).first();
  if(!grant||!await verifyPassword(password,user.password_hash))return null;
  return {grant,user};
}

async function listGrants(env,after){
  let statement=env.DB.prepare(`SELECT g.id,g.user_id,g.scope,g.account_limit,g.starts_at,g.expires_at,g.revoked_at,g.created_at,
    u.username,u.email,u.name FROM vx_review_access_grants g JOIN users u ON u.id=g.user_id
    WHERE g.scope='tiktok_app_review' AND g.superseded_at IS NULL ${after?'AND g.id<?':''}
    ORDER BY g.id DESC LIMIT 25`);
  if(after)statement=statement.bind(after);
  const rows=(await statement.all()).results||[];
  const hasMore=rows.length>24,items=rows.slice(0,24).map(safeGrant);
  return {items,next_cursor:hasMore?String(items.at(-1).id):null};
}

export async function onRequestGet(ctx){
  try{
    const auth=await requireBoss(ctx);if(auth.error)return privateResponse(auth.error);
    const rawAfter=new URL(ctx.request.url).searchParams.get('cursor'),after=rawAfter===null?null:canonicalId(rawAfter);
    if(rawAfter!==null&&!after)return reply({error:'Cursor ไม่ถูกต้อง',code:'VX_REVIEW_CURSOR_INVALID'},400);
    return reply(await listGrants(ctx.env,after));
  }catch(error){
    if(schemaMissing(error))return reply({error:'ระบบสิทธิ์ Reviewer ยังไม่พร้อม',code:'VX_REVIEW_SCHEMA_REQUIRED'},503);
    console.error('VX_REVIEW_LIST_FAILED');return reply({error:'โหลดสิทธิ์ Reviewer ไม่สำเร็จ',code:'VX_REVIEW_FAILED'},500);
  }
}

async function provision(ctx,auth,body){
  const username=primitive(body.username)?.normalize('NFKC').trim().toLowerCase(),email=primitive(body.email)?.normalize('NFKC').trim().toLowerCase(),name=primitive(body.name)?.normalize('NFKC').trim(),password=primitive(body.password);
  if(!username||!/^[a-z0-9._-]{4,50}$/.test(username)||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name||name.length<2||name.length>120||!password||password.length<12||password.length>200)return reply({error:'กรอกชื่อ Username อีเมล และรหัสผ่านใหม่อย่างน้อย 12 ตัวให้ถูกต้อง',code:'VX_REVIEW_INPUT_INVALID'},400);
  const existing=await findIdentity(ctx.env,email,username);
  if(existing.collision||existing.user){
    const replay=await replayProvision(ctx.env,email,username,password);
    if(!replay)return reply({error:'อีเมลหรือ Username นี้เป็นบัญชีอื่นและจะไม่ถูกแก้ไข',code:'VX_REVIEW_IDENTITY_CONFLICT'},409);
    const item=safeGrant(replay.grant);
    if(item.status!=='active')return reply({error:'บัญชี Reviewer เดิมหมดอายุหรือถูกยกเลิก กรุณาใช้คำสั่งต่ออายุ',code:'VX_REVIEW_RENEW_REQUIRED',item},409);
    return reply({ok:true,replayed:true,item});
  }
  const passwordHash=await hashPassword(password);
  try{
    const results=await ctx.env.DB.batch([
      ctx.env.DB.prepare(`INSERT INTO users(email,username,name,phone,password_hash,role,is_test_user,vision5_test_account)
        SELECT ?,?,?,NULL,?,'user',0,0 WHERE NOT EXISTS(SELECT 1 FROM users
        WHERE lower(email)=? OR lower(email)=? OR lower(username)=? OR lower(username)=?)`).bind(email,username,name,passwordHash,email,username,email,username),
      ctx.env.DB.prepare(`INSERT INTO vx_review_access_grants(user_id,scope,account_limit,starts_at,expires_at,created_by)
        SELECT id,'tiktok_app_review',1,CURRENT_TIMESTAMP,datetime(CURRENT_TIMESTAMP,'+30 days'),? FROM users
        WHERE email=? AND username=? AND role='user' AND is_test_user=0 AND changes()=1`).bind(auth.user.id,email,username)
    ]);
    if(Number(results?.[0]?.meta?.changes)!==1||Number(results?.[1]?.meta?.changes)!==1){
      const replay=await replayProvision(ctx.env,email,username,password);
      if(replay)return reply({ok:true,replayed:true,item:safeGrant(replay.grant)});
      return reply({error:'อีเมลหรือ Username นี้เป็นบัญชีอื่นและจะไม่ถูกแก้ไข',code:'VX_REVIEW_IDENTITY_CONFLICT'},409);
    }
  }catch(error){
    if(!uniqueConflict(error))throw error;
    const replay=await replayProvision(ctx.env,email,username,password);
    if(!replay)return reply({error:'อีเมลหรือ Username นี้เป็นบัญชีอื่นและจะไม่ถูกแก้ไข',code:'VX_REVIEW_IDENTITY_CONFLICT'},409);
    const item=safeGrant(replay.grant);
    return item.status==='active'?reply({ok:true,replayed:true,item}):reply({error:'บัญชี Reviewer เดิมต้องต่ออายุอย่างชัดเจน',code:'VX_REVIEW_RENEW_REQUIRED',item},409);
  }
  const user=(await findIdentity(ctx.env,email,username)).user,grant=await ctx.env.DB.prepare(grantQuery).bind(user.id).first();
  await securityLog(ctx.env,ctx.request,'vx_review_access_created','warning',`target_user_id=${user.id};grant_id=${grant.id}`,auth.user.id);
  return reply({ok:true,item:safeGrant(grant)},201);
}

async function renew(ctx,auth,body){
  const expectedId=canonicalId(body.expected_grant_id);if(!expectedId)return reply({error:'รหัสสิทธิ์เดิมไม่ถูกต้อง',code:'VX_REVIEW_GRANT_INVALID'},400);
  const old=await ctx.env.DB.prepare(`SELECT g.*,u.role,u.is_test_user FROM vx_review_access_grants g JOIN users u ON u.id=g.user_id WHERE g.id=? AND g.scope='tiktok_app_review'`).bind(expectedId).first();
  if(!old||old.role!=='user'||Number(old.is_test_user)!==0)return reply({error:'ไม่พบสิทธิ์ Reviewer',code:'VX_REVIEW_NOT_FOUND'},404);
  const latest=await ctx.env.DB.prepare('SELECT id FROM vx_review_access_grants WHERE user_id=? AND superseded_at IS NULL ORDER BY id DESC LIMIT 1').bind(old.user_id).first();
  if(Number(latest?.id)!==expectedId)return reply({error:'สิทธิ์ Reviewer มีสถานะใหม่กว่าแล้ว กรุณาโหลดข้อมูลใหม่',code:'VX_REVIEW_STALE'},409);
  if(statusOf(old)==='active')return reply({error:'สิทธิ์ Reviewer ยังใช้งานอยู่',code:'VX_REVIEW_STILL_ACTIVE'},409);
  const results=await ctx.env.DB.batch([
    ctx.env.DB.prepare(`UPDATE vx_review_access_grants SET revoked_at=COALESCE(revoked_at,CURRENT_TIMESTAMP),revoked_by=COALESCE(revoked_by,?),superseded_at=CURRENT_TIMESTAMP
      WHERE id=? AND superseded_at IS NULL AND (revoked_at IS NOT NULL OR expires_at<=CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM users u WHERE u.id=vx_review_access_grants.user_id AND u.role='user' AND COALESCE(u.is_test_user,0)=0)`).bind(auth.user.id,expectedId),
    ctx.env.DB.prepare(`INSERT INTO vx_review_access_grants(user_id,scope,account_limit,starts_at,expires_at,created_by)
      SELECT user_id,'tiktok_app_review',1,CURRENT_TIMESTAMP,datetime(CURRENT_TIMESTAMP,'+30 days'),? FROM vx_review_access_grants old
      WHERE old.id=? AND old.superseded_at IS NOT NULL AND (old.revoked_at IS NOT NULL OR old.expires_at<=CURRENT_TIMESTAMP)
      AND EXISTS(SELECT 1 FROM users u WHERE u.id=old.user_id AND u.role='user' AND COALESCE(u.is_test_user,0)=0)
      AND NOT EXISTS(SELECT 1 FROM vx_review_access_grants newer WHERE newer.user_id=old.user_id AND newer.id>old.id)
      AND NOT EXISTS(SELECT 1 FROM vx_review_access_grants current WHERE current.user_id=old.user_id AND current.superseded_at IS NULL)`).bind(auth.user.id,expectedId)
  ]);
  if(Number(results?.[1]?.meta?.changes)!==1)return reply({error:'สิทธิ์ Reviewer เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่',code:'VX_REVIEW_STALE'},409);
  const grant=await ctx.env.DB.prepare(grantQuery).bind(old.user_id).first();
  await securityLog(ctx.env,ctx.request,'vx_review_access_renewed','warning',`target_user_id=${old.user_id};grant_id=${grant.id}`,auth.user.id);
  return reply({ok:true,item:safeGrant(grant)});
}

export async function onRequestPost(ctx){
  try{
    const auth=await requireBoss(ctx);if(auth.error)return privateResponse(auth.error);
    const body=await ctx.request.json().catch(()=>null);if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'ข้อมูลคำขอไม่ถูกต้อง'},400);
    const action=primitive(body.action);
    if(action==='provision')return await provision(ctx,auth,body);
    if(action==='renew')return await renew(ctx,auth,body);
    return reply({error:'คำสั่งไม่ถูกต้อง'},400);
  }catch(error){
    if(schemaMissing(error))return reply({error:'ระบบสิทธิ์ Reviewer ยังไม่พร้อม',code:'VX_REVIEW_SCHEMA_REQUIRED'},503);
    console.error('VX_REVIEW_WRITE_FAILED');return reply({error:'จัดการสิทธิ์ Reviewer ไม่สำเร็จ',code:'VX_REVIEW_FAILED'},500);
  }
}

export async function onRequestDelete(ctx){
  try{
    const auth=await requireBoss(ctx);if(auth.error)return privateResponse(auth.error);
    const body=await ctx.request.json().catch(()=>null),expectedId=canonicalId(body?.expected_grant_id);
    if(!expectedId)return reply({error:'รหัสสิทธิ์ไม่ถูกต้อง',code:'VX_REVIEW_GRANT_INVALID'},400);
    const grant=await ctx.env.DB.prepare(`SELECT g.id,g.user_id,g.revoked_at,g.superseded_at,u.role,u.is_test_user FROM vx_review_access_grants g
      JOIN users u ON u.id=g.user_id WHERE g.id=? AND g.scope='tiktok_app_review'`).bind(expectedId).first();
    if(!grant)return reply({error:'ไม่พบสิทธิ์ Reviewer',code:'VX_REVIEW_NOT_FOUND'},404);
    if(grant.superseded_at)return reply({error:'สิทธิ์ Reviewer มีสถานะใหม่กว่าแล้ว กรุณาโหลดข้อมูลใหม่',code:'VX_REVIEW_STALE'},409);
    if(grant.role!=='user'||Number(grant.is_test_user)!==0)return reply({error:'บัญชีนี้ไม่ใช่ Reviewer แบบจำกัดสิทธิ์แล้ว',code:'VX_REVIEW_ROLE_CHANGED'},409);
    if(grant.revoked_at)return reply({ok:true,replayed:true,item:{id:Number(grant.id),user_id:Number(grant.user_id),status:'revoked'}});
    const results=await ctx.env.DB.batch([
      ctx.env.DB.prepare(`DELETE FROM sessions WHERE user_id=(SELECT old.user_id FROM vx_review_access_grants old JOIN users u ON u.id=old.user_id
        WHERE old.id=? AND old.revoked_at IS NULL AND old.superseded_at IS NULL AND u.role='user' AND COALESCE(u.is_test_user,0)=0)`).bind(expectedId),
      ctx.env.DB.prepare(`UPDATE vx_review_access_grants SET revoked_at=CURRENT_TIMESTAMP,revoked_by=? WHERE id=? AND revoked_at IS NULL AND superseded_at IS NULL
        AND EXISTS(SELECT 1 FROM users u WHERE u.id=vx_review_access_grants.user_id AND u.role='user' AND COALESCE(u.is_test_user,0)=0)`).bind(auth.user.id,expectedId)
    ]);
    if(Number(results?.[1]?.meta?.changes)!==1)return reply({error:'สิทธิ์ Reviewer มีสถานะใหม่กว่าแล้ว กรุณาโหลดข้อมูลใหม่',code:'VX_REVIEW_STALE'},409);
    await securityLog(ctx.env,ctx.request,'vx_review_access_revoked','warning',`target_user_id=${grant.user_id};grant_id=${grant.id}`,auth.user.id);
    return reply({ok:true,item:{id:Number(grant.id),user_id:Number(grant.user_id),status:'revoked'}});
  }catch(error){
    if(schemaMissing(error))return reply({error:'ระบบสิทธิ์ Reviewer ยังไม่พร้อม',code:'VX_REVIEW_SCHEMA_REQUIRED'},503);
    console.error('VX_REVIEW_REVOKE_FAILED');return reply({error:'ยกเลิกสิทธิ์ Reviewer ไม่สำเร็จ',code:'VX_REVIEW_FAILED'},500);
  }
}
