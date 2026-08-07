import {json} from '../../_lib.js';
import {rateLimit,verifyTurnstile,verifyPassword,securityLog} from '../../_security.js';

export async function onRequestPost(ctx){
 try{
  if(!ctx.env.DB)return json({error:'ยังไม่ได้เชื่อมฐานข้อมูลสมาชิก'},503);
  const b=await ctx.request.json().catch(()=>({}));
  const login=String(b.login||b.email||'').trim().toLowerCase();
  const staffIdentities=new Set(['visiondboss','krd2529@gmail.com','krd2529+boss@gmail.com']);
  const isStaffLogin=staffIdentities.has(login);
  if(!isStaffLogin){const limited=await rateLimit(ctx.env,ctx.request,'login',5,15,30);if(limited.error)return limited.error;}
  const turnstile=await verifyTurnstile(ctx.env,ctx.request,b.turnstile_token);if(turnstile.error)return turnstile.error;
  if(!login||!b.password)return json({error:'กรุณากรอกไอดีและรหัสผ่าน'},400);
  const u=await ctx.env.DB.prepare('SELECT * FROM users WHERE lower(email)=? OR lower(username)=? ORDER BY CASE WHEN lower(username)=? THEN 0 ELSE 1 END,id LIMIT 1').bind(login,login,login).first();
  if(!u||!await verifyPassword(String(b.password||''),u.password_hash)){await securityLog(ctx.env,ctx.request,'login_failed','warning',login);return json({error:'ไอดีหรือรหัสผ่านไม่ถูกต้อง'},401)}
  const id=crypto.randomUUID();await ctx.env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))").bind(id,u.id).run();
  await securityLog(ctx.env,ctx.request,'login_success','info','',u.id);
  return json({ok:true},200,{'set-cookie':`vd_session=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`});
 }catch(error){console.error('AUTH_LOGIN_FAILED',error);return json({error:'ระบบเข้าสู่ระบบขัดข้อง [AUTH-LOGIN]'},500)}
}
