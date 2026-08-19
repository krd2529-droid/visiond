import {json} from '../../_lib.js';
import {rateLimit,rateLimitIdentity,verifyTurnstile,verifyPassword,securityLog} from '../../_security.js';
import {recordSuccessfulLogin} from '../../_first_order_promo.js';
import {claimVisitorHistory} from '../../_analytics.js';

export async function onRequestPost(ctx){
 try{
  if(!ctx.env.DB)return json({error:'ยังไม่ได้เชื่อมฐานข้อมูลสมาชิก'},503);
  const b=await ctx.request.json().catch(()=>({}));
  const login=String(b.login||b.email||'').trim().toLowerCase();
  // Every identity, including Boss, is protected. The wider IP limit avoids
  // punishing a shared office/mobile IP while the identity/account limits stop
  // both direct brute force and attempts through aliases of the same account.
  const ipLimited=await rateLimit(ctx.env,ctx.request,'login_ip',30,15,30);if(ipLimited.error)return ipLimited.error;
  const identityLimited=await rateLimitIdentity(ctx.env,ctx.request,'login_name',login,10,15,30);if(identityLimited.error)return identityLimited.error;
  const turnstile=await verifyTurnstile(ctx.env,ctx.request,b.turnstile_token);if(turnstile.error)return turnstile.error;
  if(!login||!b.password)return json({error:'กรุณากรอกไอดีและรหัสผ่าน'},400);
  const u=await ctx.env.DB.prepare('SELECT * FROM users WHERE lower(email)=? OR lower(username)=? ORDER BY CASE WHEN lower(username)=? THEN 0 ELSE 1 END,id LIMIT 1').bind(login,login,login).first();
  if(u){const accountLimited=await rateLimitIdentity(ctx.env,ctx.request,'login_account',`user:${u.id}`,10,15,30);if(accountLimited.error)return accountLimited.error;}
  if(!u||!await verifyPassword(String(b.password||''),u.password_hash)){await securityLog(ctx.env,ctx.request,'login_failed','warning',login);return json({error:'ไอดีหรือรหัสผ่านไม่ถูกต้อง'},401)}
  const remember=b.remember===true,sessionDuration=remember?'+30 days':'+24 hours';
  const id=crypto.randomUUID();await ctx.env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now',?))").bind(id,u.id,sessionDuration).run();
  await recordSuccessfulLogin(ctx.env,u.id);
  const claimed=await claimVisitorHistory(ctx.env,ctx.request,u.id);
  await ctx.env.DB.prepare(`INSERT INTO customer_events(visitor_key,user_id,event_type,path,metadata) VALUES(?,?,'login_success','/login',?)`).bind(claimed.visitor_key,u.id,JSON.stringify({claimed_guest_events:claimed.claimed})).run().catch(()=>{});
  await securityLog(ctx.env,ctx.request,'login_success','info','',u.id);
  const maxAge=remember?'; Max-Age=2592000':'';
  return json({ok:true},200,{'set-cookie':`vd_session=${id}; HttpOnly; Secure; SameSite=Lax; Path=/${maxAge}`});
 }catch(error){console.error('AUTH_LOGIN_FAILED',error);return json({error:'ระบบเข้าสู่ระบบขัดข้อง [AUTH-LOGIN]'},500)}
}
// Feature: AUTH-ACCOUNT-001 — session login boundary
